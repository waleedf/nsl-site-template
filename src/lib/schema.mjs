// The shape of site/business.json — the one file an agent fills in.
// Plain .mjs so the Astro pages, scripts/verify.mjs and the tests share it.
import { z } from 'zod';

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase-words-with-dashes');
const text = z.string().trim().min(1);
// null / missing = not written yet. The page renders a visible placeholder and
// `verify --production` fails until it is replaced with real copy.
const copy = text.nullable().optional();

// Where a service or location came from. Keeps owner facts, measured demand
// and guesses apart, which is the selection record the playbook asks for.
export const SOURCES = ['owner', 'ads-search-terms', 'search-console', 'semrush', 'autocomplete', 'gbp', 'website', 'guess'];
const source = z.enum(SOURCES);

const faq = z.object({ q: text, a: copy });

export const Service = z.object({
  id: slug,
  name: text,                // "Window Cleaning" — menus, cards, link text
  keyword: text,             // "window cleaning" — the words buyers type; used inside sentences
  source,
  header: text.optional(),   // judgment override; default "{name} in {market}"
  summary: copy,             // the one-line answer under the header
  what: copy,                // What is it / what's included
  why: copy,                 // Why you'd want it / when you need it
  how: copy,                 // How it works
  pricing: copy,             // How pricing works (never invent numbers)
  faq: z.array(faq).default([]),
  related: z.array(slug).default([]),
});

export const Location = z.object({
  id: slug,
  name: text,                // "Irvine"
  region: text,              // "CA"
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  source,
  services: z.union([z.literal('all'), z.array(slug)]).default('all'),
  header: text.optional(),   // default "{trade} in {name}"
  summary: copy,
  notes: copy,               // what is true about working in this place
  faq: z.array(faq).default([]),
});

export const Combo = z.object({
  service: slug,
  location: slug,
  header: text.optional(),   // default "{service.name} in {location.name}"
  summary: copy,
  what: copy,
  notes: copy,
  faq: z.array(faq).default([]),
  skip: z.boolean().default(false), // the business does not really do this pair
});

export const Business = z.object({
  example: z.boolean().default(false),     // true until real business data replaces the sample
  slug,                                    // try.northshorelabs.dev/<slug>/
  name: text,
  trade: text,                             // umbrella phrase: "Window & Gutter Cleaning"
  market: text,                            // main market: "Orange County"
  header: text.optional(),                 // homepage header; default "{trade} in {market}"
  summary: copy,
  phone: text.nullable().default(null),
  email: z.email().nullable().default(null),
  domain: z.url().nullable().default(null), // production origin, e.g. https://www.example.com
  brand: z.object({
    ink: text.default('#17212b'),
    paper: text.default('#f7f5f0'),
    accent: text.default('#1f6f78'),
    accentInk: text.default('#ffffff'),
  }).default({ ink: '#17212b', paper: '#f7f5f0', accent: '#1f6f78', accentInk: '#ffffff' }),
  proof: z.array(text).default([]),         // real trust facts only: license, years, certifications
  reviews: z.object({
    rating: z.number().min(1).max(5),
    count: z.number().int().positive(),
    source: text,
    url: z.url().nullable().default(null),
  }).nullable().default(null),              // null when there is no real rating — never invent one
  secondary: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('newsletter'), headline: text.optional(), pitch: text.optional() }),
    z.object({
      kind: z.literal('giveaway'),
      prize: text,                          // "$100 off your next cleaning"
      endsOn: z.iso.date(),
      sponsor: text.optional(),             // legal name on the rules page; defaults to name
      rulesApproved: z.boolean().default(false),
    }),
  ]),
  form: z.object({
    endpoint: text.nullable().default(null), // null = this site's Worker at <base>api/inquiry
  }).default({ endpoint: null }),
  tour: z.object({
    wording: z.enum(['general', 'home-services', 'towing']).default('general'),
  }).default({ wording: 'general' }),
  services: z.array(Service).min(1),
  locations: z.array(Location).min(1),
  combos: z.array(Combo).default([]),
});

export const GUIDE_TYPES = ['comparison', 'list', 'how-to'];
