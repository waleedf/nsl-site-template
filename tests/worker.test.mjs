import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { handleLead } from '../worker/index.mjs';

const ORIGIN = 'https://try.northshorelabs.dev';
const env = (extra = {}) => ({ BASE: '/fernbrook/', MODE: 'preview', ...extra });
const post = (body, headers = {}) =>
  new Request(`${ORIGIN}/fernbrook/api/lead`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const inquiry = { kind: 'inquiry', name: 'Pat', phone: '(714) 555-0100', message: 'Two-story house', service: 'window-cleaning', location: 'irvine', page: `${ORIGIN}/fernbrook/services/window-cleaning/` };
const spy = (result) => {
  const calls = [];
  return { calls, send: async (lead, opts) => { calls.push({ lead, opts }); return result; } };
};

test('without the portal key the answer is an honest "not connected"', async () => {
  const s = spy({ ok: true, id: 'x', replayed: false });
  const res = await handleLead(post(inquiry), env(), s);
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { ok: false, reason: 'not-connected' });
  assert.equal(s.calls.length, 0);
});

test('a valid quote request goes to the portal with its service and town', async () => {
  const s = spy({ ok: true, id: 'lead_1', replayed: false });
  const res = await handleLead(post(inquiry), env({ NSL_INTAKE_KEY: 'k' }), s);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  const { lead, opts } = s.calls[0];
  assert.equal(opts.key, 'k');
  assert.equal(lead.formKind, 'quote');
  assert.equal(lead.phone, '(714) 555-0100');
  assert.equal(lead.fields.service, 'window-cleaning');
  assert.equal(lead.fields.location, 'irvine');
  assert.equal(lead.pageUrl, inquiry.page);
  assert.match(lead.submissionId, /^[0-9a-f-]{36}$/);
});

test('a portal failure is reported as a failure, never as sent', async () => {
  const s = spy({ ok: false, status: 500, error: 'boom' });
  const res = await handleLead(post(inquiry), env({ NSL_INTAKE_KEY: 'k' }), s);
  assert.equal(res.status, 502);
  assert.equal((await res.json()).ok, false);
});

test('bad input gets a plain reason and is not sent', async () => {
  const s = spy({ ok: true });
  const res = await handleLead(post({ ...inquiry, phone: '123' }), env({ NSL_INTAKE_KEY: 'k' }), s);
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /phone/);
  const sub = await handleLead(post({ kind: 'giveaway', email: 'pat@example.com' }), env({ NSL_INTAKE_KEY: 'k' }), s);
  assert.equal(sub.status, 400);
  assert.equal(s.calls.length, 0);
});

test('the honeypot looks normal to a bot and sends nothing', async () => {
  const s = spy({ ok: true });
  const res = await handleLead(post({ ...inquiry, website: 'http://spam' }), env({ NSL_INTAKE_KEY: 'k' }), s);
  assert.equal(res.status, 200);
  assert.equal(s.calls.length, 0);
});

test('giveaway and newsletter sign-ups carry consent', async () => {
  const s = spy({ ok: true, id: 'x', replayed: false });
  await handleLead(post({ kind: 'giveaway', email: 'pat@example.com', consent: 'yes' }), env({ NSL_INTAKE_KEY: 'k' }), s);
  assert.equal(s.calls[0].lead.formKind, 'giveaway');
  assert.equal(s.calls[0].lead.fields.consent, true);
});

test('a no-JavaScript form post redirects back to the page with the result', async () => {
  const req = new Request(`${ORIGIN}/fernbrook/api/lead`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', referer: `${ORIGIN}/fernbrook/contact/` },
    body: new URLSearchParams({ kind: 'newsletter', email: 'pat@example.com', consent: 'yes' }),
  });
  const res = await handleLead(req, env(), spy({ ok: true }));
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), `${ORIGIN}/fernbrook/contact/?form=secondary&error=not-connected`);
});

test('pages get noindex on previews and the bare slug redirects', async () => {
  const assets = { fetch: async () => new Response('<h1>ok</h1>', { status: 200, headers: { 'content-type': 'text/html' } }) };
  const page = await worker.fetch(new Request(`${ORIGIN}/fernbrook/`), { ...env(), ASSETS: assets });
  assert.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  const prod = await worker.fetch(new Request(`${ORIGIN}/`), { BASE: '/', MODE: 'production', ASSETS: assets });
  assert.equal(prod.headers.get('x-robots-tag'), null);
  const bare = await worker.fetch(new Request(`${ORIGIN}/fernbrook`), { ...env(), ASSETS: assets });
  assert.equal(bare.status, 301);
  assert.equal(bare.headers.get('location'), `${ORIGIN}/fernbrook/`);
});
