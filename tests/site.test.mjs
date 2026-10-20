import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { combosOf, expectedPages, loadBusiness, makeHref, nearby, relatedServices } from '../src/lib/site.mjs';
import { comboHeader, faqFor, locationHeader, serviceHeader } from '../src/lib/copy.mjs';

const sample = JSON.parse(readFileSync('site/business.json', 'utf8'));
const dir = mkdtempSync(join(tmpdir(), 'nsl-site-'));
const load = (mutate) => {
  const data = structuredClone(sample);
  mutate?.(data);
  const file = join(dir, `${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(file, JSON.stringify(data));
  return loadBusiness(file);
};

test('the sample business is valid', () => {
  const b = load();
  assert.equal(b.services.length, 6);
  assert.equal(b.locations.length, 6);
});

test('one service-in-town page per service each town really offers', () => {
  const b = load();
  // 4 towns offer all 6, Lake Forest offers 4, Mission Viejo 3.
  assert.equal(combosOf(b).length, 6 * 4 + 4 + 3);
  assert.ok(!combosOf(b).some((c) => c.location.id === 'mission-viejo' && c.service.id === 'pressure-washing'));
});

test('a pair marked skip gets no page', () => {
  const b = load((d) => d.combos.push({ service: 'solar-panel-cleaning', location: 'irvine', skip: true }));
  assert.ok(!combosOf(b).some((c) => c.location.id === 'irvine' && c.service.id === 'solar-panel-cleaning'));
});

test('a pair that would repeat the town page header is dropped, not duplicated', () => {
  const b = load((d) => { d.trade = 'Window Cleaning'; });
  const irvine = b.locations.find((l) => l.id === 'irvine');
  assert.equal(locationHeader(b, irvine), 'Window Cleaning in Irvine');
  assert.ok(!combosOf(b).some((c) => c.location.id === 'irvine' && c.service.id === 'window-cleaning'));
});

test('default headers say the search back: "{service} in {place}"', () => {
  const b = load();
  const s = b.services[0];
  const l = b.locations[0];
  assert.equal(serviceHeader(b, s), 'Window Cleaning in Orange County');
  assert.equal(comboHeader(b, s, l), 'Window Cleaning in Irvine');
  assert.equal(locationHeader(b, l), 'Window & Gutter Cleaning in Irvine');
  const custom = load((d) => { d.services[0].header = 'Window Washing in Orange County'; });
  assert.equal(serviceHeader(custom, custom.services[0]), 'Window Washing in Orange County');
});

test('every FAQ has at least three questions and no repeats', () => {
  const b = load();
  for (const s of b.services) {
    const items = faqFor(b, s, b.locations[0]);
    assert.ok(items.length >= 3, s.id);
    assert.equal(new Set(items.map((f) => f.q.toLowerCase())).size, items.length);
  }
});

test('nearby towns are the closest ones, excluding the town itself', () => {
  const b = load();
  const near = nearby(b, b.locations.find((l) => l.id === 'newport-beach'), 2).map((l) => l.id);
  assert.deepEqual(near, ['costa-mesa', 'irvine']);
});

test('related services: named ones first, then filled from the rest', () => {
  const b = load();
  const r = relatedServices(b, b.services.find((s) => s.id === 'window-cleaning')).map((s) => s.id);
  assert.deepEqual(r.slice(0, 2), ['screen-repair', 'hard-water-stain-removal']);
  assert.equal(r.length, 3);
});

test('broken references are rejected with a readable message', () => {
  assert.throws(() => load((d) => { d.services[0].related = ['nope']; }), /unknown service "nope"/);
  assert.throws(() => load((d) => { d.locations[0].services = ['nope']; }), /unknown service "nope"/);
  assert.throws(() => load((d) => { d.services[1].id = d.services[0].id; }), /two services use the id/);
  assert.throws(() => load((d) => { d.services[0].source = 'vibes'; }), /services\.0\.source/);
});

test('expected pages include every family the gate requires', () => {
  const b = load();
  const types = new Set(expectedPages(b).map((p) => p.type));
  for (const t of ['home', 'service', 'location', 'combo', 'contact', 'legal']) assert.ok(types.has(t), t);
  const newsletter = load((d) => { d.secondary = { kind: 'newsletter' }; });
  assert.ok(!expectedPages(newsletter).some((p) => p.type === 'legal'));
});

test('links are always under the base path', () => {
  assert.equal(makeHref('/fernbrook/')('services/x/'), '/fernbrook/services/x/');
  assert.equal(makeHref('/fernbrook')('/services/x/'), '/fernbrook/services/x/');
  assert.equal(makeHref('/')(''), '/');
});
