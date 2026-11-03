# B.S. Hotel & Restaurant - Frontend

This is the React frontend application for **B.S. Hotel & Restaurant**, featuring room reservations, restaurant menu and online ordering, banquets/events showcase, verified customer reviews, and an admin management dashboard.

## Tech Stack
- **Vite** + **React** (JavaScript `.jsx`, with TypeScript helper types in `src/utils/index.ts`)
- **Tailwind CSS** with brand colors (Deep Navy `#0b1d3a` and Gold `#c59b27`)
- **shadcn/ui** accessible component system
- **react-router-dom** for client-side routing
- **@tanstack/react-query** for state management
- **lucide-react** icons
- **recharts** for metrics and admin visualization
- **date-fns** & **sonner** toast notifications

## Getting Started

### Installation
From the `frontend/` directory, install all dependencies:
```bash
npm install
```

### Development Server
Start the local development server:
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### Production Build
Create an optimized production bundle:
```bash
npm run build
```

## Admin Access
- **URL**: `http://localhost:5173/admin`
- **Default Sign-In**: `admin@bshotel.com` / `admin123` (or click "1-Click Instant Admin Access" on the login screen).
- **Features**: Live management of room bookings, kitchen food orders, menu items and prices, event leads, customer records, and revenue analytics.

## Folder Structure

```
frontend/
├── public/                  # Static assets and SEO sitemap
│   └── sitemap.xml
├── src/
│   ├── admin/               # Admin dashboard modules
│   │   ├── components/      # Admin UI widgets (Charts, StatCard, Forms, StatusPill)
│   │   ├── lib/             # Admin mock data and metrics logic
│   │   ├── pages/           # Admin pages (Bookings, Rooms, Orders, Menu, Reports, etc.)
│   │   ├── AdminContext.jsx # Admin state provider
│   │   ├── AdminGuard.jsx   # Route guard for protected admin area
│   │   └── AdminLayout.jsx  # Admin layout with navigation and header
│   ├── api/                 # API client & local data store (apiClient.js)
│   ├── components/
│   │   ├── home/            # Home landing page sections
│   │   ├── site/            # Public site elements (Header, Footer, QuickBookBar, etc.)
│   │   └── ui/              # shadcn/ui components and image helpers
│   ├── data/                # Source of truth: menus, rooms, events, reviews, policies
│   ├── hooks/               # Custom hooks (mobile viewport, window size, catalog, reviews)
│   ├── lib/                 # Core utilities, AuthContext, QueryClient, SEO, cart, i18n
│   ├── pages/               # Public site routes (Home, Rooms, Restaurant, Booking, etc.)
│   ├── utils/               # TypeScript utility types
│   ├── App.jsx              # Main router and root providers (QueryClient, Auth, Toaster)
│   ├── index.css            # Tailwind directives and theme CSS variables
│   └── main.jsx             # React entry point
├── .gitignore
├── AGENTS.md
├── CLAUDE.md
├── components.json          # shadcn/ui configuration
├── eslint.config.js
├── index.html
├── jsconfig.json            # Path alias configuration (@ -> src/)
├── package.json
├── postcss.config.js
├── README.md
├── tailwind.config.js       # Tailwind configuration with Navy and Gold brand theme
└── vite.config.js           # Vite build configuration with @ alias
```
