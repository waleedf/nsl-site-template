// JSON-LD builders. Only facts from business.json go in; nothing is inferred.
import { LOREM } from './copy.mjs';

export const faqLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a ?? LOREM } })),
});

export const businessLd = (b, url) => ({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: b.name,
  url,
  ...(b.phone ? { telephone: b.phone } : {}),
  ...(b.email ? { email: b.email } : {}),
  areaServed: b.locations.map((l) => ({ '@type': 'City', name: `${l.name}, ${l.region}` })),
  ...(b.reviews ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: b.reviews.rating, reviewCount: b.reviews.count } } : {}),
});

export const serviceLd = (b, s, places, url) => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: s.name,
  serviceType: s.name,
  url,
  provider: { '@type': 'LocalBusiness', name: b.name, ...(b.phone ? { telephone: b.phone } : {}) },
  areaServed: places.map((p) => ({ '@type': 'City', name: p })),
});

export const articleLd = (b, g, url) => ({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: g.title,
  description: g.description,
  dateModified: g.updated.toISOString().slice(0, 10),
  url,
  author: { '@type': 'Organization', name: b.name },
  publisher: { '@type': 'Organization', name: b.name },
});
