/**
 * Send a lead to the North Shore Labs portal intake (POST /api/inquiries,
 * bearer key). Same contract as the private @northshorelabs/site-kit
 * sendToPortal, kept inline so this public template has no private
 * dependency. If the portal contract changes, change both.
 *
 * Retries 429 / 5xx / network errors with the SAME submissionId (the portal
 * treats a replay as the same lead). Never throws.
 */
export const PORTAL_INTAKE_URL = 'https://portal.northshorelabs.dev/api/inquiries';

function compactFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    if (Object.keys(out).length >= 40) break;
    if (v === null || v === undefined || v === '') continue;
    out[k.slice(0, 80)] = typeof v === 'string' ? v.slice(0, 2000) : v;
  }
  return out;
}

export function portalBody(lead) {
  const fields = compactFields(lead.fields);
  const message = lead.message?.trim() || Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n') || 'Website inquiry';
  return {
    submissionId: lead.submissionId.replace(/[^\w.-]/g, '').slice(0, 128),
    formKind: (lead.formKind || 'contact').slice(0, 80),
    name: (lead.name ?? '').trim().slice(0, 120),
    email: (lead.email ?? '').trim(),
    phone: (lead.phone ?? '').trim().slice(0, 40),
    ...(lead.subject ? { subject: lead.subject.slice(0, 300) } : {}),
    message: message.slice(0, 10000),
    ...(lead.pageUrl ? { pageUrl: lead.pageUrl.slice(0, 2000) } : {}),
    fields,
  };
}

export async function sendToPortal(lead, { key, endpoint = PORTAL_INTAKE_URL, attempts = 3, timeoutMs = 4000, fetch: doFetch = fetch } = {}) {
  if (!key) return { ok: false, skipped: true, reason: 'no-key' };
  const body = JSON.stringify(portalBody(lead));
  let last = { status: null, error: 'not sent' };
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 400 * i));
    try {
      const res = await doFetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 200 || res.status === 201) return { ok: true, id: String(json.id ?? ''), replayed: res.status === 200 };
      last = { status: res.status, error: json.error ?? `HTTP ${res.status}` };
      if (res.status !== 429 && res.status < 500) break; // 400/401/409: retrying won't help
    } catch (error) {
      last = { status: null, error: error instanceof Error ? error.message : String(error) };
    }
  }
  return { ok: false, ...last };
}
