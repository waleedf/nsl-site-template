#!/usr/bin/env node
/**
 * Start a new client site from this template.
 *
 *   npm run new -- <folder> --slug <slug> --name "Business Name"
 *
 * Copies the template (no node_modules, builds or git history) into <folder>,
 * sets the slug and name, and leaves "example": true so nothing can ship to
 * production until the sample services, towns and guides are replaced.
 * Then: cd <folder> && npm install && follow AGENTS.md.
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve, sep } from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => args[args.indexOf(name) + 1];
const target = args.find((a, i) => !a.startsWith('--') && !['--slug', '--name'].includes(args[i - 1]));
const slug = opt('--slug');
const name = opt('--name');
if (!target || !slug || !name || args.indexOf('--slug') < 0 || args.indexOf('--name') < 0) {
  console.error('Usage: npm run new -- <folder> --slug <slug> --name "Business Name"');
  process.exit(1);
}
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { console.error('Slug must be lowercase words joined by dashes.'); process.exit(1); }

const ROOT = process.cwd();
const dest = resolve(ROOT, target);
if (existsSync(dest)) { console.error(`${dest} already exists. Pick a new folder.`); process.exit(1); }
if (dest.startsWith(ROOT + sep)) { console.error('Create the new site outside the template folder, e.g. ../my-client-site'); process.exit(1); }
const SKIP = new Set(['node_modules', 'dist', '.astro', '.deploy', '.wrangler', '.git', 'verification', 'tour']);
cpSync(ROOT, dest, { recursive: true, filter: (src) => !SKIP.has(basename(src)) || src === ROOT });

const file = join(dest, 'site', 'business.json');
const data = JSON.parse(readFileSync(file, 'utf8'));
Object.assign(data, { example: true, slug, name });
writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
const pkg = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8'));
pkg.name = `site-${slug}`;
writeFileSync(join(dest, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`New site for ${name} in ${dest}
  cd "${dest}" && npm install
Then follow AGENTS.md: replace the sample services, towns and guides in site/, run npm run check.
Keep the repo private (git init; gh repo create <owner>/${slug}-site --private).`);
