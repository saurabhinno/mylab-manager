# MyLab Express API

Express.js backend API for the MyLab application.

## Setup

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Start the development server:
```bash
npm run dev
```

The API will run on `http://localhost:4000`

### Production Build

```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### Patients
- `GET /api/patients?q=search` - Search patients

### Reports
- `GET /api/reports` - Get all reports
- `POST /api/reports` - Create new report

### Tests
- `GET /api/tests` - Get all test definitions
- `POST /api/tests` - Create new test definition

### Health Check
- `GET /api/test` - Database connection test
- `GET /health` - API health check

## Docker

The API is configured to run in Docker via docker-compose. See the main project's docker-compose.yml.

## Environment Variables

**Desktop / local (default):**
- `DESKTOP=1` or `DB_DIALECT=sqlite` — use SQLite
- `SQLITE_PATH` — path to the `.sqlite` file (default: `./data/mylab.sqlite`)
- `UPLOADS_DIR` — local uploads directory
- `PORT` — Server port (default: 4000)
- `FRONTEND_URL` — Frontend URL for CORS
- `NODE_ENV` — Environment (development/production)

**Optional MySQL (set `MYSQL_HOST` or `DATABASE_URL`, and do not set `DESKTOP=1`):**
- `DATABASE_URL` / `MYSQL_URL` — MySQL connection string
- `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`
