// Builds the pacman-nx.zip package from the player's own copy of the game.
//
// The game comes as its Xbox Live Arcade package (read in place, nothing is extracted to disk) or as a folder it was
// extracted into, and Title Update 3 the same way: the game's code is the update's. The zip holds the Switch build
// (pacman-nx.nro) and its licenses, the shaders made from the patched executable (deko3d_glsl.bin), the game's files with
// the update's default.xexp beside default.xex (game_root/: the console applies it at start, as the Xbox 360 does), the
// update's other files (update/: the game opens them as UPDATE:\) and, when chosen, the DLC package (the game installs it
// from dlc/ at its first start). The settings file, pacman.toml, is written by the game at its first start, so an update
// never replaces the player's settings.

import { readXexImage } from './xex.js';
import { applyXexPatch, lzxDeltaStep } from './xexp.js';
import { CONTENT_DLC, CONTENT_GAME, CONTENT_UPDATE, StfsPackage, readStfsHeader } from './stfs.js';
import { imageContainers, sha256 } from './shaders.js';
import { buildDeko3dPackage } from './deko3d.js';
import { ZipWriter, zipSize } from './zip.js';
import { t } from './i18n.js';

const CHUNK = 16 * 1024 * 1024;
const ROOT = 'pacman-nx';
const TITLE_ID = 0x58410a8c;
// files whose header is read to find the packages among the chosen files
const MAX_CANDIDATES = 256;

async function* chunksOf(file) {
  for (let offset = 0; offset < file.size; offset += CHUNK) {
    yield await file.read(offset, Math.min(CHUNK, file.size - offset));
  }
}

