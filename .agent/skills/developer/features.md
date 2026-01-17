# Project Name: DynoCanvas

## Project Overview
- **Next.js Version:** 16.1.1
- **Routing Mode:** App Router
- **Primary Language:** TypeScript

## Technology Stack
- **Framework:** Next.js 16 (React 19.2.3)
- **Styling:** Tailwind CSS v4, PostCSS
- **Database Integration:** AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-sts`, `@aws-sdk/credential-providers`)
- **Validation:** Zod
- **Logging:** Pino (`src/lib/logger.ts`)
- **Editor:** Monaco Editor (React)
- **Testing:** Jest, React Testing Library, aws-sdk-client-mock

# Directory Structure & Routing
```tree
.
├── src
│   ├── actions                 # Server Actions (Data mutations & fetching)
│   │   ├── admin.ts            # Admin & Access Pattern management
│   │   ├── settings.ts         # User settings, profile & region management
│   │   └── dynamodb            # DynamoDB specific actions
│   │       ├── item-command.ts # Item mutations (Put, Update, Delete)
│   │       ├── item-query.ts   # Item retrieval (Scan, Query)
│   │       ├── table-command.ts# Table mutations (Create, Delete)
│   │       └── table-query.ts  # Table retrieval (List, Describe)
│   ├── app                     # App Router Root
│   │   ├── layout.tsx          # Root Layout (Server Component, fetches system status)
│   │   ├── error.tsx           # Error Boundary (Resets on profile/region change)
│   │   ├── globals.css         # Global styles
│   │   └── [routes]            # Application routes (tables, settings)
│   ├── components              # UI Components
│   │   ├── features            # Feature-specific components (Dashboard, Editor, etc.)
│   │   ├── layout              # Layout components (Header, Sidebar, EnvSwitcher)
│   │   └── shared              # Shared UI elements (Modals, etc.)
│   ├── contexts                # React Context providers (UIContext)
│   ├── lib                     # Shared utilities, configuration, i18n, logger
│   └── proxy.ts                # Next.js 16 Proxy (Auth & request interception)
├── next.config.ts              # Next.js Configuration
├── package.json                # Dependencies and Scripts
└── tsconfig.json               # TypeScript Configuration
```

# Architecture & Component Model
## Rendering Strategy
- **Dynamic Rendering:** Heavily relies on dynamic data and runtime environment variables.
- **Root Layout:** `src/app/layout.tsx` fetches initial settings, profiles, and system status.

## Server vs. Client Components
- **Server Components:**
  - `src/app/layout.tsx`: Entry point.
  - Route Pages (`page.tsx`): Serve as data boundaries.
- **Client Components:**
  - Interactive UI like Table dashboards, settings forms, and modals.
  - `src/contexts/UIContext.tsx`: Global UI state management.

# Data Flow & API
## Server Actions & API Routes
- **Location:** `src/actions/`
- **Pattern:** Uses Server Actions for all backend logic.
- **Key Modules:**
  - `admin.ts`: Manages the DynoCanvas admin table and saved access patterns.
  - `settings.ts`: Manages environment modes (AWS/Local), regions, profiles, and language.
  - `dynamodb/`: Separated into commands (mutations) and queries (retrieval) for items and tables.

## Data Fetching Patterns
- **Server-Side (RSC):** Direct calls to Server Actions in `layout.tsx` and pages.
- **Client-Side:** Direct invocation of Server Actions via `useEffect` or event handlers. Uses `cookie` based state for persistence across shifts.

# Configuration & Environment
## AWS Profiles & Roles
- **Support:** Automatically detects available AWS profiles from `~/.aws/credentials` and `~/.aws/config`.
- **Switching:** Users can switch profiles and regions in the UI; state is persisted in cookies and triggers UI refreshes.

## Proxy (Next.js 16)
- **File:** `src/proxy.ts`
- **Functionality:** Handles Basic Authentication if enabled.

## Environment Variables
- `DYNOCANVAS_AUTH`: Auth mode.
- `DYNOCANVAS_REGIONS`: Custom region list.
- `DYNAMODB_ENDPOINT`: Local DynamoDB endpoint.
- `DYNOCANVAS_READONLY`: Read-only mode toggle.

# Development & Deployment
- **Build Commands:** `npm run dev`, `npm run build`, `npm run start`.
- **Testing:** `npm test` (Jest).
- **Deployment:** Docker-ready (standalone output).

# Additional Notes
- **Secure Deletion:** Table deletion requires explicit confirmation by typing the table name.
- **Error Handling:** Global error boundary is designed to reset when the user switches AWS profiles or regions, allowing recovery from credential-related errors.