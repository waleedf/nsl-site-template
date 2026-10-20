# nsl-site-template

North Shore Labs **Close the Gap** site template. One file, `site/business.json`, plus three Markdown guides becomes a full site: service pages, town pages, service-in-town pages, guides, and internal linking between all of them. Every page has a quote form and a second sign-up. A gate (`npm run check`) fails the build when any of that is missing.

- Agents: start at [AGENTS.md](AGENTS.md).
- Why it's built this way: [SPEC.md](SPEC.md).

```sh
npm install
npm run dev        # http://localhost:4321/fernbrook/ (the sample business)
npm run check      # build the preview and run the gate
npm test
```

The sample business, "Fernbrook Window Cleaning", is hypothetical and marked `"example": true`, so it can never pass the production gate.

This repository is public. Client sites made from it (`npm run new`) live in their own **private** repos. Never put a real business's data, names, leads or notes in this one.
