// Packages Duskmail Atoll, an offline browser mail-flight game.
// Run locally with node serve.ts and open http://localhost:8080.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const folders = ['game', 'screenshots'];

for (const folder of folders) {
  const path = relative(join(root, folder), output);
  if (path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path))) {
    throw new Error('The output directory must be outside game/ and screenshots/.');
  }
}
if (output === root) throw new Error('Choose an output directory outside the source root.');

mkdirSync(output, { recursive: true });
for (const folder of folders) {
  cpSync(join(root, folder), join(output, folder), { recursive: true });
}

writeFileSync(join(output, 'dossier.json'), buildDossier(output, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
}));
