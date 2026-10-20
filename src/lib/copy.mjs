// Default headers and copy. Headers say the buyer's search back to them in
// plain words: "{Service} in {Place}". Any header can be overridden in
// business.json when judgment says a different plain phrasing fits better.
// Sentences here are only ever built from facts in business.json; anything the
// data does not support renders as a marked placeholder instead.

export const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.';

export const homeHeader = (b) => b.header ?? `${b.trade} in ${b.market}`;
export const serviceHeader = (b, s) => s.header ?? `${s.name} in ${b.market}`;
export const locationHeader = (b, l) => l.header ?? `${b.trade} in ${l.name}`;
export const comboHeader = (b, s, l, o) => o?.header ?? `${s.name} in ${l.name}`;

export const title = (header, b) => `${header} | ${b.name}`;

const call = (b) => (b.phone ? ` or call ${b.phone}` : '');
const list = (items) =>
  items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export const homeSummary = (b) =>
  b.summary ?? `${b.name} offers ${list(b.services.slice(0, 3).map((s) => s.keyword))} across ${b.market}. Send the form for a quote${call(b)}.`;

export const serviceSummary = (b, s) =>
  s.summary ?? `${b.name} provides ${s.keyword} across ${b.market}. Send the form for a quote${call(b)}.`;

export const locationSummary = (b, l, offered) =>
  l.summary ?? `${b.name} offers ${list(offered.map((s) => s.keyword))} in ${l.name}, ${l.region}. Send the form for a quote${call(b)}.`;

export const comboSummary = (b, s, l, o) =>
  o?.summary ?? `Yes, ${b.name} offers ${s.keyword} in ${l.name}, ${l.region}. Send the form for a quote${call(b)}.`;

export const serviceDescription = (b, s) => `${s.name} in ${b.market} from ${b.name}. What's included, how it works, pricing and answers. Get a quote${call(b)}.`;
export const locationDescription = (b, l, offered) => `${b.trade} in ${l.name}, ${l.region}: ${list(offered.map((s) => s.keyword))}. Get a quote from ${b.name}${call(b)}.`;
export const comboDescription = (b, s, l) => `${s.name} in ${l.name}, ${l.region} from ${b.name}. What's included, pricing and local answers. Get a quote${call(b)}.`;

/**
 * At least three answer-shaped questions per page. Real ones from the data come
 * first; the rest are the questions buyers ask about any service, with answers
 * built from facts in the data or left as placeholders.
 */
export function faqFor(b, s, l = null, extra = []) {
  const place = l ? `${l.name}` : b.market;
  const given = [...extra, ...s.faq];
  const defaults = [
    { q: `How much does ${s.keyword} cost in ${place}?`, a: s.pricing ?? null },
    {
      q: `Do you offer ${s.keyword} in ${place}?`,
      a: `Yes. ${b.name} offers ${s.keyword} in ${place}${l ? `, ${l.region}` : ''}. Send the form on this page for a quote${call(b)}.`,
    },
    { q: `How does ${s.keyword} work?`, a: s.how ?? null },
  ];
  const asked = new Set(given.map((f) => f.q.toLowerCase()));
  const out = [...given];
  for (const d of defaults) {
    if (out.length >= 3) break;
    if (!asked.has(d.q.toLowerCase())) out.push(d);
  }
  return out;
}
