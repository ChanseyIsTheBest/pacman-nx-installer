// Writes the build's entry of release/manifest.json for a release of pacman-nx: the NRO's SHA-256 and size, and the
// fingerprints of the game and of the shaders made from your copy with the page's own code ("deko3d": the shaders, their
// containers, the package's SHA-256). Test the NRO with exactly the deko3d_glsl.bin this leaves in release/.
// Usage: node test/release_node.mjs <game package or folder> <pacman-nx.nro> [--version <x.y.z>] [--write]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chosenOnDisk, loadModules, root } from './node_files.mjs';
import { findGame, gameContainers, identifyGame, lzxStep } from '../lib/installer.js';
import { buildDeko3dPackage } from '../lib/deko3d.js';
import { imageContainers } from '../lib/shaders.js';
import { readXexImage } from '../lib/xex.js';

const args = process.argv.slice(2);
const take = (flag) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args.splice(at, 2)[1] : null;
};
const has = (flag) => {
  const at = args.indexOf(flag);
  return at >= 0 ? (args.splice(at, 1), true) : false;
};
const version = take('--version') || '1.0.0';
const write = has('--write');
const [input, nroPath] = args;
if (!input || !nroPath) {
  console.error('usage: node test/release_node.mjs <game package or folder> <pacman-nx.nro> [--version <x.y.z>] [--write]');
  process.exit(1);
}
// Every container stored in default.xex (the 13 of the game's 17 shaders that are not made at run time).
async function imageList(xex, lzx) {
  const image = (await readXexImage(xex, lzx)).image;
  const hashes = new Set();
  for (const c of imageContainers(image)) {
    hashes.add(createHash('sha256').update(c.bytes).digest('hex'));
  }
  return { image_sha256: [...hashes].sort() };
}

const sha = (b) => createHash('sha256').update(b).digest('hex');

const { game } = await findGame(chosenOnDisk([input]));
if (!game) {
  throw new Error(`no game in ${input}`);
}
const modules = await loadModules();
const { xex, xexHash } = await identifyGame(game.files, { builds: [] });
const list = await imageList(xex, lzxStep(modules.lzx));
const containers = await gameContainers(xex, list, lzxStep(modules.lzx));
const common = fs.readFileSync(path.join(root, 'renut_shader_common.h'));
const { package: pkg, shaders } = await buildDeko3dPackage(containers, null, modules, common);
const nro = fs.readFileSync(nroPath);
const build = {
  edition: 'Xbox Live Arcade (title 58410A8C)',
  version,
  xex_sha256: xexHash,
  nro: 'pacman-nx.nro',
  nro_sha256: sha(nro),
  nro_size: nro.length,
  game_files: game.files.length,
  game_bytes: game.files.reduce((sum, f) => sum + f.size, 0),
  deko3d: {
    shaders: shaders.map((s) => s.name),
    image_sha256: list.image_sha256,
    package_sha256: sha(pkg),
    package_size: pkg.length,
  },
};
console.log(`${build.edition} ${version}: NRO ${build.nro_sha256} (${build.nro_size} bytes)`);
console.log(`game: ${build.game_files} files, ${build.game_bytes} bytes; default.xex ${xexHash}`);
console.log(`shaders: ${shaders.length}, package ${build.deko3d.package_sha256} (${pkg.length} bytes)`);
if (write) {
  const manifestPath = path.join(root, 'release/manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ version: 1, builds: [build] }, null, 2) + '\n');
  fs.copyFileSync(nroPath, path.join(root, 'release', build.nro));
  fs.writeFileSync(path.join(root, 'release', 'deko3d_glsl.bin'), pkg);
  console.log('written: release/manifest.json; the NRO and deko3d_glsl.bin to release/ for local tests (neither is ' +
    'committed)');
} else {
  console.log('(dry run: add --write to save)');
}
