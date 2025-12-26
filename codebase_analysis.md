# Comprehensive Codebase Analysis: SoT Reputations

## 1. Project Overview

### Project Type
**SoT Reputations** is a full-stack web application designed for **Sea of Thieves** players to track, compare, and share their in-game reputation progress with other pirates. It's a collaborative tool that allows players to:
- Import their reputation data from the official Sea of Thieves website
- Create and manage groups to compare progress with friends
- View detailed achievement/emblem progress across all game factions

### Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend Framework** | Nuxt 4 (Vue 3) |
| **UI Library** | Nuxt UI v4 |
| **Backend Runtime** | Nitro (Nuxt server engine) |
| **Database** | SQLite via better-sqlite3 |
| **Authentication** | Microsoft/Xbox OAuth + nuxt-auth-utils |
| **Internationalization** | @nuxtjs/i18n (FR, EN, ES) |
| **Styling** | Tailwind CSS (via Nuxt UI) |
| **Language** | TypeScript |
| **Containerization** | Docker (Alpine-based) |

### Architecture Pattern
The project follows a **Monolithic Full-Stack Architecture** with:
- **Server-Side Rendering (SSR)** via Nuxt
- **File-based API routing** via Nitro
- **Composables pattern** for shared frontend logic
- **Server-Sent Events (SSE)** for real-time updates

### Language and Versions
- **Node.js**: 20 (Alpine)
- **TypeScript**: 5.9.3
- **Nuxt**: 4.2.1
- **Vue**: 3.x (implicit via Nuxt)

---

## 2. Detailed Directory Structure Analysis

```
sot-reputations/
├── app/                     # Frontend application (Nuxt app directory)
│   ├── app.vue              # Root component with navigation
│   ├── app.config.ts        # UI configuration (colors, theme)
│   ├── assets/css/          # Global CSS (Tailwind + custom)
│   ├── components/          # Reusable Vue components
│   ├── composables/         # Shared Vue composables
│   ├── middleware/          # Client-side route middleware
│   ├── pages/               # File-based routing pages
│   ├── types/               # TypeScript type definitions
│   └── utils/               # Utility functions
├── server/                  # Backend Nitro server
│   ├── api/                 # API endpoints (file-based routing)
│   ├── middleware/          # Server middleware (auth)
│   ├── routes/              # Server routes (OAuth)
│   └── utils/               # Server utilities (DB, SSE)
├── i18n/                    # Internationalization
│   └── locales/             # Translation files (fr, en, es)
├── public/                  # Static assets
├── scripts/                 # Utility scripts
├── data/                    # SQLite database (gitignored)
├── .output/                 # Build output (gitignored in dev)
└── .nuxt/                   # Nuxt generated files
```

### Major Directory Breakdown

#### `/app` - Frontend Application
The main Vue/Nuxt application containing all client-side code:

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `pages/` | File-based routing | `index.vue`, `mes-reputations.vue`, `tutoriel.vue` |
| `components/` | Reusable UI components | `ImportModal.vue`, `ReputationFilters.vue`, `EmblemGradesEditor.vue` |
| `composables/` | Shared reactive logic | `useAuth.ts`, `useGroups.ts`, `useEmblemFilters.ts` |
| `middleware/` | Route guards | Authentication checks |
| `assets/css/` | Global styles | `main.css` |

#### `/server` - Backend API & Logic
Nitro-powered server with SQLite database:

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `api/` | REST API endpoints | Groups, auth, admin, import endpoints |
| `middleware/` | Server middleware | `auth.ts` - session attachment |
| `routes/auth/` | OAuth routes | `microsoft.get.ts` - Xbox login |
| `utils/` | Server utilities | `reputation-db.ts` (600+ lines), `sse.ts` |

#### `/i18n/locales` - Translations
Multi-language support with French as primary:
- `fr.json` - French (default, primary)
- `en.json` - English
- `es.json` - Spanish

---

## 3. File-by-File Breakdown

### Core Application Files