function baseName(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

function folderOf(path) {
  return path.slice(0, path.lastIndexOf('/') + 1);
}

// Xbox 360 content packages have no extension, but a title update's file name can have a long number after a dot:
// TU_1C422JO_000000G000000.0000000000084.
function looksLikePackage(name) {
  return !name.includes('.') || /\.[0-9a-z]{8,}$/i.test(name);
}

function isXexp(file) {
  return file.path.toLowerCase() === 'default.xexp';
}

// The LZX step of readXexImage, done by libmspack compiled to WebAssembly.
export function lzxStep(lzx) {
  return async (compressed, bits, size) => {
    lzx.FS.writeFile('/image.lzx', compressed);
    const rc = lzx.callMain(['/image.lzx', '/image.bin', String(bits), String(size)]);
    if (rc) {
      throw new Error(`LZX decompression failed (${rc})`);
    }
    const out = lzx.FS.readFile('/image.bin');
    lzx.FS.unlink('/image.lzx');
    lzx.FS.unlink('/image.bin');
    return out;
  };
}

// Where the program is downloaded from. Its SHA-256 is part of the address, so every version is a different address
// and a copy kept by the browser is never mistaken for a newer one.
export function programPath(build) {
  return `./release/${build.nro}?sha256=${build.nro_sha256}`;
}

// The game's files, sorted by path.
function gameFiles(files) {
  return [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

function sizeOf(files) {
  return files.reduce((sum, f) => sum + f.size, 0);
}

// Sorts out what the player chose: files ([{ path, size, read }]) from the "Add files" button (the chosen files) or from
// the "Add a folder" button (every file under the folder, its name first in the path), in any number of choices.
// Returns { game, update, dlc, others }:
//   game, update = { kind: 'package' | 'folder', name, size, files } or null (update.files has default.xexp);
//   dlc = the DLC packages ([{ kind: 'package', name, size, read }]);
//   others = the names of content packages of other games.
export async function findGame(chosen) {
  // The packages first, wherever they are in what was chosen (also inside the game folder), by their header: of this
  // game, content type 0xD0000 is the game itself, 0xB0000 a title update and 2 its DLC.
  const dlc = [];
  let gamePackage = null;
  let gameHeader = null;
  let updatePackage = null;
  let updateHeader = null;
  const taken = new Set();
  const others = [];
  const candidates = chosen
    .filter((f) => f.size >= 0xa000 && looksLikePackage(baseName(f.path)))
    .slice(0, MAX_CANDIDATES);
  for (const file of candidates) {
    const header = readStfsHeader(await file.read(0, 0x600));
    if (!header) {
      continue;
    }
    const name = baseName(file.path);
    if (header.titleId !== TITLE_ID) {
      if (baseName(file.path) !== 'AvatarAssetPack') {
        others.push(header.displayName || name);
      }
    } else if (header.contentType === CONTENT_DLC && !dlc.some((d) => d.name === name)) {
      dlc.push({ kind: 'package', name, size: file.size, read: file.read, path: file.path });
      taken.add(file);
    } else if (header.contentType === CONTENT_GAME && !gamePackage) {
      gamePackage = file;
      gameHeader = header;
      taken.add(file);
    } else if (header.contentType === CONTENT_UPDATE && !updatePackage) {
      updatePackage = file;
      updateHeader = header;
      taken.add(file);
    }
  }
  const rest = chosen.filter((f) => !taken.has(f));
  const under = (prefix) => rest.filter((f) => f.path.startsWith(prefix)).map((f) => ({ ...f, path: f.path.slice(prefix.length) }));
  const shallowFirst = (a, b) => a.path.split('/').length - b.path.split('/').length;
  let game = null;
  let update = null;
  // The packages, read in place.
  if (gamePackage) {
    const kept = gameFiles((await StfsPackage.open(gamePackage)).files());
    game = { kind: 'package', name: gameHeader.displayName || baseName(gamePackage.path), size: sizeOf(kept), files: kept };
  }
  if (updatePackage) {
    const kept = gameFiles((await StfsPackage.open(updatePackage)).files());
    if (kept.some(isXexp)) {
      update = { kind: 'package', name: updateHeader.displayName || baseName(updatePackage.path), size: sizeOf(kept), files: kept };
    }
  }
  // An extracted game: the shallowest default.xex names its folder. An extracted title update: the shallowest default.xexp
  // in another folder. One beside default.xex is the layout of the SD card: its other files are in update/ beside game_root/.
  const executables = rest.filter((f) => baseName(f.path).toLowerCase() === 'default.xex').sort(shallowFirst);
  const gamePrefix = !game && executables.length ? folderOf(executables[0].path) : null;
  const patches = rest.filter((f) => baseName(f.path).toLowerCase() === 'default.xexp').sort(shallowFirst);
  let updatePrefix = null;
  if (!update) {
    const own = patches.find((f) => folderOf(f.path) !== gamePrefix);
    if (own) {
      updatePrefix = folderOf(own.path);
      const files = gameFiles(under(updatePrefix));
      update = { kind: 'folder', name: updatePrefix ? baseName(updatePrefix.slice(0, -1)) : '', size: sizeOf(files), files };
    } else if (patches.length && gamePrefix) {
      updatePrefix = `${folderOf(gamePrefix.slice(0, -1))}update/`;
      const moved = under(updatePrefix);
      if (moved.length) {
        const files = gameFiles([...moved, { ...patches[0], path: 'default.xexp' }]);
        update = { kind: 'folder', name: 'update', size: sizeOf(files), files };
      }
    }
  }
  if (gamePrefix !== null) {
    const nested = updatePrefix && updatePrefix.startsWith(gamePrefix) ? updatePrefix.slice(gamePrefix.length) : null;
    const files = gameFiles(under(gamePrefix).filter((f) => !isXexp(f) && !(nested && f.path.startsWith(nested))));
    game = { kind: 'folder', name: gamePrefix ? baseName(gamePrefix.slice(0, -1)) : '', size: sizeOf(files), files };
  }
  return { game, update, dlc, others };
}

// Identifies the build of this game by the SHA-256 of default.xex, and checks the title update: its default.xexp by its
// SHA-256, its other files by their number. Returns { xex, xexHash, xexp, xexpHash, build (null when none), problems }.
export async function identifyGame(chosen, manifest) {
  const { game, update } = chosen;
  const xexFile = game && game.files.find((f) => f.path.toLowerCase() === 'default.xex');
  if (!xexFile) {
    const error = new Error(t('noGame'));
    error.code = 'noGame';
    throw error;
  }
  const xex = await xexFile.read(0, xexFile.size);
  const xexHash = await sha256(xex);
  const build = manifest.builds.find((b) => b.xex_sha256 === xexHash) || null;
  let xexp = null;
  let xexpHash = null;
  if (update) {
    const file = update.files.find(isXexp);
    xexp = await file.read(0, file.size);
    xexpHash = await sha256(xexp);
  }
  const problems = [];
  if (build) {
    if (!update) {
      problems.push('noUpdate');
    } else if (xexpHash !== build.update.xexp_sha256 || update.files.length < build.update.files) {
      problems.push('updateDifferent');
    }
  }
  return { xex, xexHash, xexp, xexpHash, build, problems };
}

// The executable the console runs: default.xex's image with the title update applied (lib/xexp.js). All of the game's
// shaders in it have other hashes than the base game's, so the shaders are made from this.
export async function patchedImage(xex, xexp, modules) {
  const { image: base } = await readXexImage(xex, lzxStep(modules.lzx));
  const { image } = await applyXexPatch(xex, base, xexp, lzxDeltaStep(modules.lzxDelta));
  return image;
}

// The game's shader containers, as the build's entry lists them: those stored in the patched executable, by their
// SHA-256. The game makes 4 more at run time from HLSL with its own D3DX; they are in none of its files, so they are built
// into the NRO.
export async function gameContainers(xex, xexp, deko3d, modules) {
  const image = await patchedImage(xex, xexp, modules);
  const wanted = new Set(deko3d.image_sha256);
  const containers = [];
  const seen = new Set();
  for (const c of imageContainers(image)) {
    const hash = await sha256(c.bytes);
    if (wanted.has(hash) && !seen.has(hash)) {
      seen.add(hash);
      containers.push(c);
    }
  }
  if (seen.size !== wanted.size) {
    throw new Error(t('deko3dContainers', { found: seen.size, wanted: wanted.size }));
  }
  return containers;
}

// The shaders of the Switch build's renderer (Renut on deko3d): deko3d_glsl.bin, which the NRO reads beside itself, made
// from the containers in the patched executable (lib/deko3d.js) and checked against the build's manifest entry ("deko3d": {
// shaders: [names], image_sha256: [...], package_sha256 }). modules: { lzx, lzxDelta, renutHlsl, dxc, spirvCross };
// renutCommon: Renut's shader_common.h.
export async function makeDeko3dPackage(xex, xexp, build, modules, renutCommon, log = () => {}) {
  const containers = await gameContainers(xex, xexp, build.deko3d, modules);
  log(t('deko3dShaders', { count: build.deko3d.shaders.length }));
  const { package: pkg } = await buildDeko3dPackage(containers, build.deko3d.shaders, modules, renutCommon, log);
  const hash = await sha256(pkg);
  if (hash !== build.deko3d.package_sha256) {
    throw new Error(t('deko3dMismatch', { hash }));
  }
  log(t('deko3dReady'));
  return pkg;
}

// chosen: findGame(); release: { manifest, nro: Uint8Array, licenses: Uint8Array (release/LICENSES.txt),
// renutShaderCommon: Uint8Array (Renut's translator header) }
// modules: { dxc, lzx, lzxDelta, renutHlsl, spirvCross } instantiated Emscripten modules (one object each)
// sink: { write(Uint8Array), close() } receiving the zip file
// onSize(bytes) is called with the exact size of the zip before the first byte is written.
// update: only the program, its licenses, the shaders and the title update (and the DLC when chosen), for a folder already
// on the SD card.
export async function createPackage(chosen, release, modules, sink, log = () => {}, progress = () => {},
  onSize = () => {}, { update = false } = {}) {
  const { game, update: titleUpdate, dlc } = chosen;
  if (!game) {
    throw new Error(t('noGame'));
  }
  const { xex, xexHash, xexp, build, problems } = await identifyGame(chosen, release.manifest);
  if (!build) {
    throw new Error(t('notSupportedYet', { hash: xexHash }));
  }
  if (problems.length) {
    throw new Error(t(problems[0]));
  }
  log(t('logBuild', { version: build.version }));
  if (update) {
    log(t('logUpdate'));
  }
  for (const d of dlc) {
    log(t('logDlc', { name: d.name }));
  }

  // a folder the game was only partly extracted into would make a package that does not start
  if (!update && game.files.length < build.game_files) {
    throw new Error(t('incompleteError', { count: game.files.length, expected: build.game_files }));
  }

  // The shaders first: they are the step most likely to stop the package, and nothing is written before them.
  const deko3d = await makeDeko3dPackage(xex, xexp, build, modules, release.renutShaderCommon, log);

  const gameEntries = update ? [] : game.files.map((f) => ({ path: `${ROOT}/game_root/${f.path}`, file: f }));
  // default.xexp beside default.xex, the others as UPDATE:\
  const updateEntries = titleUpdate.files.map((f) => ({
    path: isXexp(f) ? `${ROOT}/game_root/default.xexp` : `${ROOT}/update/${f.path}`,
    file: f,
  }));
  const dlcFiles = dlc.map((d) => ({ path: `${ROOT}/dlc/${d.name}`, file: d }));
  const copied = [...gameEntries, ...updateEntries, ...dlcFiles];
  const total = copied.reduce((sum, e) => sum + e.file.size, 0) || 1;
  let done = 0;
  const onChunk = (chunk) => {
    done += chunk.length;
    progress(done / total);
  };
  if (!update) {
    log(t(game.files.length === build.game_files && sizeOf(game.files) === build.game_bytes ? 'gameIdentical' : 'gameDifferent'));
  }

  const nroPath = `${ROOT}/${build.nro}`;
  const entries = [
    { path: nroPath, size: release.nro.length },
    { path: `${ROOT}/LICENSES.txt`, size: release.licenses.length },
    { path: `${ROOT}/deko3d_glsl.bin`, size: deko3d.length },
    ...copied.map((e) => ({ path: e.path, size: e.file.size })),
  ];
  onSize(zipSize(entries));
  log(t('packing'));
  const zip = new ZipWriter(sink);
  await zip.addBytes(nroPath, release.nro);
  await zip.addBytes(`${ROOT}/LICENSES.txt`, release.licenses);
  await zip.addBytes(`${ROOT}/deko3d_glsl.bin`, deko3d);
  for (const e of copied) {
    await zip.addFile(e.path, e.file.size, chunksOf(e.file), onChunk);
  }
  await zip.finish();
  progress(1);
  log(t('done'));
  return { version: build.version, dlc: dlc.length, update };
}
