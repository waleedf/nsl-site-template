// The gate has to fail when a required piece is missing, not only pass on the
// sample. Each case breaks one thing in a copy of the build and expects that
// exact rule to fire.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const DIST = 'dist';

before(() => {
  const manifest = join(DIST, '.nsl-build.json');
  const isPreview = existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).mode === 'preview';
  if (!isPreview) {
    const r = spawnSync('npm', ['run', '--silent', 'build:preview'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  }
});

function verifyBroken(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'nsl-verify-'));
  const dist = join(dir, 'dist');
  cpSync(DIST, dist, { recursive: true });
  mutate((rel, fn) => {
    const file = join(dist, rel);
    writeFileSync(file, fn(readFileSync(file, 'utf8')));
  }, dist);
  const r = spawnSync('node', ['scripts/verify.mjs', '--dist', dist, '--out', join(dir, 'out')], { encoding: 'utf8' });
  const report = JSON.parse(readFileSync(join(dir, 'out', 'report.json'), 'utf8'));
  rmSync(dir, { recursive: true, force: true });
  return { status: r.status, rules: new Set(report.errors.map((e) => e.rule)), report };
}

test('the untouched sample build passes', () => {
  const { status, report } = verifyBroken(() => {});
  assert.equal(status, 0, JSON.stringify(report.errors.slice(0, 5)));
});

test('a location page without a map fails', () => {
  const { status, rules } = verifyBroken((edit) => edit('areas/irvine/index.html', (h) => h.replace(/data-map/g, 'data-gone')));
  assert.equal(status, 1);
  assert.ok(rules.has('map'));
});

test('a service page that stops linking a town page fails both ways', () => {
  const { rules } = verifyBroken((edit) =>
    edit('services/window-cleaning/index.html', (h) => h.replaceAll('href="/fernbrook/areas/tustin/window-cleaning/"', 'href="/fernbrook/areas/tustin/"')),
  );
  assert.ok(rules.has('reciprocal'));
});

test('a link outside the base path fails', () => {
  const { rules } = verifyBroken((edit) => edit('guides/signs-your-gutters-need-cleaning/index.html', (h) => h.replace('href="/fernbrook/services/gutter-cleaning/"', 'href="/services/gutter-cleaning/"')));
  assert.ok(rules.has('link-base'));
});

test('"learn more" link text fails', () => {
  const { rules } = verifyBroken((edit) => edit('services/screen-repair/index.html', (h) => h.replace(/>Window Cleaning in Orange County</, '>Learn more<')));
  assert.ok(rules.has('link-text'));
});

test('a service page with fewer than three FAQ questions fails', () => {
  const { rules } = verifyBroken((edit) => edit('services/gutter-cleaning/index.html', (h) => h.replace('data-faq-q', 'data-x')));
  assert.ok(rules.has('faq'));
});

test('a page without the secondary sign-up fails', () => {
  const { rules } = verifyBroken((edit) => edit('areas/tustin/index.html', (h) => h.replace('data-cta="secondary"', '')));
  assert.ok(rules.has('secondary-cta'));
});

test('a primary action that no longer reaches a form fails', () => {
  const { rules } = verifyBroken((edit) => edit('areas/irvine/window-cleaning/index.html', (h) => h.replace(/data-cta="primary" href="#inquiry"/, 'data-cta="primary" href="#nowhere"')));
  assert.ok(rules.has('primary-cta'));
});

test('losing a guide type fails', () => {
  const { rules } = verifyBroken((edit) => edit('guides/signs-your-gutters-need-cleaning/index.html', (h) => h.replace('content="list"', 'content="how-to"')));
  assert.ok(rules.has('guides'));
});

test('a preview page without noindex fails', () => {
  const { rules } = verifyBroken((edit) => edit('contact/index.html', (h) => h.replace('<meta name="robots" content="noindex, nofollow">', '')));
  assert.ok(rules.has('noindex'));
});