#### Entry Points
| File | Purpose |
|------|---------|
| `app/app.vue` | Root component: header, navigation, footer, theme switching |
| `app/app.config.ts` | UI theming: custom "sot" and "pirate" colors |
| `nuxt.config.ts` | Nuxt configuration: modules, i18n, OAuth, fonts |

#### Key Pages
| File | Route | Purpose |
|------|-------|---------|
| `app/pages/index.vue` | `/` | Home: login or group list |
| `app/pages/mes-reputations.vue` | `/mes-reputations` | Personal reputation view |
| `app/pages/[groupUid]/index.vue` | `/:groupUid` | Group comparison view |
| `app/pages/tutoriel.vue` | `/tutoriel` | Bookmarklet tutorial |
| `app/pages/invite/[code].vue` | `/invite/:code` | Invitation acceptance |
| `app/pages/import/[code].vue` | `/import/:code` | Data import via bookmarklet |
| `app/pages/admin/*.vue` | `/admin/*` | Admin panel pages |

#### Key Components
| File | Purpose |
|------|---------|
| `ImportModal.vue` | Modal for manual JSON data import |
| `ReputationFilters.vue` | Filtering emblems by faction, completion status |
| `EmblemGradesEditor.vue` | Admin: edit grade thresholds |
| `EmblemNameCell.vue` | Emblem display with mobile popover |
| `TableLoader.vue` | Loading skeleton for tables |
| `MaxThresholdCell.vue` | Display max threshold values |

#### Key Composables
| File | Purpose |
|------|---------|
| `useAuth.ts` | Authentication state & methods (login, logout, Xbox) |
| `useGroups.ts` | Group CRUD operations, invitations |
| `useEmblemFilters.ts` | Emblem filtering logic |

### Configuration Files

| File | Purpose |
|------|---------|
| `nuxt.config.ts` | Framework configuration |
| `package.json` | Dependencies & scripts |
| `tsconfig.json` | TypeScript configuration (references Nuxt) |
| `.eslintrc.mjs` | ESLint stylistic rules |
| `Dockerfile` | Production Docker image |
| `docker-compose.yml` | Container orchestration |
| `.env` | Environment variables (gitignored) |

### Data Layer

#### Database Schema (`server/utils/reputation-db.ts`)
The SQLite database contains the following tables:

| Table | Purpose |
|-------|---------|
| `users` | User accounts (Xbox linked) |
| `factions` | Sea of Thieves factions |
| `campaigns` | Faction campaigns/categories |
| `emblems` | Individual achievements |
| `user_emblems` | User progress on emblems |
| `groups` | Comparison groups |
| `group_members` | Group membership & roles |
| `group_invites` | Invitation links |
| `group_pending_invites` | Pending user invitations |
| `sessions` | User sessions |
| `emblem_grade_thresholds` | Known grade thresholds |
| `emblem_translations` | EN/ES translations |

### DevOps Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage Alpine build |
| `docker-compose.yml` | Production deployment |
| `docker-compose.dev.yml` | Development environment |
| `entrypoint.sh` | Container startup script |

---

## 4. API Endpoints Analysis

### Authentication Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/auth/microsoft` | Xbox OAuth flow |
| POST | `/api/auth/login` | Username/password login (legacy) |
| POST | `/api/auth/logout` | Session termination |
| GET | `/api/auth/me` | Current user info |

### Group Management

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/groups` | List user's groups |
| POST | `/api/groups` | Create new group |
| GET | `/api/groups/:uid` | Get group details + reputation data |
| DELETE | `/api/groups/:uid` | Delete group |
| POST | `/api/groups/:uid/invite` | Invite by gamertag |
| GET | `/api/groups/:uid/invite-link` | Get/generate invite link |
| POST | `/api/groups/:uid/promote` | Change member role |
| POST | `/api/groups/:uid/kick` | Remove member |
| POST | `/api/groups/:uid/leave` | Leave group |

### Invitation System

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/invite/:code` | Validate invite code |
| POST | `/api/invite/:code` | Accept invite |
| GET | `/api/me/pending-invites` | User's pending invites |
| POST | `/api/pending-invites/:id/accept` | Accept pending invite |
| POST | `/api/pending-invites/:id/reject` | Reject pending invite |

