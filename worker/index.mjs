/**
 * The site's Worker. Serves the built pages and takes the two forms.
 *
 *   POST <base>api/lead   kind=inquiry | newsletter | giveaway
 *     → validated, then sent to the NSL portal intake with the NSL_INTAKE_KEY
 *       secret. Without that secret the answer is an honest 503
 *       "not-connected": the page says nothing was sent. Never a fake OK.
 *   everything else → static assets; previews get X-Robots-Tag noindex.
 *
 * vars: BASE ("/<slug>/" on try, "/" in production), MODE (preview|production),
 *       SITE (the slug; sent as x-nsl-site so deploy-try can tell its own Worker
 *       from another one on the same path), LEAD_ENDPOINT (optional override)
 * secret: NSL_INTAKE_KEY (wrangler secret put NSL_INTAKE_KEY --config …)
 * The portal only accepts leads whose page URL is on a site registered for
 * that key, so register the try URL (or the client domain) in the portal first.
 */
import { sendToPortal } from './portal.mjs';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v, n) => String(v ?? '').trim().slice(0, n);

async function readBody(request) {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return { data: await request.json(), wantsJson: true };
  const form = await request.formData();
  return { data: Object.fromEntries(form), wantsJson: false };
}

/** Returns an error message for the visitor, or null when the lead is usable. */
export function validate(d) {
  if (clip(d.website, 200)) return 'spam';
  if (d.kind === 'inquiry') {
    if (!clip(d.name, 120)) return 'Add your name.';
    if (clip(d.phone, 40).replace(/\D/g, '').length < 10) return 'Add a phone number with area code.';
    if (d.email && !EMAIL.test(clip(d.email, 200))) return 'Check the email address.';
    if (!clip(d.message, 4000)) return 'Tell us briefly what you need.';
    return null;
  }
  if (d.kind === 'newsletter' || d.kind === 'giveaway') {
    if (!EMAIL.test(clip(d.email, 200))) return 'Add your email address.';
    if (!d.consent) return 'Tick the box so we can email you.';
    return null;
  }
  return 'Unknown form.';
}

export function toPortalLead(d, pageUrl) {
  const inquiry = d.kind === 'inquiry';
  return {
    submissionId: crypto.randomUUID(),
    formKind: inquiry ? 'quote' : d.kind,
    name: clip(d.name, 120) || undefined,
    email: clip(d.email, 200) || undefined,
    phone: clip(d.phone, 40) || undefined,
    subject: inquiry ? 'Quote request' : d.kind === 'giveaway' ? 'Giveaway entry' : 'Newsletter sign-up',
    message: inquiry ? clip(d.message, 4000) : `${d.kind === 'giveaway' ? 'Giveaway entry' : 'Newsletter sign-up'} with email consent.`,
    pageUrl,
    fields: { service: clip(d.service, 80) || null, location: clip(d.location, 80) || null, consent: d.consent ? true : null },
  };
}

export async function handleLead(request, env, deps = { send: sendToPortal }) {
  let parsed;
  try { parsed = await readBody(request); } catch { return json(400, { ok: false, error: 'Could not read the form.' }); }
  const { data, wantsJson } = parsed;
  const kind = data.kind === 'inquiry' ? 'inquiry' : 'secondary';
  const back = (query) => {
    const ref = request.headers.get('referer');
    const to = new URL(ref && new URL(ref).origin === new URL(request.url).origin ? ref : new URL(env.BASE ?? '/', request.url));
    to.search = `form=${kind}&${query}`;
    return Response.redirect(to.href, 303);
  };
  const problem = validate(data);
  if (problem === 'spam') return wantsJson ? json(200, { ok: true }) : back('sent=1'); // honeypot: look normal, send nothing
  if (problem) return wantsJson ? json(400, { ok: false, error: problem }) : back('error=invalid');
  if (!env.NSL_INTAKE_KEY) return wantsJson ? json(503, { ok: false, reason: 'not-connected' }) : back('error=not-connected');

  const pageUrl = typeof data.page === 'string' && data.page.startsWith(new URL(request.url).origin) ? data.page : request.headers.get('referer') ?? undefined;
  const result = await deps.send(toPortalLead(data, pageUrl), { key: env.NSL_INTAKE_KEY, ...(env.LEAD_ENDPOINT ? { endpoint: env.LEAD_ENDPOINT } : {}) });
  if (result.ok) return wantsJson ? json(200, { ok: true }) : back('sent=1');
  console.error('[lead] portal intake failed', JSON.stringify(result));
  return wantsJson ? json(502, { ok: false, reason: 'intake-failed' }) : back('error=failed');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const base = env.BASE ?? '/';
    if (base !== '/' && url.pathname === base.slice(0, -1)) return Response.redirect(new URL(base + url.search, url).href, 301);
    if (url.pathname === `${base}api/lead`) {
      if (request.method !== 'POST') return json(405, { ok: false, error: 'POST only' });
      return handleLead(request, env);
    }
    if (url.pathname.startsWith(`${base}api/`)) return json(404, { ok: false, error: 'Not found' });

    const res = await env.ASSETS.fetch(request);
    if (env.MODE !== 'preview') return res;
    const out = new Response(res.body, res);
    out.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    if (env.SITE) out.headers.set('x-nsl-site', env.SITE);
    return out;
  },
};
