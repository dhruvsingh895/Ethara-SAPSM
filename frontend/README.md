# Frontend — Ethara SAPSM

Next.js 14 (App Router) + Tailwind + TypeScript. Deploys to Vercel.

## Layout

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout, Tailwind base
│   │   ├── page.tsx            # Landing page (Phase 0)
│   │   ├── globals.css         # Tailwind + CSS variables + seat palette
│   │   └── health/page.tsx     # Server-rendered backend health probe
│   └── lib/
│       ├── api.ts              # apiUrl(path) helper
│       └── utils.ts            # cn() classnames helper
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.mjs
└── .env.example
```

## Run locally

```bash
npm install
cp .env.example .env.local        # set NEXT_PUBLIC_API_URL
npm run dev                       # http://localhost:3000
```

## Scripts

| Command           | Purpose                    |
| ----------------- | -------------------------- |
| `npm run dev`     | Dev server with HMR        |
| `npm run build`   | Production build           |
| `npm run start`   | Serve the production build |
| `npm run lint`    | ESLint                     |
| `npm run typecheck` | TypeScript check         |

## Roadmap (Phase 5)

- Auth: login page + role-based nav.
- Employees list + detail.
- Projects list + roster.
- Seat map grid, coloured by status.
- Dashboards with Recharts.
- AI chat panel (`/ai/query` backend endpoint).
