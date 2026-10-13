# MyLab Workspace

This monorepo contains two applications:

1. **MyLab** — A blood test diagnostics portal for labs (desktop + optional web)
2. **Railway Manager** — A Railway infrastructure management dashboard

---

## MyLab — Blood Test Diagnostics Portal

A full-stack lab reporting platform for doctors and lab technicians (compounders).

**Desktop mode (recommended):** runs as a local Windows/macOS app. All data stays on the machine (SQLite + local files). No cloud database required.

### Default Login

- Email: `doctor@mylab.com`
- Password: `password`

### Features

**Doctor Role:**
- Dashboard with daily stats and revenue
- Test catalogue management (34 pre-seeded common blood tests)
- Custom categories, sample types, methods, pricing
- Staff management (add/delete compounders)
- Report template settings (lab name, logo, address, footer)
- Profile with digital signature upload
- View and print all patient reports

**Compounder Role:**
- Single-page workflow — collect samples, enter results, print reports
- Quick sample registration with patient details and test selection
- Tests grouped by category (Hematology, Biochemistry, Thyroid, etc.)
- Live result status indicators (Normal/High/Low) while entering values
- Same-day editing of finalized reports
- Payment tracking (paid/unpaid toggle)
- A4 printable reports with lab header, patient info, results table, signature

**Report Lifecycle:**
1. Sample Collected → patient registered, tests selected
2. Results Entered → lab tech enters measured values
3. Finalized → report ready to view and print

### Tech Stack

- **Frontend**: Next.js 14 (App Router), MUI v5
- **API**: Express.js, Sequelize ORM
- **Database (desktop)**: SQLite file on disk
- **Shell**: Electron (Windows + macOS)
- **Auth**: Cookie-based sessions with bcrypt

### Desktop app (local-only data)

```bash
# One-time setup
npm install
cd express-api && npm install && cd ..

# Run in development (API + Next + Electron window)
npm run desktop:dev
```

In development, SQLite lives at `./data/mylab.sqlite`.

In a packaged app, data is stored under the OS app-data folder (local only):

- **macOS**: `~/Library/Application Support/MyLab/`
- **Windows**: `%APPDATA%\MyLab\`

Files:

- `mylab.sqlite` — patients, reports, tests, settings, users
- `uploads/` — any local upload files

#### Build installers

```bash
# Current platform
npm run desktop:build

# Explicit targets
npm run desktop:build:mac   # .dmg / .zip
npm run desktop:build:win   # NSIS .exe (build on Windows or use CI)
```

Installers are written to `release/`.

#### Build Windows (and macOS) via GitHub Actions

You do not need a Windows machine. CI builds installers on GitHub runners:

1. Push to GitHub (or open a PR that touches desktop files)
2. Or run manually: **Actions → Desktop Build → Run workflow**
3. When the job finishes, download artifacts:
   - `MyLab-Windows` → `.exe` installer
   - `MyLab-macOS` → `.dmg` / `.zip`

```bash
# Trigger from your machine
gh workflow run "Desktop Build"
gh run watch
# Then download:
gh run download --name MyLab-Windows
```

Tags matching `v*` (e.g. `v0.2.0`) also trigger a full desktop build.

### Web / Docker (optional)

Cloud-style Docker + MySQL is still available if you need it:

```bash
docker compose up --build
# Frontend: http://localhost:3001
# API: http://localhost:4000
# MySQL: localhost:3306
```

For local API without Docker (SQLite):

```bash
npm run api:dev          # http://127.0.0.1:4000
NEXT_PUBLIC_API_URL=http://127.0.0.1:4000 npm run dev
```

### Project Structure

```
├── app/                    # Next.js frontend pages
├── components/             # Shared UI components
├── lib/                    # API client utility
├── electron/               # Electron main + preload
├── express-api/            # Express.js backend (SQLite by default)
├── data/                   # Dev SQLite database (gitignored)
├── scripts/prepare-desktop.js
├── electron-builder.yml
├── docker-compose.yml      # Optional MySQL/Docker stack
└── railway-manager/        # Railway infrastructure dashboard
```

---

## Railway Manager — Infrastructure Dashboard

A web-based dashboard to manage your Railway account via their GraphQL API.

### Features

- **Projects** — View all projects with service status and resource usage
- **Services** — Deployments, variables, settings, resources, volumes, domains, logs
- **Usage & Billing** — Current usage and estimated monthly bill
- **React Query Caching** — Fast navigation between pages

### Authentication

Get your token from https://railway.com/account/tokens and paste it on the login screen.

### Local Development

```bash
cd railway-manager
npm install
npm run dev
# http://localhost:3002
```
