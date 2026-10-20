// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { loadBusiness, siteMode } from './src/lib/site.mjs';

/**
 * Two builds from one source:
 *   preview    (default)  try.northshorelabs.dev/<slug>/, noindex everywhere
 *   production            the client's own domain at /, indexable
 * SITE_MODE=production picks the second. scripts/verify.mjs reads the
 * .nsl-build.json written below to know which one it is checking.
 */
const mode = siteMode();
const business = loadBusiness();
const base = mode === 'preview' ? `/${business.slug}/` : '/';
if (mode === 'production' && !business.domain) {
  throw new Error('Production build needs "domain" in site/business.json (e.g. "https://www.example.com").');
}
const site = mode === 'preview' ? 'https://try.northshorelabs.dev' : /** @type {string} */ (business.domain);

/**
 * Guides are Markdown, and Markdown links are written from the site root
 * ("/services/window-cleaning/"). This adds the base so they work under
 * /<slug>/ on try. Links already carrying the base are left alone.
 * (Astro 7's default Markdown processor is Sätteri; this is its hast plugin shape.)
 */
const baseLinks = () => ({
  name: 'nsl-base-links',
  element: {
    filter: ['a'],
    /** @param {any} node @param {any} ctx */
    visit(node, ctx) {
      const href = node.properties?.href;
      if (typeof href === 'string' && href.startsWith('/') && !href.startsWith('//') && !href.startsWith(base)) {
        ctx.setProperty(node, 'href', base + href.slice(1));
      }
    },
  },
});

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  build: { format: 'directory' },
  markdown: { processor: satteri({ hastPlugins: [baseLinks] }) },
  integrations: [
    sitemap({ filter: (page) => !page.endsWith('/404/') }),
    {
      name: 'nsl-build-manifest',
      hooks: {
        'astro:build:done': ({ dir }) => {
          const out = join(fileURLToPath(dir), '.nsl-build.json');
          writeFileSync(out, JSON.stringify({ mode, base, site, slug: business.slug, builtAt: new Date().toISOString() }, null, 2));
        },
      },
    },
  ],
});