### Data Import

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/import` | Import reputation JSON |
| POST | `/api/import-temp` | Temp storage for bookmarklet |
| GET | `/api/import-temp/:code` | Retrieve temp data |
| GET | `/api/bookmarklet-version` | Check bookmarklet version |

### Real-time Updates

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/sse/groups/:uid` | SSE connection for group updates |

### Admin Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/admin/users` | List all users |
| PUT | `/api/admin/users/:id/role` | Change user role |
| GET | `/api/admin/factions` | List factions |
| GET | `/api/admin/translations` | Emblems needing translation |
| GET/PUT | `/api/admin/emblems/:id/translations` | Manage translations |
| GET/PUT | `/api/admin/emblems/:id/grades` | Manage grade thresholds |
| POST | `/api/admin/emblems/:id/validate` | Validate new emblem |
| GET | `/api/admin/database/backup` | Download DB backup |
| POST | `/api/admin/database/restore` | Restore DB backup |

### Authentication Pattern
- **Primary**: Xbox Live OAuth via Microsoft (gamertag-based)
- **Session**: Managed via `nuxt-auth-utils`
- **Authorization**: Role-based (admin, moderator, user)
- **Group roles**: chef, moderator, member

---

## 5. Architecture Deep Dive

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Nuxt UI   │  │  Vue 3 SFC  │  │      Composables       │  │
│  │  Components │  │    Pages    │  │ (useAuth, useGroups)   │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         └─────────────────┴─────────────────────┘                │
│                           │                                       │
│                    ┌──────▼──────┐                               │
│                    │  $fetch API │                               │
│                    └──────┬──────┘                               │
└───────────────────────────┼─────────────────────────────────────┘
                            │ HTTP / SSE
