# B.S. Hotel & Restaurant - Project Conventions

## Tech Stack
- **Framework**: Vite + React (JavaScript, `.jsx` files; TypeScript utility definitions in `src/utils/index.ts`)
- **Styling**: Tailwind CSS with custom brand theme (Deep Navy `#0b1d3a` and Gold `#c59b27`), CSS variables, `tailwindcss-animate`
- **Component UI**: shadcn/ui components (`src/components/ui/`)
- **State & Routing**: `react-router-dom` v6/v7, `@tanstack/react-query`
- **Icons & Visuals**: `lucide-react`, `recharts`
- **Feedback & Utilities**: `sonner`, `date-fns`, `clsx`, `tailwind-merge`

## Folder Structure
```
frontend/
├── public/           # Static web assets and sitemap
├── src/
│   ├── admin/        # Admin dashboard (pages, layout, guard, context, and components)
│   ├── api/          # Internal client & local database services (apiClient.js)
│   ├── components/   # UI components
│   │   ├── home/     # Landing page sections and preview components
│   │   ├── site/     # Public customer-facing layout and widgets
│   │   └── ui/       # shadcn/ui atomic components and media helpers
│   ├── data/         # Single source of truth for mock data, menus, prices, and policies
│   ├── hooks/        # Reusable custom React hooks
│   ├── lib/          # Utilities, contexts (AuthContext), query client, cart, API helpers
│   ├── pages/        # Customer-facing public route pages
│   └── utils/        # TypeScript utility definitions
```

## Important Development Conventions
1. **Keep Content in `src/data/`**:
   - All static content, menu items, room specifications, event packages, policies, and mock data reside in `src/data/`.
2. **No Hard-Coded Menu or Prices in Components**:
   - Never embed hard-coded dishes, prices, room tariffs, or policy text directly inside `.jsx` component files.
3. **Route Structure**:
   - Public pages are housed under `src/pages/` inside `SiteLayout`.
   - Admin dashboards and management pages reside in `src/admin/pages/` inside `AdminLayout` protected by `AdminGuard` under `/admin`.
4. **Imports**:
   - Always use the `@` alias for imports mapping to `src/` (e.g., `@/components/ui/button`, `@/data/menu`).
