# MyLab Workspace

This monorepo contains two applications:

1. **MyLab** — A blood test diagnostics portal for labs
2. **Railway Manager** — A Railway infrastructure management dashboard

---

## MyLab — Blood Test Diagnostics Portal

A full-stack lab reporting platform for doctors and lab technicians (compounders).

### Live URLs

- **Frontend**: https://mylab-app-production.up.railway.app
- **API**: https://mylab-api-production.up.railway.app

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
- **Database**: MySQL 8.0
- **Auth**: Cookie-based sessions with bcrypt
- **Deployment**: Railway (Docker)

### Local Development

```bash
# Start all services with Docker
docker compose up --build

# Frontend: http://localhost:3001
# API: http://localhost:4000
# MySQL: localhost:3306
```

### Project Structure

```
├── app/                    # Next.js frontend pages
│   ├── doctor/             # Doctor dashboard, tests, reports, staff, settings, profile
│   ├── compounder/         # Compounder reports workflow
│   └── login/              # Authentication
├── components/             # Shared UI components (Sidebar, ThemeRegistry)
├── lib/                    # API client utility
├── express-api/            # Express.js backend
│   ├── src/
│   │   ├── routes/         # API endpoints (auth, reports, tests, patients, settings)
│   │   ├── models/         # Sequelize models (User, Report, ReportItem, TestDefinition, etc.)
│   │   └── lib/            # Database config, session helpers
│   └── uploads/            # Signature and logo file storage
├── docker-compose.yml      # Local development orchestration
├── Dockerfile              # Next.js production build
└── railway-manager/        # Railway infrastructure dashboard
```

---

## Railway Manager — Infrastructure Dashboard

A web-based dashboard to manage your Railway account via their GraphQL API.

### Live URL

https://railway-manager-production-4151.up.railway.app

### Features

- **Projects** — View all projects with service status and resource usage
- **Services** — Full management per service:
  - Deployments (list, redeploy, remove, active deployment indicator)
  - Variables (add, delete, view)
  - Settings (start/build commands, replicas, region, healthcheck, cron, restart policy, dockerfile path, sleep mode)
  - Resources (set CPU vCPUs and Memory GB via serviceInstanceLimitsUpdate)
  - Volumes (view size, usage progress bar, mount path)
  - Domains (Railway domains, custom domains)
  - Logs (build logs + runtime logs from latest/active deployment)
- **Usage & Billing** — Real billing data from Railway API:
  - Current usage (actual dollar amount from `customer.currentUsage`)
  - Estimated monthly bill (projected)
  - Per-project resource breakdown (CPU, Memory, Disk, Network)
  - Per-service usage table
  - Plan limits overview
- **Status Detection** — Uses `activeDeployments` to show true running state (not confused by failed builds)
- **React Query Caching** — Navigation between pages is instant (1-min stale time)

### Tech Stack

- Next.js 14, React Query (@tanstack/react-query)
- Railway GraphQL API (backboard.railway.app/graphql/v2)
- Server-side API proxy to avoid CORS
- Dark theme UI

### Authentication

Get your token from https://railway.com/account/tokens and paste it on the login screen.

### Local Development

```bash
cd railway-manager
npm install
npm run dev
# http://localhost:3002
```

---

## Deployment

All services deploy to Railway via CLI:

```bash
# Deploy API
railway up --service mylab-api --path-as-root -d express-api

# Deploy Frontend
railway up -s mylab-app -d

# Deploy Railway Manager
railway up --service railway-manager --path-as-root -d railway-manager
```

### Environment Variables

**mylab-api:**
- `DATABASE_URL` — MySQL connection string (from Railway MySQL plugin)
- `PORT` — 4000
- `FRONTEND_URL` — Frontend URL for CORS
- `NODE_ENV` — production

**mylab-app:**
- `NEXT_PUBLIC_API_URL` — Express API URL (build-time)

**railway-manager:**
- No env vars needed (token stored in browser localStorage)
