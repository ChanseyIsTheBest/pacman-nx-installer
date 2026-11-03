// Builds the pacman-nx.zip package from the player's own copy of the game.
//
// The game comes as its Xbox Live Arcade package (read in place, nothing is extracted to disk) or as a folder it was
// extracted into. The zip holds the Switch build (pacman-nx.nro) and its licenses, the shaders made from the game's own
// files (deko3d_glsl.bin), the game files (game_root/) and, when chosen, the DLC package (the game installs it from dlc/
// at its first start). The settings file, pacman.toml, is written by the game at its first start, so an update never
// replaces the player's settings.

import { readXexImage } from './xex.js';
import { CONTENT_DLC, CONTENT_GAME, StfsPackage, readStfsHeader } from './stfs.js';
import { imageContainers, sha256 } from './shaders.js';
import { buildDeko3dPackage } from './deko3d.js';
import { ZipWriter, zipSize } from './zip.js';
import { t } from './i18n.js';

const CHUNK = 16 * 1024 * 1024;
const ROOT = 'pacman-nx';
const TITLE_ID = 0x58410a8c;
// files whose header is read to find the DLC packages in a chosen folder (packages have no extension)
const MAX_CANDIDATES = 256;

async function* chunksOf(file) {
  for (let offset = 0; offset < file.size; offset += CHUNK) {
    yield await file.read(offset, Math.min(CHUNK, file.size - offset));
  }
}

function baseName(path) {
  return path.slice(path.lastIndexOf('/') + 1);
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

// Sorts out what the player chose: files ([{ path, size, read }]) from the "Game package" button (the chosen files) or
// from the "Folder" button (every file under the folder, path relative to it).
// Returns { game, dlc, others }: game = { kind: 'package' | 'folder', name, size, files } or null; dlc = the DLC packages
// ([{ kind: 'package', name, size, read }]); others = the names of content packages of other games.
export async function findGame(chosen) {
  // The packages first, wherever they are in what was chosen (also inside the game folder), by their header: content
  // type 0xD0000 of this game is the game itself, content type 2 its DLC.
  const dlc = [];
  let gamePackage = null;
  let gameHeader = null;
  const taken = new Set();
  const others = [];
  const candidates = chosen
    .filter((f) => f.size >= 0xa000 && !baseName(f.path).includes('.'))
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
    }
  }
  const rest = chosen.filter((f) => !taken.has(f));
  let game = null;
  // The game's package, read in place.
  if (gamePackage) {
    const kept = gameFiles((await StfsPackage.open(gamePackage)).files());
    game = {
      kind: 'package',
      name: gameHeader.displayName || baseName(gamePackage.path),
      size: kept.reduce((sum, f) => sum + f.size, 0),
      files: kept,
    };
  }
  // An extracted game: the shallowest default.xex names its folder, and every file in that folder is a game file.
  if (!game) {
    const executables = rest
      .filter((f) => baseName(f.path).toLowerCase() === 'default.xex')
      .sort((a, b) => a.path.split('/').length - b.path.split('/').length);
    if (executables.length) {
      const prefix = executables[0].path.slice(0, -'default.xex'.length);
      const files = gameFiles(rest
        .filter((f) => f.path.startsWith(prefix))
        .map((f) => ({ ...f, path: f.path.slice(prefix.length) })));
      game = {
        kind: 'folder',
        name: prefix ? baseName(prefix.slice(0, -1)) : '',
        size: files.reduce((sum, f) => sum + f.size, 0),
        files,
      };
    }
  }
  return { game, dlc, others };
}

// Identifies the build of this game by the SHA-256 of default.xex. Returns { xex, xexHash, build (null when none) }.
export async function identifyGame(files, manifest) {
  const xexFile = files.find((f) => f.path.toLowerCase() === 'default.xex');
  if (!xexFile) {
    const error = new Error(t('noGame'));
    error.code = 'noGame';
    throw error;
  }
  const xex = await xexFile.read(0, xexFile.size);
  const xexHash = await sha256(xex);
  const build = manifest.builds.find((b) => b.xex_sha256 === xexHash) || null;
  return { xex, xexHash, build };
}

// The game's shader containers, as the build's entry lists them: those stored in default.xex, by their SHA-256. The game
// makes 4 more at run time from HLSL with its own D3DX; they are in none of its files, so they are built into the NRO.
export async function gameContainers(xex, deko3d, lzx) {
  const image = (await readXexImage(xex, lzx)).image;
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
// from the containers in the game's files (lib/deko3d.js) and checked against the build's manifest entry ("deko3d": {
// shaders: [names], image_sha256: [...], package_sha256 }). modules: { lzx, renutHlsl, dxc, spirvCross };
// renutCommon: Renut's shader_common.h.
export async function makeDeko3dPackage(xex, build, modules, renutCommon, log = () => {}) {
  const containers = await gameContainers(xex, build.deko3d, lzxStep(modules.lzx));
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
// modules: { dxc, lzx, renutHlsl, spirvCross } instantiated Emscripten modules (one object each)
// sink: { write(Uint8Array), close() } receiving the zip file
// onSize(bytes) is called with the exact size of the zip before the first byte is written.
// update: only the program, its licenses and the shaders (and the DLC when chosen), for a folder already on the SD card.
export async function createPackage(chosen, release, modules, sink, log = () => {}, progress = () => {},
  onSize = () => {}, { update = false } = {}) {
  const { game, dlc } = chosen;
  if (!game) {
    throw new Error(t('noGame'));
  }
  const { xex, xexHash, build } = await identifyGame(game.files, release.manifest);
  if (!build) {
    throw new Error(t('notSupportedYet', { hash: xexHash }));
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
  const deko3d = await makeDeko3dPackage(xex, build, modules, release.renutShaderCommon, log);

  const gameEntries = update ? [] : game.files.map((f) => ({ path: `${ROOT}/game_root/${f.path}`, file: f }));
  const dlcFiles = dlc.map((d) => ({ path: `${ROOT}/dlc/${d.name}`, file: d }));
  const total = [...gameEntries, ...dlcFiles].reduce((sum, e) => sum + e.file.size, 0) || 1;
  let done = 0;
  const onChunk = (chunk) => {
    done += chunk.length;
    progress(done / total);
  };
  if (!update) {
    const bytes = game.files.reduce((sum, f) => sum + f.size, 0);
    log(t(game.files.length === build.game_files && bytes === build.game_bytes ? 'gameIdentical' : 'gameDifferent'));
  }

  const nroPath = `${ROOT}/${build.nro}`;
  const entries = [
    { path: nroPath, size: release.nro.length },
    { path: `${ROOT}/LICENSES.txt`, size: release.licenses.length },
    { path: `${ROOT}/deko3d_glsl.bin`, size: deko3d.length },
    ...gameEntries.map((e) => ({ path: e.path, size: e.file.size })),
    ...dlcFiles.map((e) => ({ path: e.path, size: e.file.size })),
  ];
  onSize(zipSize(entries));
  log(t('packing'));
  const zip = new ZipWriter(sink);
  await zip.addBytes(nroPath, release.nro);
  await zip.addBytes(`${ROOT}/LICENSES.txt`, release.licenses);
  await zip.addBytes(`${ROOT}/deko3d_glsl.bin`, deko3d);
  for (const e of [...gameEntries, ...dlcFiles]) {
    await zip.addFile(e.path, e.file.size, chunksOf(e.file), onChunk);
  }
  await zip.finish();
  progress(1);
  log(t('done'));
  return { version: build.version, dlc: dlc.length, update };
}
