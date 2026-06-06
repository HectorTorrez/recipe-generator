# Smart Recipe Generator

An AI-powered recipe recommendation app that suggests meals based on the ingredients you have and how much time you can spend cooking.

Built for a technical interview challenge, adapted from a to-do list brief into a recipe generator with a **separate client/server architecture**.

## Live demo

Production URLs (after `pnpm deploy:all`):

| Service | URL |
|---------|-----|
| **Frontend** | https://recipe-generator-web.torrezhectorb.workers.dev |
| **API health** | https://recipe-generator-api.torrezhectorb.workers.dev/health |

> **First-time deploy:** Run `pnpm exec wrangler login`, then `pnpm deploy:all`.

## Submission

| Deliverable | Link |
|-------------|------|
| **GitHub** | https://github.com/HectorTorrez/recipe-generator |
| **Frontend** | https://recipe-generator-web.torrezhectorb.workers.dev |
| **API health** | https://recipe-generator-api.torrezhectorb.workers.dev/health |

## Architecture

```
┌─────────────────────────┐         POST /api/recipes         ┌──────────────────────────┐
│  TanStack Start (web)   │  ──────────────────────────────▶  │  Cloudflare Worker (api) │
│  React + plain CSS      │         JSON request/response     │  Workers AI inference    │
│  localStorage prefs     │  ◀──────────────────────────────    │  CORS + validation       │
└─────────────────────────┘                                   └──────────────────────────┘
```

### Why separate frontend and backend?

The challenge requires a clear client/server split. TanStack Start handles the UI and SSR, but **all AI logic lives in a dedicated Cloudflare Worker** (`api/`). The frontend never talks to Workers AI directly — it only calls the API worker over HTTP.

### Monorepo layout

| Package | Role |
|---------|------|
| `/` (root) | TanStack Start frontend — ingredient input, filters, recipe display |
| `api/` | Cloudflare Worker — prompt building, Workers AI call, JSON parsing |

## Features

- **Ingredient input** — add/remove ingredients with local persistence
- **Time filter** — 10, 20, 30, 45, or 60+ minutes
- **Optional filters** — difficulty, dietary preferences, kitchen equipment
- **AI recommendations** — 3 recipes with name, description, time, ingredients, steps, and rationale
- **Missing ingredients** — highlights extras you'd need to buy
- **Local persistence** — preferences and last recipe results saved to `localStorage` across reloads (client-side hydration after SSR)

## AI model choice

**Model:** `@cf/meta/llama-3.1-8b-instruct` (Cloudflare Workers AI)

**Why this model:**

- Available on Cloudflare's **free tier** with no external API keys
- Strong instruction-following for structured JSON output
- Fast enough for interactive use (~few seconds)
- Good balance of quality and cost for short-form recipe generation

The worker sends a detailed system prompt requesting strict JSON. The response is parsed and validated before returning to the client. If the model wraps output in markdown fences, the parser strips them.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | TanStack Start, React 19, TanStack Router |
| Styling | Plain CSS (no Tailwind/Bootstrap/MUI) |
| Backend | Cloudflare Workers (standalone) |
| AI | Cloudflare Workers AI |
| Package manager | pnpm workspaces |
| Deployment | Cloudflare Workers (both packages) |

## Getting started

### Prerequisites

- Node.js 20+
- pnpm
- Cloudflare account — authenticate with `pnpm exec wrangler login` before deploy or local API dev with Workers AI

### Install

```bash
pnpm install
```

### Development

Run both services in parallel:

```bash
pnpm dev:all
```

Or separately:

```bash
pnpm dev        # Frontend at http://localhost:3000
pnpm dev:api    # API at http://localhost:8787
```

The Vite dev server proxies `/api/*` to the API worker, so no CORS setup is needed locally.

**Note:** Workers AI requires a logged-in Wrangler session (`pnpm exec wrangler login`). The `predev:api` script clears stale `.wrangler/deploy` artifacts from web builds that can conflict with API dev.

### Environment

For local dev with the Vite proxy, you can leave `VITE_API_URL` unset.

**Production builds** require `VITE_API_URL` at build time (not just in `wrangler.jsonc` vars). This is set in [`.env.production`](.env.production) and baked into the client bundle when you run `pnpm run build`.

### Deploy

1. Deploy the API worker first:

```bash
pnpm deploy:api
```

Note the deployed URL (e.g. `https://recipe-generator-api.<account>.workers.dev`).

2. Update CORS in `api/wrangler.jsonc` and `VITE_API_URL` in `wrangler.jsonc` if your Workers subdomain differs from `torrezhectorb`.

3. Deploy the frontend:

```bash
pnpm deploy:web
```

## API reference

### `GET /health`

Returns worker status and model name.

### `POST /api/recipes`

**Request:**

```json
{
  "ingredients": ["chicken", "rice", "onion", "garlic"],
  "cookingTimeMinutes": 20,
  "difficulty": "beginner",
  "dietaryPreferences": ["high-protein"],
  "equipment": ["stove"]
}
```

**Response:**

```json
{
  "recipes": [
    {
      "name": "Garlic Chicken Rice Bowl",
      "description": "A quick one-pan meal...",
      "estimatedTimeMinutes": 18,
      "ingredients": ["chicken", "rice", "onion", "garlic", "olive oil"],
      "instructions": ["Step 1...", "Step 2..."],
      "whyRecommended": "Uses all provided ingredients and fits within 20 minutes.",
      "missingIngredients": ["olive oil"]
    }
  ]
}
```

## Design decisions

1. **Plain CSS over utility frameworks** — per challenge requirements, styling is hand-written for full control without Tailwind/MUI.
2. **localStorage for persistence** — ingredients and preferences persist client-side; no database needed for this scope.
3. **Prompt engineering over fine-tuning** — constraints (time, diet, equipment) are injected into a structured prompt rather than using RAG or a recipe database.
4. **Three recipes per request** — gives users choice without overwhelming the UI or blowing token limits.
5. **CORS via env var** — `ALLOWED_ORIGINS` keeps the API secure while supporting multiple deployment URLs.

## Challenges encountered

- **JSON reliability from LLMs** — models sometimes wrap JSON in markdown fences; the API strips these and validates each recipe field before returning.
- **SSR + localStorage** — preferences load in a client `useEffect` after hydration to avoid server/client state mismatch.
- **Separate deploy targets** — frontend and API are two Workers; CORS and `VITE_API_URL` must be configured after first deploy.
- **Workers AI response shape** — the `AI.run()` return type varies; the handler normalizes string vs object responses.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start frontend dev server |
| `pnpm dev:api` | Start API worker locally |
| `pnpm dev:all` | Start both in parallel |
| `pnpm build` | Build frontend for production |
| `pnpm deploy:api` | Deploy API worker |
| `pnpm deploy:web` | Build and deploy frontend |
| `pnpm deploy:all` | Deploy both API and frontend |
