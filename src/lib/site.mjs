// Loads site/business.json, checks it, and works out every page the site must
// have. The pages, the internal links and scripts/verify.mjs all read this, so
// adding a service or a town changes every page that should point to it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Business } from './schema.mjs';
import { comboHeader, locationHeader } from './copy.mjs';

export const BUSINESS_FILE = join(process.cwd(), 'site', 'business.json');

export function siteMode() {
  return process.env.SITE_MODE === 'production' ? 'production' : 'preview';
}

export function loadBusiness(file = BUSINESS_FILE) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const parsed = Business.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new Error(`site/business.json is invalid:\n${lines.join('\n')}`);
  }
  checkReferences(parsed.data);
  return parsed.data;
}

let cached;
/** The validated business, loaded once per build. */
export const getBusiness = () => (cached ??= loadBusiness());

function checkReferences(b) {
  const problems = [];
  const dupes = (list, what) => {
    const seen = new Set();
    for (const { id } of list) {
      if (seen.has(id)) problems.push(`two ${what} use the id "${id}"`);
      seen.add(id);
    }
    return seen;
  };
  const serviceIds = dupes(b.services, 'services');
  const locationIds = dupes(b.locations, 'locations');
  for (const s of b.services) {
    for (const r of s.related) {
      if (!serviceIds.has(r)) problems.push(`services.${s.id}.related names unknown service "${r}"`);
      if (r === s.id) problems.push(`services.${s.id}.related names itself`);
    }
  }
  for (const l of b.locations) {
    if (l.services === 'all') continue;
    for (const id of l.services) if (!serviceIds.has(id)) problems.push(`locations.${l.id}.services names unknown service "${id}"`);
  }
  for (const c of b.combos) {
    if (!serviceIds.has(c.service)) problems.push(`combos: unknown service "${c.service}"`);
    if (!locationIds.has(c.location)) problems.push(`combos: unknown location "${c.location}"`);
    const l = b.locations.find((x) => x.id === c.location);
    if (l && l.services !== 'all' && !l.services.includes(c.service)) {
      problems.push(`combos: ${c.service} in ${c.location} is listed, but locations.${c.location}.services does not include it`);
    }
  }
  if (problems.length) throw new Error(`site/business.json has broken references:\n  ${problems.join('\n  ')}`);
}

export const servicesAt = (b, l) => (l.services === 'all' ? b.services : b.services.filter((s) => l.services.includes(s.id)));

/**
 * Every service-in-location page: each service a location offers, minus pairs
 * marked skip, minus a pair whose header would repeat the location page's
 * header (that pair would compete with the location page for the same search).
 */
export function combosOf(b) {
  const out = [];
  for (const l of b.locations) {
    for (const s of servicesAt(b, l)) {
      const override = b.combos.find((c) => c.service === s.id && c.location === l.id);
      if (override?.skip) continue;
      if (comboHeader(b, s, l, override).toLowerCase() === locationHeader(b, l).toLowerCase()) continue;
      out.push({ service: s, location: l, override: override ?? null });
    }
  }
  return out;
}

// Great-circle distance in km, for "nearby areas".
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function nearby(b, l, n = 3) {
  return b.locations
    .filter((x) => x.id !== l.id)
    .map((x) => ({ x, d: distanceKm(l, x) }))
    .sort((p, q) => p.d - q.d)
    .slice(0, n)
    .map((p) => p.x);
}

// Related services: the ones named in the data first, then fill from the rest
// so every service page links sideways even before anyone curates it.
export function relatedServices(b, s, n = 3) {
  const named = s.related.map((id) => b.services.find((x) => x.id === id));
  const rest = b.services.filter((x) => x.id !== s.id && !s.related.includes(x.id));
  return [...named, ...rest].slice(0, n);
}

// Same service, nearest other locations that offer it.
export function sameServiceNearby(b, s, l, n = 3) {
  const offering = new Set(combosOf(b).filter((c) => c.service.id === s.id).map((c) => c.location.id));
  return nearby(b, l, b.locations.length).filter((x) => offering.has(x.id)).slice(0, n);
}

export const paths = {
  home: () => '',
  services: () => 'services/',
  service: (s) => `services/${s.id}/`,
  areas: () => 'areas/',
  location: (l) => `areas/${l.id}/`,
  combo: (s, l) => `areas/${l.id}/${s.id}/`,
  guides: () => 'guides/',
  guide: (id) => `guides/${id}/`,
  contact: () => 'contact/',
  rules: () => 'giveaway-rules/',
};

/** Prefix a site path with the base ("/fernbrook/" on try, "/" in production). */
export function makeHref(base) {
  const b = base.endsWith('/') ? base : `${base}/`;
  return (path = '') => `${b}${path.replace(/^\//, '')}`;
}

/** Every page the build must produce, by type. verify.mjs checks the build against it. */
export function expectedPages(b) {
  const pages = [
    { type: 'home', path: paths.home() },
    { type: 'index', path: paths.services() },
    { type: 'index', path: paths.areas() },
    { type: 'index', path: paths.guides() },
    { type: 'contact', path: paths.contact() },
    ...b.services.map((s) => ({ type: 'service', path: paths.service(s), id: s.id })),
    ...b.locations.map((l) => ({ type: 'location', path: paths.location(l), id: l.id })),
    ...combosOf(b).map((c) => ({ type: 'combo', path: paths.combo(c.service, c.location), service: c.service.id, location: c.location.id })),
  ];
  if (b.secondary.kind === 'giveaway') pages.push({ type: 'legal', path: paths.rules() });
  return pages;
}
