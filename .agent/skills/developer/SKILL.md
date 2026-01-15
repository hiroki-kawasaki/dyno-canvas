---
name: DynoCanvas Developer
description: When undertaking development, it is essential to understand and execute this skill.
---

# Role
You are an expert engineer in Next.js 16 (App Router), Tailwind CSS v4, and AWS SDK v3.
You are proficient in single-table designs for DynamoDB and produce highly maintainable code that is fully internationalization (i18n)-ready.

# Development Workflow
1. Understand the development that should not be pursued as instructed.
2. Confirm you are on the main branch, create a new branch, and switch to it.
3. Develop the functionality.
4. Once development is complete, run the lint check: `npm run lint`.
5. Make corrections based on the lint check results.
6. After passing the lint check, run the tests: `npm run test`.
7. Make necessary corrections based on the test results (ignore pre-existing errors unrelated to the current task).
8. Create test code for newly added or modified features.
9. Run the newly created tests.
10. Ensure the lint check, tests, and build (`npm run build`) complete without errors.

# Core Knowledge
- `# Features` contains a description of DynoCanvas. Please refer to this to understand the project overview.

# Constraints
- Respond in Japanese.
- **Rules for Code Output**:
    - No unnecessary comments.
    - All comments must be in English.
    - Do not modify areas not specified in the instructions.
- **Strict i18n (Internationalization)**:
    - Hardcoding UI text (buttons, labels, messages, Toasts, etc.) is strictly prohibited. Use translation keys.
- **Styling**:
    - Use Tailwind CSS v4 syntax.
    - Ensure full compatibility with dark mode (`dark:`).

# Features
## Project Overview
- **Next.js Version:** 16.1.1
- **Routing Mode:** App Router
- **Primary Language:** TypeScript

## Technology Stack
- **Framework:** Next.js 16 (React 19.2.3)
- **Styling:** Tailwind CSS v4, PostCSS
- **Database Integration:** AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`)
- **Validation:** Zod
- **Logging:** Pino
- **Editor:** Monaco Editor (React)
- **Testing:** Jest, React Testing Library, aws-sdk-client-mock

# Directory Structure & Routing
```tree
.
├── src
│   ├── actions                 # Server Actions (Data mutations & fetching)
│   │   └── dynamodb            # DynamoDB specific actions
│   ├── app                     # App Router Root
│   │   ├── layout.tsx          # Root Layout (Server Component, fetches system status)
│   │   ├── error.tsx           # Error Boundary
│   │   ├── globals.css         # Global styles
│   │   └── [routes]            # Application routes (implied structure)
│   ├── components              # UI Components
│   │   ├── features            # Feature-specific components (Dashboard, Editor, etc.)
│   │   ├── layout              # Layout components (Header, Sidebar)
│   │   └── shared              # Shared UI elements
│   ├── contexts                # React Context providers (UIContext)
│   ├── lib                     # Shared utilities, configuration, i18n
│   └── proxy.ts                # Next.js 16 Proxy (Replaces Middleware)
├── next.config.ts              # Next.js Configuration
├── package.json                # Dependencies and Scripts
└── tsconfig.json               # TypeScript Configuration
```

# Architecture & Component Model
## Rendering Strategy
- **Dynamic Rendering:** The application heavily relies on dynamic data (DynamoDB) and runtime environment variables.
- **Root Layout:** `src/app/layout.tsx` is an async Server Component that fetches initial settings and system status before rendering the UI shell.

## Server vs. Client Components
- **Server Components:**
  - `src/app/layout.tsx`: Entry point, handles initial data fetching (`getSettings`, `getSystemStatus`).
  - Route Pages (`page.tsx`): Serve as data boundaries and containers for Client Components.
- **Client Components:**
  - `src/components/features/dashboard/TableDashboard.tsx`: Marked with `"use client"`. Handles complex UI state, search forms, and user interactions.
  - `src/contexts/UIContext.tsx`: React Context provider for global UI state.
  - `src/components/layout/Header.tsx`, `Sidebar.tsx`: Interactive layout elements.

# Data Flow & API
## Server Actions & API Routes
- **Location:** `src/actions/`
- **Pattern:** The application uses **Server Actions** exclusively for data mutation and querying, bypassing traditional API routes for internal logic.
- **Key Actions (`src/actions/dynamodb/`):**
  - `searchItems`: Handles DynamoDB queries and scans.
  - `getAccessPatterns`: Retrieves table configuration.
  - `deleteItem`, `batchDeleteItems`: Data mutation.
  - `exportAllItems`: Bulk data retrieval for export.
  - `getTableDetails`: Metadata retrieval.
- **Settings Actions (`src/actions/settings.ts`):**
  - `getSettings`, `getSystemStatus`: Used by Server Components (Layout).

## Data Fetching Patterns
- **Server-Side (RSC):** Direct function calls to async actions (e.g., `await getSettings()`) within the component body (`layout.tsx`).
- **Client-Side:** Client components import Server Actions directly (e.g., `import { searchItems } from '@actions/dynamodb'`) and invoke them within `useEffect` or event handlers.
- **Serialization:** Data returned from Server Actions is serialized (marshalled) and passed to Client Components.

# Configuration & Environment
## Proxy (New in Next.js 16)
- **File:** `src/proxy.ts`
- **Purpose:** Replaces traditional `middleware.ts` for handling request interception at the network boundary.
- **Functionality:** Implements Basic Authentication logic based on the `DYNOCANVAS_AUTH` environment variable.
- **Matcher:** Applies to all routes excluding API, static assets, and favicon.

## Environment Variables
Key variables required in `.env`:
- `DYNOCANVAS_AUTH`: Auth mode ('basic', 'none').
- `DYNOCANVAS_AUTH_USER`, `DYNOCANVAS_AUTH_PASS`: Credentials for basic auth.
- `DYNOCANVAS_REGIONS`: Comma-separated list of AWS regions.
- `DYNAMODB_ENDPOINT`: Custom endpoint (for local DynamoDB).
- `DYNOCANVAS_ADMIN_TABLE_NAME`: Name of the admin metadata table.
- `DYNOCANVAS_READONLY`: Toggle specific write operations.

## Next Config
- **File:** `next.config.ts`
- **Output:** Supports `standalone` mode (controlled by `DYNOCANVAS_STANDALONE` env var) for Docker containerization.
- **External Packages:** `pino`, `pino-pretty` are excluded from the bundle (`serverExternalPackages`).

# Development & Deployment
- **Build Commands:**
  - `npm run dev`: Starts the development server (`next dev`).
  - `npm run build`: Builds the application (`next build`).
  - `npm run start`: Starts production server (`next start`).
- **Testing:**
  - Framework: Jest with `ts-jest`.
  - Environment: `jsdom`.
  - Command: `npm test` (`jest`).
- **Deployment:**
  - Designed for **Docker/Container** environments (implied by `standalone` output config and `Dockerfile` presence).
  - Can be deployed to Vercel or any Node.js compatible host.

# Additional Notes
- **Next.js 16 Specifics:** The project utilizes the new `proxy.ts` convention introduced in Next.js 16, replacing the standard `middleware.ts` file for authentication interception.
- **Single Table Design:** The application is explicitly built to visualize and manage DynamoDB Single Table Design patterns.
- **Local Development:** Includes logic to handle local DynamoDB endpoints, enabling offline development workflows.