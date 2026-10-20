import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Publications live in site/guides/*.md next to business.json, so everything an
// agent edits for a new business sits in site/.
const guides = defineCollection({
  loader: glob({ pattern: '*.md', base: './site/guides' }),
  schema: z.object({
    title: z.string().min(1),                       // the header; plain words, the search it answers
    description: z.string().min(1),
    type: z.enum(['comparison', 'list', 'how-to']),
    about: z.array(z.string()).min(1),              // service ids this guide supports
    location: z.string().optional(),                // only when the place changes the answer
    updated: z.coerce.date(),
    sources: z.array(z.object({ label: z.string(), url: z.url().optional() })).default([]),
  }),
});

export const collections = { guides };
