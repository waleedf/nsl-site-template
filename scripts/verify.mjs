#!/usr/bin/env node
/**
 * The completion gate for a Close the Gap site. Reads the built dist/ and
 * fails unless every website has, by default:
 *
 *   - a service landing page for every service, with what / why / how / cost /
 *     why-us sections and an answer-shaped FAQ (3+ questions, matching markup)
 *   - a location page for every town, with a map
 *   - a service-in-town page for every pair the business really does, with a
 *     map and FAQ
 *   - at least three guides: one comparison, one list, one how-to, each
 *     linking to a service page from its body
 *   - a primary action reaching a working quote form, and a second, quieter
 *     sign-up, on every page
 *   - internal linking: no orphans, every page within 3 clicks of the home
 *     page, service <-> town pages linked both ways, no broken links, no
 *     "learn more" link text, every link under the site's base path
 *
 * Placeholders (lorem, missing copy) are allowed in a preview and counted.
 * `--production` additionally fails on placeholders, sample data, unapproved
 * giveaway rules and any leftover noindex.
 *
 * Writes verification/report.json and verification/VERIFICATION.md — the
 * evidence the playbook's completion gate asks for.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parse } from 'node-html-parser';
import { combosOf, expectedPages, loadBusiness, nearby, paths, relatedServices } from '../src/lib/site.mjs';
import { GUIDE_TYPES } from '../src/lib/schema.mjs';

const args = process.argv.slice(2);
const production = args.includes('--production');
const opt = (name, fallback) => args.find((a, i) => args[i - 1] === name) ?? fallback;
const DIST = resolve(opt('--dist', 'dist'));
const OUT = resolve(opt('--out', 'verification'));
const MAX_DEPTH = 3;
const BANNED_TEXT = /^(learn more|click here|read more|more|here|this|link|details|go|see more)$/i;

const errors = [];
const warnings = [];
const err = (page, rule, detail) => errors.push({ page, rule, detail });
const warn = (page, rule, detail) => warnings.push({ page, rule, detail });

if (!existsSync(join(DIST, '.nsl-build.json'))) {
  console.error(`No build found in ${relative(process.cwd(), DIST)}/. Run "npm run check" (preview) or "npm run check:production".`);
  process.exit(1);
}
const build = JSON.parse(readFileSync(join(DIST, '.nsl-build.json'), 'utf8'));
const b = loadBusiness();
const base = build.base;
const at = (p) => base + p;

if (production && build.mode !== 'production') {
  console.error('This is a preview build. Run "npm run check:production" to build and verify for production.');
  process.exit(1);
}

// ---- Read every built page -------------------------------------------------
function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '_astro' ? [] : htmlFiles(full);
    return name.endsWith('.html') ? [full] : [];
  });
}

const pages = new Map();
for (const file of htmlFiles(DIST)) {
  const rel = relative(DIST, file).split(sep).join('/');
  const url = rel === '404.html' ? at('404.html') : at(rel.replace(/index\.html$/, ''));
  const root = parse(readFileSync(file, 'utf8'));
  const type = root.querySelector('meta[name="nsl:page"]')?.getAttribute('content') ?? null;
  const linksIn = (el, where) => (el ? el.querySelectorAll('a[href]').map((a) => ({ href: a.getAttribute('href'), text: a.text.trim(), label: a.getAttribute('aria-label'), where })) : []);
  const main = root.querySelector('main');
  const links = [
    ...linksIn(root.querySelector('header.site-header'), 'chrome'),
    ...linksIn(main, 'content'),
    ...linksIn(root.querySelector('footer.site-footer'), 'chrome'),
  ];
  pages.set(url, { url, file: rel, root, main, type, links, placeholders: 0 });
}

// A link is internal when it is root-relative or relative. Returns the page
// URL it lands on (query and hash removed), or null for external / tel / mailto.
const internalTarget = (href) => {
  if (/^(https?:)?\/\//i.test(href) || /^(tel|mailto|sms):/i.test(href)) return null;
  if (href.startsWith('#')) return null;
  return href.split('#')[0].split('?')[0];
};
const assetExists = (path) => existsSync(join(DIST, path.slice(base.length)));

// ---- Per-page checks -------------------------------------------------------
const formOn = (page) => page?.root.querySelector('form[data-form="inquiry"]');
const ctaTypes = new Set(['home', 'service', 'location', 'combo', 'guide', 'index']);
const needsSecondary = new Set(['home', 'service', 'location', 'combo', 'guide', 'index', 'contact']);

const faqCheck = (page) => {
  const visible = page.root.querySelectorAll('[data-section="faq"] [data-faq-q]').map((q) => q.text.trim());
  if (visible.length < 3) err(page.url, 'faq', `needs at least 3 answer-shaped questions, has ${visible.length}`);
  const ld = page.root.querySelectorAll('script[type="application/ld+json"]').map((s) => JSON.parse(s.text)).find((x) => x['@type'] === 'FAQPage');
  if (!ld) return err(page.url, 'faq-markup', 'FAQPage markup missing');
  const marked = ld.mainEntity.map((q) => q.name);
  if (marked.length !== visible.length || marked.some((q, i) => q !== visible[i])) err(page.url, 'faq-markup', 'FAQPage markup does not match the visible questions');
};

const contentLinksTo = (page, target) => page.links.some((l) => l.where === 'content' && internalTarget(l.href) === target);

for (const page of pages.values()) {
  const { url, root, main, type } = page;
  if (!type) { err(url, 'page-type', 'missing <meta name="nsl:page">'); continue; }

  const h1s = root.querySelectorAll('h1');
  if (h1s.length !== 1) err(url, 'h1', `needs exactly one <h1>, has ${h1s.length}`);
  if (!root.querySelector('title')?.text.trim()) err(url, 'title', 'missing <title>');
  if (!root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim()) err(url, 'description', 'missing meta description');
  if (type !== '404' && !root.querySelector('link[rel="canonical"]')) err(url, 'canonical', 'missing canonical link');

  const noindex = /noindex/i.test(root.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '');
  if (build.mode === 'preview' && !noindex) err(url, 'noindex', 'preview pages must be noindex');
  if (build.mode === 'production' && noindex) err(url, 'noindex', 'production page still says noindex');

  if (!['home', '404'].includes(type) && !root.querySelector('nav.crumbs')) err(url, 'breadcrumbs', 'missing breadcrumbs');

  // Primary action: must reach a working quote form, on this page or another.
  if (ctaTypes.has(type)) {
    const cta = main?.querySelector('a[data-cta="primary"]');
    if (!cta) err(url, 'primary-cta', 'no primary call to action in the page content');
    else {
      const href = cta.getAttribute('href');
      const ok = href.startsWith('#')
        ? !!root.querySelector(`${href} form[data-form="inquiry"], form${href}[data-form="inquiry"]`)
        : !!formOn(pages.get(internalTarget(href)));
      if (!ok) err(url, 'primary-cta', `call to action "${cta.text.trim()}" does not reach a quote form (${href})`);
    }
  }
  if (type === 'contact' && !formOn(page)) err(url, 'form', 'contact page has no quote form');
  if (needsSecondary.has(type) && !root.querySelector('form[data-cta="secondary"]')) err(url, 'secondary-cta', 'no secondary sign-up');

  for (const form of root.querySelectorAll('form[data-form="inquiry"]')) {
    if (!form.getAttribute('action')) err(url, 'form', 'quote form has no action');
    for (const name of ['name', 'phone', 'message']) {
      const field = form.querySelector(`[name="${name}"]`);
      if (!field || !field.hasAttribute('required')) err(url, 'form', `quote form field "${name}" missing or not required`);
    }
  }

  // Links: under the base, resolvable, named.
  for (const l of page.links) {
    const target = internalTarget(l.href);
    if (!l.text && !l.label) err(url, 'link-text', `empty link text → ${l.href}`);
    if (BANNED_TEXT.test(l.text)) err(url, 'link-text', `"${l.text}" doesn't name the page it opens → ${l.href}`);
    if (target === null) continue;
    if (!target.startsWith(base)) { err(url, 'link-base', `link must start with ${base}: ${l.href}`); continue; }
    if (!pages.has(target) && !assetExists(target)) err(url, 'broken-link', `${l.href} does not exist in the build`);
  }

  // Placeholders: allowed in a preview, counted; production fails on any.
  // A marked block counts once; lorem typed straight into a guide counts too.
  const marked = main?.querySelectorAll('[data-placeholder]') ?? [];
  const lorem = (t) => (t.match(/lorem ipsum/gi) ?? []).length;
  page.placeholders = marked.length + lorem(main?.text ?? '') - marked.reduce((n, el) => n + lorem(el.text), 0);

  if (type === 'service') {
    for (const s of ['what', 'why', 'how', 'why-us']) if (!root.querySelector(`[data-section="${s}"]`)) err(url, 'service-sections', `missing "${s}" section`);
    faqCheck(page);
  }
  if ((type === 'location' || type === 'combo') && !root.querySelector('[data-map]')) err(url, 'map', 'location pages need a map');
  if (type === 'combo') faqCheck(page);
  if (type === 'guide') {
    const kind = root.querySelector('meta[name="nsl:guide-type"]')?.getAttribute('content');
    if (!GUIDE_TYPES.includes(kind)) err(url, 'guide-type', `guide type "${kind}" is not one of ${GUIDE_TYPES.join(', ')}`);
    if (!root.querySelector('time[datetime]')) err(url, 'guide-date', 'guide has no updated date');
    const bodyLinks = root.querySelectorAll('[data-section="body"] a[href]').map((a) => internalTarget(a.getAttribute('href')));
    if (!bodyLinks.some((t) => pages.get(t)?.type === 'service' || pages.get(t)?.type === 'combo')) err(url, 'guide-links', 'guide body must link to a service page in its own words');
  }
}

// ---- Site-wide: required pages and the link graph --------------------------
const expected = expectedPages(b);
for (const e of expected) {
  const page = pages.get(at(e.path));
  if (!page) err(at(e.path), 'missing-page', `expected ${e.type} page was not built`);
  else if (page.type !== e.type) err(at(e.path), 'page-type', `expected type ${e.type}, built as ${page.type}`);
}
const combos = combosOf(b);
const guides = [...pages.values()].filter((p) => p.type === 'guide');
const guideTypes = new Set(guides.map((p) => p.root.querySelector('meta[name="nsl:guide-type"]')?.getAttribute('content')));
if (!combos.length) err('(site)', 'combos', 'no service-in-town pages: check locations.services');
if (guides.length < 3) err('(site)', 'guides', `needs at least 3 guides, has ${guides.length}`);
for (const t of GUIDE_TYPES) if (!guideTypes.has(t)) err('(site)', 'guides', `needs at least one "${t}" guide`);
if (b.services.length !== 10) warn('(site)', 'top-10', `${b.services.length} services; the rule is the top 10. Record why if the business really has fewer.`);
if (b.locations.length !== 10) warn('(site)', 'top-10', `${b.locations.length} locations; the rule is the top 10. Record why if the business really serves fewer.`);
const guessed = [...b.services, ...b.locations].filter((x) => x.source === 'guess').map((x) => x.name);
if (guessed.length) warn('(site)', 'sources', `${guessed.length} services/locations are marked "guess": ${guessed.join(', ')}`);

// Both directions between a service, a town and the page for the pair.
for (const { service: s, location: l } of combos) {
  const combo = at(paths.combo(s, l));
  const sPage = pages.get(at(paths.service(s)));
  const lPage = pages.get(at(paths.location(l)));
  const cPage = pages.get(combo);
  if (sPage && !contentLinksTo(sPage, combo)) err(sPage.url, 'reciprocal', `service page must link to ${combo}`);
  if (lPage && !contentLinksTo(lPage, combo)) err(lPage.url, 'reciprocal', `location page must link to ${combo}`);
  if (cPage && !contentLinksTo(cPage, at(paths.service(s)))) err(combo, 'reciprocal', 'must link up to its service page');
  if (cPage && !contentLinksTo(cPage, at(paths.location(l)))) err(combo, 'reciprocal', 'must link up to its location page');
}
for (const s of b.services) {
  const page = pages.get(at(paths.service(s)));
  if (page && b.services.length > 1 && !relatedServices(b, s).some((r) => contentLinksTo(page, at(paths.service(r))))) warn(page.url, 'related', 'links to no related service');
}
for (const l of b.locations) {
  const page = pages.get(at(paths.location(l)));
  if (page && b.locations.length > 1 && !nearby(b, l).some((n) => contentLinksTo(page, at(paths.location(n))))) warn(page.url, 'nearby', 'links to no nearby town');
}

// Orphans: every page needs links from other pages; landing pages need at
// least one from page content, because sitewide menu links count for less.
const inbound = new Map([...pages.keys()].map((u) => [u, { any: 0, content: 0 }]));
for (const page of pages.values()) {
  for (const l of page.links) {
    const t = internalTarget(l.href);
    if (t === null || t === page.url || !inbound.has(t)) continue;
    inbound.get(t).any++;
    if (l.where === 'content') inbound.get(t).content++;
  }
}
for (const page of pages.values()) {
  if (['home', '404'].includes(page.type)) continue;
  const n = inbound.get(page.url);
  if (!n.any) err(page.url, 'orphan', 'no other page links here');
  else if (['service', 'location', 'combo', 'guide'].includes(page.type) && !n.content) err(page.url, 'orphan', 'only menu/footer links point here; link it from page content too');
}

// Click depth from the home page.
const depth = new Map([[at(''), 0]]);
const queue = [at('')];
while (queue.length) {
  const u = queue.shift();
  for (const l of pages.get(u)?.links ?? []) {
    const t = internalTarget(l.href);
    if (t && pages.has(t) && !depth.has(t)) { depth.set(t, depth.get(u) + 1); queue.push(t); }
  }
}
for (const page of pages.values()) {
  if (page.type === '404') continue;
  const d = depth.get(page.url);
  if (d === undefined) err(page.url, 'depth', 'not reachable from the home page');
  else if (d > MAX_DEPTH) err(page.url, 'depth', `${d} clicks from the home page (max ${MAX_DEPTH})`);
}

// Sitemap lists every page.
const sitemapLocs = new Set(
  readdirSync(DIST).filter((f) => /^sitemap-\d+\.xml$/.test(f))
    .flatMap((f) => [...readFileSync(join(DIST, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname)),
);
if (!sitemapLocs.size) err('(site)', 'sitemap', 'no sitemap built');
for (const page of pages.values()) if (page.type !== '404' && !sitemapLocs.has(page.url)) err(page.url, 'sitemap', 'missing from the sitemap');

// ---- Production-only gates -------------------------------------------------
const placeholderTotal = [...pages.values()].reduce((n, p) => n + p.placeholders, 0);
if (production) {
  if (b.example) err('(site)', 'sample-data', 'site/business.json still holds the sample business (example: true)');
  for (const p of pages.values()) if (p.placeholders) err(p.url, 'placeholder', `${p.placeholders} placeholder(s) still on the page`);
  if (b.secondary.kind === 'giveaway' && !b.secondary.rulesApproved) err('(site)', 'giveaway-rules', 'giveaway rules not approved (secondary.rulesApproved)');
  if (!b.form.endpoint) warn('(site)', 'form', 'forms post to <base>api/lead: the production host must run worker/index.mjs with NSL_INTAKE_KEY, or set form.endpoint');
} else if (b.example) {
  warn('(site)', 'sample-data', 'site/business.json still holds the sample business (example: true)');
}

// ---- Report -----------------------------------------------------------------
const byType = {};
for (const p of pages.values()) byType[p.type] = (byType[p.type] ?? 0) + 1;
const linkCount = [...pages.values()].reduce((n, p) => n + p.links.length, 0);
const maxDepth = Math.max(...[...depth.values()]);
const passed = errors.length === 0;
const topPlaceholders = [...pages.values()].filter((p) => p.placeholders).sort((x, y) => y.placeholders - x.placeholders);

const report = {
  result: passed ? 'PASS' : 'FAIL',
  checkedAt: new Date().toISOString(),
  mode: build.mode, gate: production ? 'production' : 'preview', base, site: build.site, builtAt: build.builtAt,
  business: b.name, example: b.example,
  services: b.services.map((s) => ({ id: s.id, name: s.name, keyword: s.keyword, source: s.source })),
  locations: b.locations.map((l) => ({ id: l.id, name: `${l.name}, ${l.region}`, source: l.source, services: l.services === 'all' ? b.services.length : l.services.length })),
  pages: byType, combos: combos.length, guides: guides.map((p) => ({ url: p.url, type: p.root.querySelector('meta[name="nsl:guide-type"]')?.getAttribute('content') })),
  links: { internalLinks: linkCount, maxDepth },
  placeholders: { total: placeholderTotal, pages: topPlaceholders.length },
  errors, warnings,
};
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));

const md = [
  `# Verification — ${b.name}`,
  '',
  `**${report.result}** · ${report.gate} gate · ${build.mode} build at \`${build.site}${base}\` · built ${build.builtAt} · checked ${report.checkedAt}`,
  '',
  '## Services (ordered as in business.json)',
  '', '| # | Service | Buyer keyword | Source |', '|---|---|---|---|',
  ...b.services.map((s, i) => `| ${i + 1} | ${s.name} | ${s.keyword} | ${s.source} |`),
  '', '## Locations', '', '| # | Location | Services offered | Source |', '|---|---|---|---|',
  ...report.locations.map((l, i) => `| ${i + 1} | ${l.name} | ${l.services} | ${l.source} |`),
  '', '## Pages built', '',
  ...Object.entries(byType).map(([t, n]) => `- ${t}: ${n}`),
  `- service-in-town pairs: ${combos.length}`,
  `- guides: ${guides.map((g) => g.root.querySelector('meta[name="nsl:guide-type"]')?.getAttribute('content')).join(', ')}`,
  '', '## Internal linking', '',
  `- ${linkCount} internal links checked; deepest page is ${maxDepth} clicks from home (max ${MAX_DEPTH})`,
  '- every service ↔ town ↔ service-in-town link checked both ways; no orphans; every link under the base path',
  '', '## Conversion', '',
  '- every landing page has a primary action that reaches a quote form, and a secondary sign-up',
  `- secondary sign-up: ${b.secondary.kind}`,
  `- form endpoint: ${b.form.endpoint ?? `${base}api/lead (this site's Worker)`}. Checked statically; no live inquiries were sent.`,
  '', '## Placeholders', '',
  `- ${placeholderTotal} placeholder block(s) on ${topPlaceholders.length} page(s)${production ? '' : ' — allowed in a preview, blocked in production'}`,
  ...topPlaceholders.slice(0, 10).map((p) => `  - ${p.url}: ${p.placeholders}`),
  '', `## Errors (${errors.length})`, '',
  ...(errors.length ? errors.map((e) => `- \`${e.page}\` **${e.rule}**: ${e.detail}`) : ['None.']),
  '', `## Warnings (${warnings.length})`, '',
  ...(warnings.length ? warnings.map((w) => `- \`${w.page}\` **${w.rule}**: ${w.detail}`) : ['None.']),
  '',
].join('\n');
writeFileSync(join(OUT, 'VERIFICATION.md'), md);

console.log(`${report.result}: ${pages.size} pages (${Object.entries(byType).map(([t, n]) => `${n} ${t}`).join(', ')}), ${combos.length} service-in-town, ${linkCount} links, max depth ${maxDepth}, ${placeholderTotal} placeholders.`);
for (const e of errors.slice(0, 40)) console.log(`  ✗ ${e.page} [${e.rule}] ${e.detail}`);
if (errors.length > 40) console.log(`  … ${errors.length - 40} more in the evidence file`);
for (const w of warnings) console.log(`  ! ${w.page} [${w.rule}] ${w.detail}`);
console.log(`Evidence: ${relative(process.cwd(), join(OUT, 'VERIFICATION.md'))}`);
process.exit(passed ? 0 : 1);
