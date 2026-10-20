# NSL site template — agent instructions

You are building a North Shore Labs **Close the Gap** website. Read this file, then [SPEC.md](SPEC.md) for the reasons behind each rule.

## What the site is for

A potential customer lands on a page and feels: *this is where I get what I need.* Two layers, on every page: what almost every business must show (they show up, do good work, can be trusted) **plus** the specific result this business delivers, through which service.

Recognition comes from **saying their search back**, not from describing their situation. Someone types "window cleaning irvine" and the header says "Window Cleaning in Irvine". They are ready to buy, so give them what a buyer needs to act: yes we do that, here, how it works, what it costs or how to get a price, why we're legit, the button. Think about who they are while researching; never write that thinking into the copy.

## Build order

1. **Start a copy.** `npm run new -- ../<slug>-site --slug <slug> --name "<Business Name>"`, then `cd` there and `npm install`. Never build a client inside the template folder. Keep the repo private.
2. **Who they are and what they specialize in.** In `site/business.json`: `name`, `trade` (umbrella phrase, e.g. "Window & Gutter Cleaning"), `market` (e.g. "Orange County"), `phone`, `proof` (real trust facts only), `reviews` (only a real rating, else `null`).
3. **What they do.** The top 10 services, in priority order. Each gets `keyword` (the words buyers type) and `source`. Keyword sources, best first: Google Ads search terms report → Search Console → Semrush → Google autocomplete / Business Profile categories → the owner's words. If fewer than 10 are real, list fewer and say why. Never invent a service.
4. **Where they do it.** The top 10 towns with `lat`/`lng`, `source`, and which services each town gets (`"all"` or a list). Never invent coverage. A pair they don't really do: add `{ "service", "location", "skip": true }` to `combos`.
5. **Copy.** Fill `summary`, `what`, `why`, `how`, `pricing`, `faq` per service, and `notes` per town, from facts only. Unknown stays `null`; the page shows a marked placeholder and the preview still works. Override any `header` when a different plain phrasing fits the search better.
6. **Guides.** Replace the three samples in `site/guides/` with one `comparison`, one `list` and one `how-to` for this business. Each body links to a service page (write links from the root: `/services/<id>/`). Lists rank options, never competitor companies. Use a `location` only when the place changes the answer. Cite numbers and rules in `sources`.
7. **Look.** Set `brand` colors. A new design direction follows the Close the Gap visual-first method (image boards approved before code). This template supplies structure, not the design.
8. **Check.** `npm run check` must end in **PASS**. Read the warnings in `verification/VERIFICATION.md`, and copy that file into the run evidence.
9. **Preview.** `npm run deploy:try` rehearses. Ask Waleed, then `npm run deploy:try -- --yes` publishes `https://try.northshorelabs.dev/<slug>/`. Forms answer "not connected" until `NSL_INTAKE_KEY` is set and the try URL is registered in the portal.
10. **Tour.** `npm run tour -- --install`, then `nsl-tour check <slug>` must PASS, then `nsl-tour publish --yes` only with Waleed's go-ahead. The tour is laid over the site; never copy tour code into it.
11. **Production** (separate go-ahead): set `domain`, `"example": false`, approve giveaway rules if used, then `npm run check:production` must PASS before deploying to the client's host.

## Always

- Every site has service pages, town pages, service-in-town pages, three guides and full internal linking, even when the copy is still placeholder. `verify` fails without them.
- Every landing page: a primary action to a working quote form and a quieter secondary sign-up (`secondary.kind`: `newsletter` or `giveaway`).
- Links come from the data. Don't hand-write menus or link lists; add the service or town to `business.json`.

## Never

- Invent services, towns, reviews, ratings, credentials, prices or jobs.
- Write "best", "#1" or "top-rated" unless the next line proves it with a real fact. Never superiority claims for dental or veterinary practices.
- Tie the giveaway to leaving a review.
- Fake a form success, or send a real inquiry, text or email as a test.
- Deploy, publish a tour, or push a client repo's `main` without Waleed's go-ahead.
- Make a client repo public, or put a real business into this template repo. The template is public; every client site lives in its own private repo.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | local site at `http://localhost:4321/<slug>/` |
| `npm run check` | preview build + the gate (writes `verification/`) |
| `npm run check:production` | production build + the stricter gate |
| `npm test` | data, Worker and gate tests |
| `npm run deploy:try [-- --yes]` | rehearse / publish the preview |
| `npm run tour [-- --install]` | draft the nsl-tour file |
| `npm run new -- <folder> --slug <s> --name "<n>"` | start a new client site |
