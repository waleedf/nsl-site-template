#!/usr/bin/env node
/**
 * Publish this site as a preview at https://try.northshorelabs.dev/<slug>/.
 *
 *   npm run deploy:try            build + verify + rehearse (wrangler --dry-run). Nothing goes live.
 *   npm run deploy:try -- --yes   the same, then deploy. Only with Waleed's go-ahead.
 *
 * Each preview is its own small Worker ("nsl-site-<slug>") routed to
 * try.northshorelabs.dev/<slug> and /<slug>/*, so publishing one never touches
 * the tour or any other site on try. Before deploying, the live path is
 * checked: a path another Worker already answers is refused. The guided tour
 * is a separate step (npm run tour) and is never copied into the site.
 *
 * The Cloudflare account is wrangler's logged-in account, or
 * CLOUDFLARE_ACCOUNT_ID when set.
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadBusiness } from '../src/lib/site.mjs';

const ROOT = process.cwd();
const yes = process.argv.includes('--yes');
// Shared paths on try that a site slug must never claim, even where they 404 at the top level.
const RESERVED = new Set(['tour', 'api', 'home-services', 'preview', 'services', 'checkout', 'review-demo', 'images', 'data', '_astro', '_runtime', 'start']);

const run = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: ROOT, env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const b = loadBusiness();
if (RESERVED.has(b.slug)) {
  console.error(`"${b.slug}" is a shared path on try.northshorelabs.dev. Pick another slug in site/business.json.`);
  process.exit(1);
}

// A free path answers 404. Anything else must be this site's own earlier deploy.
try {
  const res = await fetch(`https://try.northshorelabs.dev/${b.slug}/`, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
  if (res.status !== 404 && res.headers.get('x-nsl-site') !== b.slug) {
    console.error(`try.northshorelabs.dev/${b.slug}/ already answers (${res.status}) and isn't this site. Pick another slug in site/business.json.`);
    process.exit(1);
  }
} catch (error) {
  console.warn(`Could not check whether /${b.slug}/ is free on try (${error.message}). Continuing; check it before --yes.`);
}

console.log(`\n— building the preview for /${b.slug}/ —`);
run('npm', ['run', '--silent', 'build:preview']);
console.log('\n— verifying —');
run('node', ['scripts/verify.mjs']);

const stage = join(ROOT, '.deploy', 'try');
rmSync(stage, { recursive: true, force: true });
mkdirSync(join(stage, 'assets'), { recursive: true });
// Built files sit at the dist root; on try they must sit under /<slug>/.
cpSync(join(ROOT, 'dist'), join(stage, 'assets', b.slug), { recursive: true, filter: (src) => !src.endsWith('.nsl-build.json') });

const config = {
  name: `nsl-site-${b.slug}`,
  main: resolve(ROOT, 'worker', 'index.mjs'),
  ...(process.env.CLOUDFLARE_ACCOUNT_ID ? { account_id: process.env.CLOUDFLARE_ACCOUNT_ID } : {}),
  compatibility_date: '2026-09-25', // newest date the pinned wrangler's local runtime supports
  workers_dev: false,
  preview_urls: false,
  assets: { directory: './assets', binding: 'ASSETS', run_worker_first: true, html_handling: 'auto-trailing-slash', not_found_handling: '404-page' },
  routes: [
    { pattern: `try.northshorelabs.dev/${b.slug}`, zone_name: 'northshorelabs.dev' },
    { pattern: `try.northshorelabs.dev/${b.slug}/*`, zone_name: 'northshorelabs.dev' },
  ],
  vars: { BASE: `/${b.slug}/`, MODE: 'preview', SITE: b.slug },
  observability: { enabled: true },
};
const configPath = join(stage, 'wrangler.json');
writeFileSync(configPath, JSON.stringify(config, null, 2));

const wrangler = join(ROOT, 'node_modules', '.bin', 'wrangler');
if (!existsSync(wrangler)) { console.error('wrangler is not installed. Run npm install.'); process.exit(1); }
console.log(`\n— ${yes ? 'deploying' : 'rehearsing (dry run)'} nsl-site-${b.slug} —`);
run(wrangler, ['deploy', '--config', configPath, ...(yes ? [] : ['--dry-run'])]);

const url = `https://try.northshorelabs.dev/${b.slug}/`;
if (!yes) {
  console.log(`\nDry run only. Nothing was published. When Waleed says go: npm run deploy:try -- --yes`);
} else {
  console.log(`\nLive: ${url}`);
  console.log(`Forms answer "not connected" until the portal key is set (once per preview):`);
  console.log(`  ${wrangler} secret put NSL_INTAKE_KEY --config ${configPath}`);
  console.log(`Then the tour: npm run tour`);
}
