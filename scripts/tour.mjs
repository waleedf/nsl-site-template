#!/usr/bin/env node
/**
 * Write the guided-tour file for this site. The tour itself is the nsl-tour
 * package and is never copied into the site: this only drafts
 * tour/<slug>.tour.json with the template's built-in stops
 *
 *   Instant Text  → #inquiry   (the quote form, on the home page)
 *   Review Boost  → #reviews   (only when business.json has a real rating)
 *   Local Reach   → #services  (with links to the first two service pages)
 *
 * and prints the nsl-tour commands to check and publish it.
 *   npm run tour              write the draft here
 *   npm run tour -- --install also copy it into ~/Documents/code/nsl-tour/tours/
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadBusiness, paths } from '../src/lib/site.mjs';
import { serviceHeader } from '../src/lib/copy.mjs';

const b = loadBusiness();
const site = `/${b.slug}/`;
const stops = [
  { capability: 'instant-text', highlight: '#inquiry .card' },
  ...(b.reviews ? [{ capability: 'review-boost', highlight: '#reviews .card' }] : []),
  {
    capability: 'local-reach',
    highlight: '#services',
    links: b.services.slice(0, 2).map((s) => ({ label: serviceHeader(b, s), href: site + paths.service(s) })),
  },
];
const tour = {
  tourVersion: '1.0.0',
  slug: b.slug,
  business: b.name,
  site,
  wording: b.tour.wording,
  stops,
  ...(b.reviews?.url ? { reviewLink: b.reviews.url } : {}),
  personalizeFromLink: false,
  cards: {},
};

mkdirSync('tour', { recursive: true });
const file = join('tour', `${b.slug}.tour.json`);
writeFileSync(file, `${JSON.stringify(tour, null, 2)}\n`);
console.log(`Wrote ${file}`);
if (!b.reviews) console.log('No real review rating in business.json, so there is no Review Boost stop. Add "reviews" when the business has one.');

const tourRepo = join(homedir(), 'Documents', 'code', 'nsl-tour');
if (process.argv.includes('--install')) {
  if (!existsSync(join(tourRepo, 'tours'))) { console.error(`No nsl-tour checkout at ${tourRepo}.`); process.exit(1); }
  copyFileSync(file, join(tourRepo, 'tours', `${b.slug}.tour.json`));
  console.log(`Copied into ${tourRepo}/tours/. Check the tour file's "tourVersion" against \`nsl-tour list\` before checking.`);
}
const cli = `node ${tourRepo}/bin/nsl-tour.mjs`;
console.log(`
Next (the site must already be live at https://try.northshorelabs.dev${site} — npm run deploy:try -- --yes):
  ${cli} check ${b.slug}            must end in PASS
  ${cli} publish --yes              only with Waleed's go-ahead
Tour link: https://try.northshorelabs.dev/tour/${b.slug}/`);
