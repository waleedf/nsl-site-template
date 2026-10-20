# Close the Gap site template — spec

v0.1 · 2026-10-20 · from Waleed's direction in the session that built it. Agent steps are in [AGENTS.md](AGENTS.md); this file is the why.

This template is the structural half of the Close the Gap System. The creative half (brand boards, imagery, composition, owner review) still follows the playbook at `~/Documents/code/nsl-knowledge-graph/artifacts/2026/contractor-preview-playbook/PLAYBOOK.md`. The guided tour is the `nsl-tour` package.

## 1. Purpose

In Waleed's words: the agent must see that the site exists so the business's potential customers **feel recognized and feel like this is where they want to be to get what they want or need**. That is good service and trust, which practically every business must show, **plus the outcome they provide, by which service**.

The SEO and the conversion design serve that purpose:

- **Keywords are how recognition happens.** The header says back the words the buyer just searched. Keywords are what thousands of real people type, so copy built on them stays plain and normal, not tuned to one imagined persona.
- **Transactional intent says what the page must hold.** The searcher is ready to buy. Don't sell them; let them buy: yes we do that, here, how it works, what it costs or how pricing works, why we're legit, the button.

Persona thinking ("a contractor with a full truck, worried about being turned away") belongs in research. Written into copy it reads strange and over-specific.

## 2. Method (how NSL's earliest client sites were done)

1. **Who they are and what they specialize in.** For example, a window-coverings client: an authorized dealer for two premium brands that also repairs products it didn't sell, with a written list of what it does not do.
2. **Where they do it.** For example, a dirt-disposal client: one yard in one city, delivery across four counties. Places outside the footprint get no page at all.
3. **Plain, high-transactional-intent pages from those two answers.** "[Material] Delivery in [County]: Order by the Load". "[Service] in [City]: Check Your Load Before You Drive".

`site/business.json` is ordered the same way: identity → services → locations → pairs.

### Keyword sources, best first

1. Google Ads search terms report: the words that turned into calls.
2. Search Console queries, once a site is live, including tiny local searches.
3. Semrush, which often shows zero for small towns. Low volume with high intent still earns a page.
4. Google autocomplete and Business Profile categories.
5. The owner's words and the customers' words in their reviews.

Each service and location records its `source`. `guess` is allowed and reported by the gate.

## 3. Page families (every site, by default)

The gate fails a site that lacks any of these, **even when the copy is still placeholder**. Programmatic pages are the default: Google may weigh them less, but ChatGPT and other AI search break questions into long-tail sub-queries ("window cleaning in irvine for a two-story house"), and these pages answer them (owner decision, 2026-10-20).

| Page | URL | Default header | Required |
|---|---|---|---|
| Service | `/services/<service>/` | `{Service} in {market}` | what it is · why you'd want it · how it works · what it costs · why this business · answer-shaped FAQ (3+) with matching FAQPage markup · links to every town page for it · related services · quote form · secondary sign-up |
| Location | `/areas/<town>/` | `{trade} in {Town}` | map (the town, never a home address) · local notes · links to each service offered there · nearby towns · quote form · secondary sign-up |
| Service in town | `/areas/<town>/<service>/` | `{Service} in {Town}` | map · what's included · local notes · how it works and cost · FAQ (3+) with the town in it · links up to the service and town pages · other services here · same service nearby · quote form · secondary sign-up |
| Guide | `/guides/<id>/` | the guide's title | at least one each of comparison, list and how-to · updated date · in-body link to a service page · sources · primary action into the contact form · secondary sign-up |
| Home, indexes, contact | `/`, `/services/`, `/areas/`, `/guides/`, `/contact/` | | primary action + secondary sign-up |

A service-in-town pair is built for every service a town offers, minus pairs marked `skip`, minus a pair whose header would repeat the town page's header. That pair would compete with the town page for the same search.

Top 10 services and top 10 towns is the rule. Fewer is allowed when the business really has fewer; the gate warns so the reason gets recorded.

## 4. Headers

- The default is the search said back: `{Service} in {Place}`. Any header can be overridden in `business.json` when judgment says a different plain phrasing fits the search better. A product name may not need a place; an action can be the point ("Check Your Load Before You Drive").
- No slogans or decorative eyebrows.
- "best" is fine when the next line proves it with a real fact (a 4.8 from 140 Google reviews, an authorization, a license). "#1", "top-rated" and "highest-rated" are checkable claims and must be true. No superiority claims for dental or veterinary practices: California restricts them for licensed health professionals.
- Title tag and header say the same thing, so Google keeps the title instead of rewriting it.