┌───────────────────────────┼─────────────────────────────────────┐
│                    NITRO SERVER                                  │
│  ┌────────────────────────▼────────────────────────────────────┐│
│  │                    API Routes                                ││
│  │  /api/auth/*  /api/groups/*  /api/import/*  /api/admin/*   ││
│  └────────────────────────┬────────────────────────────────────┘│
│                           │                                       │
│  ┌────────────────────────▼────────────────────────────────────┐│
│  │                  Server Middleware                           ││
│  │              (auth.ts - session injection)                   ││
│  └────────────────────────┬────────────────────────────────────┘│
│                           │                                       │
│  ┌───────────┬────────────┴────────────┬───────────────────────┐│
│  │           │                          │                       ││
│  │  ┌────────▼────────┐  ┌─────────────▼───────────┐          ││
│  │  │  reputation-db  │  │     SSE Manager         │          ││
│  │  │   (SQLite ORM)  │  │  (real-time updates)    │          ││
│  │  └────────┬────────┘  └─────────────────────────┘          ││
│  │           │                                                  ││
│  │  ┌────────▼────────┐                                        ││
│  │  │   SQLite DB     │                                        ││
│  │  │ (reputation.db) │                                        ││
│  │  └─────────────────┘                                        ││
│  └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────┐
│               EXTERNAL SERVICES                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Microsoft Live OAuth  ───►  Xbox Live API  ───►  Gamertag  ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  seaofthieves.com  ───►  (User's browser via bookmarklet)   ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow: Import Process

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. USER on seaofthieves.com                                      │
│    │                                                              │
│    ├─► Clicks bookmarklet                                        │
│    │   │                                                          │
│    │   ├─► Fetches /api/profilev2/reputation from SoT           │
│    │   │                                                          │
│    │   ├─► POST /api/import-temp (stores JSON temporarily)       │
│    │   │   └─► Returns unique code                               │
│    │   │                                                          │
│    │   └─► Redirects to /import/:code                            │
│                                                                   │
│ 2. USER on sot-reputations/import/:code                          │
│    │                                                              │
│    ├─► If not logged in: Xbox login                              │
│    │                                                              │
│    ├─► GET /api/import-temp/:code (retrieves JSON)               │
│    │                                                              │
│    ├─► POST /api/import (processes JSON)                         │
│    │   │                                                          │
│    │   ├─► Validates French language                             │
│    │   │                                                          │
│    │   ├─► Upserts factions, campaigns, emblems                  │
│    │   │                                                          │
│    │   ├─► Upserts user_emblems (progress)                       │
│    │   │                                                          │
│    │   └─► Broadcasts SSE to user's groups                       │
│    │                                                              │
│    └─► Redirects to /mes-reputations                             │
└──────────────────────────────────────────────────────────────────┘
```

### Key Design Patterns

1. **Composables Pattern**: Encapsulates reusable reactive logic (`useAuth`, `useGroups`)
2. **File-based Routing**: Both pages and API endpoints use filesystem structure
3. **Repository Pattern**: `reputation-db.ts` acts as a data access layer
4. **Observer Pattern**: SSE for real-time group updates
5. **Middleware Chain**: Server middleware for auth injection

---

## 6. Environment & Setup Analysis

### Required Environment Variables

```bash
# OAuth (Required for Xbox login)
NUXT_OAUTH_MICROSOFT_CLIENT_ID=xxx
NUXT_OAUTH_MICROSOFT_CLIENT_SECRET=xxx

# Session (Required)
NUXT_SESSION_PASSWORD=xxx  # 32+ char secret

# Optional
NUXT_PUBLIC_SITE_URL=https://reputations.sot.powange.com
```

### Installation Process

```bash
# 1. Install dependencies
npm install

# 2. Generate Nuxt files
npm run postinstall  # or: nuxt prepare

# 3. Run development server
npm run dev

# 4. Build for production
npm run build
```

### Development Workflow

```bash
# Development
npm run dev         # Start dev server (HMR enabled)

# Quality checks
npm run lint        # ESLint
npm run typecheck   # TypeScript checking

# Build
npm run build       # Production build
npm run preview     # Preview production build

# Utilities
npm run make-admin  # Promote user to admin
```

### Production Deployment

```bash
# Using Docker Compose
docker-compose up -d --build

# Direct Docker
docker build -t sot-reputations .
docker run -p 3000:3000 -v ./data:/app/data sot-reputations
```

### Docker Configuration
- **Base Image**: `node:20-alpine`
- **Multi-stage Build**: deps → builder → runner
- **Persistent Volume**: `/app/data` for SQLite database
- **Port**: 3000 (mapped to 3015 in compose)
- **Healthcheck**: HTTP check on localhost:3000

---

## 7. Technology Stack Breakdown

### Runtime Environment
| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 20.x |
| Server | Nitro | Bundled with Nuxt 4 |
| Process Manager | Native Node (or Docker) | - |

### Frameworks & Libraries

#### Frontend
| Library | Purpose | Version |
|---------|---------|---------|
| Nuxt | Meta-framework | 4.2.1 |
| Vue | UI Framework | 3.x |
| Nuxt UI | Component library | 4.2.1 |
| @nuxtjs/i18n | Internationalization | 10.2.1 |
| @nuxt/fonts | Font loading | 0.11.4 |

#### Backend
| Library | Purpose | Version |
|---------|---------|---------|
| better-sqlite3 | SQLite driver | 12.5.0 |
| bcrypt | Password hashing | 6.0.0 |
| nuxt-auth-utils | Session management | 0.5.26 |

#### Icons
| Library | Purpose |
|---------|---------|
| @iconify-json/lucide | Lucide icons |
| @iconify-json/simple-icons | Brand icons (Xbox) |

### Database
- **Engine**: SQLite 3
- **Driver**: better-sqlite3 (synchronous, native bindings)
- **Location**: `/app/data/reputation.db`
- **Migrations**: Inline in `getReputationDb()` function

### Build Tools
| Tool | Purpose |
|------|---------|
| Vite | Bundler (via Nuxt) |
| ESLint | Linting |
| TypeScript | Type checking |
| vue-tsc | Vue type checking |

### Deployment
| Tool | Purpose |
|------|---------|
| Docker | Containerization |
| Docker Compose | Orchestration |
| Alpine Linux | Container OS |

---

## 8. Visual Architecture Diagram

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                    │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │      Reverse Proxy        │
                    │   (proxy-network Docker)  │
                    └─────────────┬─────────────┘
                                  │ :3015
┌─────────────────────────────────▼───────────────────────────────────────┐
│                        Docker Container: sot-reputations                 │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                         Node.js 20 Alpine                          │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                        Nuxt 4 / Nitro                        │  │  │
│  │  │                                                               │  │  │
│  │  │  ┌─────────────────┐    ┌─────────────────────────────────┐ │  │  │
│  │  │  │    Frontend     │    │            Backend              │ │  │  │
│  │  │  │  ┌───────────┐  │    │  ┌─────────────────────────────┐│ │  │  │
│  │  │  │  │ Vue 3 SFC │  │    │  │    API Routes (/api/*)     ││ │  │  │
│  │  │  │  └───────────┘  │    │  └─────────────────────────────┘│ │  │  │
│  │  │  │  ┌───────────┐  │    │  ┌─────────────────────────────┐│ │  │  │
│  │  │  │  │  Nuxt UI  │  │    │  │   OAuth Routes (/auth/*)   ││ │  │  │
│  │  │  │  └───────────┘  │    │  └─────────────────────────────┘│ │  │  │
│  │  │  │  ┌───────────┐  │    │  ┌─────────────────────────────┐│ │  │  │
│  │  │  │  │   i18n    │  │    │  │  SSE Manager (real-time)   ││ │  │  │
│  │  │  │  │ FR/EN/ES  │  │    │  └─────────────────────────────┘│ │  │  │
│  │  │  │  └───────────┘  │    │  ┌─────────────────────────────┐│ │  │  │
│  │  │  └─────────────────┘    │  │    reputation-db.ts        ││ │  │  │
│  │  │                          │  │   (Data Access Layer)      ││ │  │  │
│  │  │                          │  └──────────────┬──────────────┘│ │  │  │
│  │  │                          │                 │               │ │  │  │
│  │  │                          └─────────────────┼───────────────┘ │  │  │
│  │  │                                            │                 │  │  │
│  │  └────────────────────────────────────────────┼─────────────────┘  │  │
│  │                                               │                    │  │
│  │  ┌────────────────────────────────────────────▼─────────────────┐  │  │
│  │  │                    SQLite Database                            │  │  │
│  │  │                   /app/data/reputation.db                     │  │  │
│  │  └───────────────────────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  Volume: sot-data → /app/data (persistent)                               │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL SERVICES                               │
│                                                                           │
│  ┌─────────────────────┐    ┌────────────────────────────────────────┐   │
│  │  Microsoft Live     │───►│         Xbox Live API                  │   │
│  │  (OAuth Provider)   │    │  • User authentication                 │   │
│  │  login.live.com     │    │  • XSTS token exchange                 │   │
│  └─────────────────────┘    │  • Gamertag retrieval                  │   │
│                              └────────────────────────────────────────┘   │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                     seaofthieves.com                               │   │
│  │  • Source of reputation data (fetched via user's bookmarklet)     │   │
│  │  • API endpoint: /api/profilev2/reputation                        │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

### Database Schema Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATABASE SCHEMA                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐        │
│  │   users     │         │   groups    │         │  sessions   │        │
│  ├─────────────┤    ┌────├─────────────┤         ├─────────────┤        │
│  │ id (PK)     │    │    │ id (PK)     │         │ id (PK)     │        │
│  │ username    │    │    │ uid         │         │ token       │        │
│  │ password_   │    │    │ name        │         │ user_id(FK) │────┐   │
│  │   hash      │    │    │ created_by  │◄────────│ expires_at  │    │   │
│  │ microsoft_id│    │    │   (FK)      │         └─────────────┘    │   │
│  │ is_admin    │◄───┼────│ created_at  │                            │   │
│  │ is_moderator│    │    └─────────────┘                            │   │
│  │ last_import │    │           │                                    │   │
│  │   _at       │    │           │                                    │   │
│  └─────────────┘    │    ┌──────▼──────┐                            │   │
│        │            │    │group_members│                            │   │
│        │            │    ├─────────────┤         ┌──────────────┐   │   │
│        │            │    │ id (PK)     │         │group_invites │   │   │
│        │            └────│ group_id(FK)│         ├──────────────┤   │   │
│        │                 │ user_id(FK) │◄────────│ id (PK)      │   │   │
│        │                 │ role        │         │ group_id(FK) │   │   │
│        └─────────────────│ joined_at   │         │ code         │   │   │
│                          └─────────────┘         │ created_by   │───┘   │
│                                                   │ max_uses     │       │
│  ┌─────────────┐         ┌─────────────┐         └──────────────┘       │
│  │  factions   │         │  campaigns  │                                │
│  ├─────────────┤    ┌────├─────────────┤         ┌───────────────────┐  │
│  │ id (PK)     │    │    │ id (PK)     │         │group_pending_     │  │
│  │ key         │◄───┼────│ faction_id  │         │     invites       │  │
│  │ name        │    │    │   (FK)      │         ├───────────────────┤  │
│  │ motto       │    │    │ key         │         │ id (PK)           │  │
│  └─────────────┘    │    │ name        │         │ group_id (FK)     │  │
│                     │    │ description │         │ user_id (FK)      │  │
│                     │    │ sort_order  │         │ invited_by (FK)   │  │
│                     │    └─────────────┘         └───────────────────┘  │
│                     │           │                                        │
│                     │    ┌──────▼──────┐                                │
│                     │    │   emblems   │                                │
│                     │    ├─────────────┤         ┌───────────────────┐  │
│                     │    │ id (PK)     │         │emblem_translations│  │
│                     └────│ campaign_id │◄───────┐├───────────────────┤  │
│                          │   (FK)      │        ││ id (PK)           │  │
│                          │ key         │        ││ emblem_id (FK)    │  │
│                          │ name        │        ││ locale (en/es)    │  │
│                          │ description │        ││ name              │  │
│                          │ image       │        ││ description       │  │
│                          │ max_grade   │        │└───────────────────┘  │
│                          │ validated   │        │                       │
│                          └─────────────┘        │┌───────────────────┐  │
│                                 │               ││emblem_grade_      │  │
│                                 │               ││    thresholds     │  │
│                          ┌──────▼──────┐        │├───────────────────┤  │
│                          │user_emblems │        ││ emblem_id (PK,FK) │──┘
│                          ├─────────────┤        ││ grade (PK)        │   │
│                          │ id (PK)     │        ││ threshold         │   │
│                          │ user_id(FK) │        │└───────────────────┘   │
│                          │ emblem_id   │────────┘                        │
│                          │   (FK)      │                                 │
│                          │ value       │                                 │
│                          │ threshold   │                                 │
│                          │ grade       │                                 │
│                          │ completed   │                                 │
│                          └─────────────┘                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Hierarchy

```
app.vue (Root)
├── UApp
│   ├── UHeader
│   │   ├── Navigation Links (navItems)
│   │   ├── UColorModeSwitch
│   │   └── UDropdownMenu (locale selector)
│   ├── UMain
│   │   └── NuxtPage (router outlet)
│   │       ├── pages/index.vue
│   │       │   ├── Login Screen (Xbox button)
│   │       │   └── Group List + Creation Modal
│   │       ├── pages/mes-reputations.vue
│   │       │   ├── ReputationFilters
│   │       │   └── Reputation Table
│   │       ├── pages/[groupUid]/index.vue
│   │       │   ├── ReputationFilters
│   │       │   ├── Group Members Panel
│   │       │   └── Comparison Table
│   │       ├── pages/tutoriel.vue
│   │       │   └── Bookmarklet Instructions
│   │       ├── pages/invite/[code].vue
│   │       │   └── Invitation Acceptance
│   │       ├── pages/import/[code].vue
│   │       │   └── Import Confirmation
│   │       └── pages/admin/*.vue
│   │           ├── Admin Dashboard
│   │           ├── User Management
│   │           ├── Faction Management
│   │           ├── Translation Management
│   │           └── Database Backup/Restore
│   └── UFooter
└── UToaster (global notifications)
```

---

## 9. Key Insights & Recommendations

### Code Quality Assessment

#### Strengths
1. **Well-structured codebase**: Clear separation between frontend and backend
2. **Type safety**: Full TypeScript with proper type definitions
3. **Internationalization**: Complete i18n support with 3 languages
4. **Modern stack**: Latest Nuxt 4, Vue 3, and modern tooling
5. **Real-time updates**: SSE implementation for live group updates
6. **Security**: OAuth-based auth, bcrypt for legacy passwords, proper session management

#### Areas for Improvement
1. **Database migrations**: Currently inline in `getReputationDb()`, could use a proper migration system
2. **Test coverage**: No test files detected
3. **API documentation**: No OpenAPI/Swagger specs
4. **Error handling**: Could benefit from centralized error handling
5. **Logging**: Basic console.log, could use structured logging

### Security Considerations

#### Current Security Measures
- Xbox OAuth for authentication (no password storage for new users)
- bcrypt hashing for legacy passwords
- Session-based authentication via encrypted cookies
- Admin/moderator role separation
- CSRF protection via session tokens

#### Recommendations
1. **Rate limiting**: Add rate limiting to API endpoints, especially `/api/import`
2. **Input validation**: Add schema validation (Zod/Yup) for API inputs
3. **CORS**: Review CORS settings for bookmarklet domain
4. **Audit logging**: Log admin actions and suspicious activity
5. **SQL injection**: Current code uses parameterized queries (good), but validate inputs

### Performance Optimization Opportunities

1. **Database indexing**: Most indexes are in place, monitor query performance
2. **SSE connection management**: Consider connection pooling/limits
3. **Image optimization**: Emblem images are URLs, consider CDN caching
4. **API response caching**: Cache faction/emblem data (rarely changes)
5. **Lazy loading**: Already using dynamic imports for admin pages

### Maintainability Suggestions

1. **Extract database layer**: Move from single file to separate repository files
2. **Add unit tests**: Focus on `reputation-db.ts` logic
3. **Add E2E tests**: Playwright for critical user flows
4. **Documentation**: Add JSDoc comments to exported functions
5. **API versioning**: Consider `/api/v1/` prefix for future changes

### Scalability Considerations

Current architecture is well-suited for moderate traffic. For scaling:

1. **Database**: SQLite is single-writer; for high concurrency, consider PostgreSQL
2. **Sessions**: Currently in-memory; use Redis for multi-instance deployment
3. **SSE**: Each instance maintains its own connections; use Redis pub/sub for multi-instance
4. **Caching**: Add Redis caching layer for frequently accessed data

### Feature Enhancement Ideas

1. **Progress tracking over time**: Store historical snapshots
2. **Achievement notifications**: Notify when group members complete emblems
3. **Export functionality**: Export progress to CSV/PDF
4. **API for third-party apps**: Public API with auth tokens
5. **Discord integration**: Webhook notifications to Discord servers

---

## Summary

**SoT Reputations** is a well-architected Nuxt 4 full-stack application that effectively solves the problem of tracking and comparing Sea of Thieves reputation progress. The codebase demonstrates modern web development practices with TypeScript, Vue 3 composition API, and server-side rendering.

Key technical highlights:
- **Nuxt 4 + Nitro**: Modern meta-framework with excellent DX
- **SQLite + better-sqlite3**: Simple, performant data storage
- **Xbox OAuth**: Seamless authentication for gamers
- **SSE**: Real-time collaborative features
- **Multi-language**: French-first with EN/ES support

The application is production-ready and deployed via Docker, with a clean separation of concerns and maintainable code structure.
