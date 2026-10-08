# Blackjack Trainer

A free live blackjack counter and strategy assistant at `blackjack.hugosantosribeiro.me`. Built with Next.js App Router, React, TypeScript and Tailwind CSS. No backend, accounts or session persistence.

## Run locally

Node.js 20.9+ and npm are required.

```bash
npm ci
npm run dev -- --port 3001
```

Open `http://localhost:3001`. All active shoe state and settings disappear on refresh.

## Features

- Thirteen rank buttons, optional grouped tens, keyboard entry and transactional bulk entry (`A 5 10 K`, `2x4`).
- Seven counting options: Hi-Lo, KO, Hi-Opt I/II, Omega II, Zen Count and custom tags. Switch systems without resetting the shoe.
- Running/true count, configurable rounding/deck estimation, exact card inventory, penetration/cut depth and ace side count.
- Integrated player/dealer card entry with count-once, already-counted and preview modes.
- Rule-aware basic strategy, a gated Hi-Lo index set, pre-peek insurance and finite-shoe EV in a cancellable Web Worker.
- Interactive hard/soft/pair charts, conditional-action explanations, custom bet ramp, compact/large-button layouts and a mobile live bar.
- Temporary undo/redo, clear-hand and new-shoe controls. Clearing a hand keeps exposed cards removed; changing deck count starts a new shoe.

### Mathematical scope

Basic strategy uses the reference tables for one, two and multi-deck games. The displayed recommendation is labeled basic strategy or a validated Hi-Lo deviation. When every legal action has a calculated finite EV, a separate composition-dependent recommendation is shown.

Split EV is explicitly unavailable. Custom deck counts and unusual combinations of restricted doubles/resplitting use standard table fallbacks, not a full generated pair optimum. Complex EV calculations have a live latency limit and return missing values with an explanation rather than estimates. See [the mathematical model, assumptions and source references](docs/mathematics.md).

## Validation

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

The mathematical suite covers count systems, negative rounding, shoe conservation, advisor registration, undo/redo, reference strategy cells, rule legality, soft hands, surrender, split conditions, insurance and finite EV. The browser suite runs against the production build on desktop and mobile, including the EV worker, keyboard operation, responsive charts and the absence of persistent state.

Browser tests use an installed Google Chrome at `/usr/bin/google-chrome` when available. Otherwise install Playwright Chromium:

```bash
npx playwright install chromium
```

## Deployment

Create a separate Vercel project using the Next.js defaults:

- Root: this repository.
- Build: `npm run build`.
- Production domain: `blackjack.hugosantosribeiro.me`.

Associate the domain with that Vercel project and configure the DNS values provided by Vercel. Local code creation does not publish the site or alter DNS. The canonical domain is centralized in `lib/site.ts` and shared by metadata, robots and sitemap.
