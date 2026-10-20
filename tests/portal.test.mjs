import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portalBody, sendToPortal, PORTAL_INTAKE_URL } from '../worker/portal.mjs';

const lead = { submissionId: '3f0c2a1e-1111-4222-8333-444455556666', formKind: 'quote', name: ' Pat ', phone: '(714) 555-0100', message: 'Two-story house', fields: { service: 'window-cleaning', location: null, consent: true } };
const reply = (status, body = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('no key means nothing is sent', async () => {
  let called = false;
  const r = await sendToPortal(lead, { fetch: async () => { called = true; return reply(201); } });
  assert.deepEqual(r, { ok: false, skipped: true, reason: 'no-key' });
  assert.equal(called, false);
});

test('posts the trimmed lead with the bearer key to the intake', async () => {
  const seen = [];
  const r = await sendToPortal(lead, { key: 'k', fetch: async (url, init) => { seen.push({ url, init }); return reply(201, { id: 'lead_1' }); } });
  assert.deepEqual(r, { ok: true, id: 'lead_1', replayed: false });
  assert.equal(seen[0].url, PORTAL_INTAKE_URL);
  assert.equal(seen[0].init.headers.authorization, 'Bearer k');
  const body = JSON.parse(seen[0].init.body);
  assert.equal(body.name, 'Pat');
  assert.deepEqual(body.fields, { service: 'window-cleaning', consent: true });
});

test('retries a 503 with the same submission, stops on a 400', async () => {
  const ids = [];
  const flaky = [reply(503), reply(201, { id: 'x' })];
  const ok = await sendToPortal(lead, { key: 'k', fetch: async (_, init) => { ids.push(JSON.parse(init.body).submissionId); return flaky.shift(); } });
  assert.equal(ok.ok, true);
  assert.equal(new Set(ids).size, 1);
  let calls = 0;
  const bad = await sendToPortal(lead, { key: 'k', fetch: async () => { calls++; return reply(400, { error: 'bad' }); } });
  assert.deepEqual(bad, { ok: false, status: 400, error: 'bad' });
  assert.equal(calls, 1);
});

test('a lead with no message gets one built from its fields', () => {
  assert.equal(portalBody({ ...lead, message: '' }).message, 'service: window-cleaning\nconsent: true');
});