## 5. Copy

- Buying information first: header, one-line answer, action. "What is it" comes after.
- Answer-shaped: a question as the heading, the answer in its first sentence. AI answers lift that passage.
- Sentences are built only from facts in `business.json`. Anything unknown renders as a marked placeholder (`data-placeholder`). Previews may carry placeholders; production may not.
- Trust is shown, not written: real proof only. "Excellent service" makes nobody feel anything.
- One page per buying need, not per keyword.

## 6. Publications

Three on every preview (one comparison, one list, one how-to) to show what monthly content looks like. They also make a natural Local Reach stop in the tour.

- Comparisons are between options (roller vs roman shades, clean vs mixed fill), with a table and a "which one is right for you" answer.
- "Best of" lists rank options, never competitor companies.
- A guide is about a location only when the place changes the answer (coastal salt air in Newport Beach), not as the thin-page problem in blog form.
- Numbers, specs and rules cite a source or the owner. Every guide carries an updated date and ends with the primary action.

## 7. Internal linking

All links come from the data, through one helper that adds the base path (`/<slug>/` on try, `/` in production). Markdown links in guides are written from the root and prefixed at build.

- Menu: every service, every town, guides. Footer: every service, up to 20 towns (then "All service areas"), recent guides, contact, giveaway rules.
- Breadcrumbs with BreadcrumbList markup on every page but home.
- Links inside page content carry more weight than menu and footer links, so every landing page must also be linked from page content.
- Link text names the page it opens, never "learn more".

The gate fails on: an orphan page, a landing page reached only from the menu or footer, a page more than 3 clicks from home, a service ↔ town ↔ pair link missing in either direction, a broken link, a link outside the base path, and banned link text.

## 8. Conversion

- **Primary:** every landing page has a primary action that reaches the quote form (on the page at `#inquiry`, or `/contact/` with the service and town carried in the query string). The form preselects the page's service and town.
- **Secondary:** a quieter sign-up below the content, never competing with the form. `newsletter` or `giveaway`, chosen per site. A giveaway needs "no purchase necessary" and official rules: the template builds a draft rules page, and production fails until `rulesApproved` is true. Never tied to leaving a review (Google policy; FTC rule, 2024).
- **Truthful states:** both forms post to `<base>api/lead` on the site's Worker, which validates, drops honeypot spam silently and sends to the NSL portal intake (`worker/portal.mjs`, the same contract as site-kit's `sendToPortal`; secret `NSL_INTAKE_KEY`). Without the key the answer is 503 "not connected" and the page says nothing was sent. A portal failure is shown as a failure. Values stay in the form on every failure.

## 9. Preview and production

| | Preview | Production |
|---|---|---|
| Build | `SITE_MODE=preview` (default) | `SITE_MODE=production` |
| Address | `https://try.northshorelabs.dev/<slug>/` | `business.domain` |
| Indexing | `noindex` meta + `X-Robots-Tag` | indexable, sitemap |
| Gate | `npm run check` | `npm run check:production` adds: no placeholders, no sample data, giveaway rules approved, no noindex |
| Deploy | `npm run deploy:try`: own Worker `nsl-site-<slug>`, routes `try…/<slug>` and `/<slug>/*`, dry run unless `--yes` | the client's host, deployed separately with a go-ahead |

A slug is refused when it names a shared path on try, or when another Worker already answers at `try.northshorelabs.dev/<slug>/` (checked live; a redeploy of the same site is recognised by its `x-nsl-site` header).

## 10. Tour

The template is tour-ready, not tour-embedded. The home page has `#inquiry` (Instant Text), `#services` (Local Reach) and, when a real rating exists, `#reviews` (Review Boost). `npm run tour` drafts `tour/<slug>.tour.json` for `nsl-tour`. Tour code never enters the site, because copying it into sites is what made four drifting versions before.

## 11. Not in v0.1

- **Studio / portal content editing** (site-kit `nsl` config client, `/nsl-preview`) needs a server route. Add it in the client's private repo when the client signs, following the site-kit README.
- **Turnstile** is not wired; spam protection is a honeypot. Add a per-site widget before heavy traffic.
- **Portal registration:** the portal accepts a lead only from a registered site, so each try URL or domain must be registered with its key.
- **Design:** the base look is a neutral, rounded starting point. The Close the Gap skill's scroll/large-media starter lives at `~/.codex/skills/close-the-gap-system/assets/scroll-media/`.
- **Analytics and attribution** (GA4/GTM, ad click IDs) are not included yet.
