// Checks how the page sorts out what the player chose, on real files: the packages, extracted folders (each with its own
// name in the path, as a browser gives them), the layout of the SD card, and what is reported when something is missing.
// Usage: node test/choose_node.mjs <game package> <title update package> <DLC package> <game folder> <update folder> <SD folder pacman-nx>
import fs from 'node:fs';
import path from 'node:path';
import { chosenOnDisk, root } from './node_files.mjs';
import { findGame, identifyGame } from '../lib/installer.js';

const [gamePackage, updatePackage, dlcPackage, gameFolder, updateFolder, sdFolder] = process.argv.slice(2);
if (!sdFolder) {
  console.error('usage: node test/choose_node.mjs <game package> <title update package> <DLC package> <game folder> <update folder> <SD folder>');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release/manifest.json'), 'utf8'));
// A folder as the "Add a folder" button gives it: the folder's own name first in every path.
const folder = (dir) => chosenOnDisk([dir]).map((f) => ({ ...f, path: `${path.basename(dir)}/${f.path}` }));
const packageFile = (p) => chosenOnDisk([p]);

let bad = 0;
async function check(name, chosen, want) {
  const found = await findGame(chosen);
  const id = found.game ? await identifyGame(found, manifest) : null;
  const got = {
    game: found.game?.files.length ?? null,
    update: found.update?.files.length ?? null,
    dlc: found.dlc.length,
    build: Boolean(id?.build),
    problems: (id?.problems ?? []).join(','),
  };
  const ok = Object.keys(want).every((k) => got[k] === want[k]);
  bad += ok ? 0 : 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${JSON.stringify(got)}${ok ? '' : ` wanted ${JSON.stringify(want)}`}`);
}

const full = { game: 879, update: 146, build: true, problems: '' };
await check('three packages', [...packageFile(gamePackage), ...packageFile(updatePackage), ...packageFile(dlcPackage)], { ...full, dlc: 1 });
await check('game and update packages', [...packageFile(gamePackage), ...packageFile(updatePackage)], { ...full, dlc: 0 });
await check('two folders', [...folder(gameFolder), ...folder(updateFolder)], { ...full, dlc: 0 });
await check('a game folder and the update package', [...folder(gameFolder), ...packageFile(updatePackage)], { ...full, dlc: 0 });
await check('the update folder only', folder(updateFolder), { game: null, update: 146, build: false });
await check('the game only', packageFile(gamePackage), { game: 879, update: null, build: true, problems: 'noUpdate' });
await check('the SD folder', folder(sdFolder), { ...full, dlc: 1 });
// another title update: the same files with another default.xexp
const other = packageFile(updatePackage);
const wrong = await findGame([...packageFile(gamePackage), ...other]);
const xexp = wrong.update.files.find((f) => f.path.toLowerCase() === 'default.xexp');
const realRead = xexp.read;
xexp.read = async (offset, length) => {
  const bytes = (await realRead(offset, length)).slice();
  bytes[bytes.length - 1] ^= 1;
  return bytes;
};
const id = await identifyGame(wrong, manifest);
const okWrong = id.problems.join(',') === 'updateDifferent';
bad += okWrong ? 0 : 1;
console.log(`${okWrong ? 'ok  ' : 'FAIL'} a changed default.xexp: ${id.problems.join(',')}`);
if (bad) {
  process.exit(1);
}
