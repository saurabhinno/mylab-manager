# API Migration Guide

This guide explains the migration from Next.js API routes to a standalone Express.js API.

## What Changed

### Before
- API routes were in `app/api/**/route.ts` using Next.js App Router
- API and frontend were in the same application
- Session management used Next.js cookies() helper

### After
- Standalone Express API in `express-api/` directory
- API runs on port 4000, Next.js frontend on port 3000
- Express middleware for cookies and CORS

## New Structure

```
express-api/
├── src/
│   ├── index.ts           # Express app entry point
│   ├── routes/            # API route handlers
│   │   ├── auth.ts        # /api/auth/*
│   │   ├── patients.ts    # /api/patients
│   │   ├── reports.ts     # /api/reports
│   │   ├── tests.ts       # /api/tests
│   │   └── test.ts        # /api/test
│   ├── models/            # Sequelize models (same as before)
│   └── lib/               # Utilities (adapted for Express)
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

## Running the Applications

### Development

**Express API:**
```bash
cd express-api
npm install
npm run dev
```

**Next.js Frontend:**
```bash
npm run dev
```

### Docker

Both applications run together:
```bash
docker-compose up
```

- API: http://localhost:4000
- Frontend: http://localhost:3001
- Database: localhost:3306

## Frontend Changes Needed

Update your Next.js frontend to call the Express API:

### 1. Update API calls

**Before:**
```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password })
});
```

**After:**
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const response = await fetch(`${API_URL}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include', // Important for cookies
  body: JSON.stringify({ email, password })
});
```

### 2. Add environment variable

Create `.env.local` in the Next.js root:
```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Update all fetch calls

Search for all `fetch('/api/` calls and update them to use the API_URL.

## Key Differences

### Session Management

**Next.js (before):**
```typescript
import { cookies } from 'next/headers';
const cookieStore = cookies();
```

**Express (after):**
```typescript
import cookieParser from 'cookie-parser';
app.use(cookieParser());
// Access via req.cookies
```

### Response Handling

**Next.js:**
```typescript
return NextResponse.json({ data });
```

**Express:**
```typescript
return res.json({ data });
```

### Request Body

**Next.js:**
```typescript
const body = await request.json();
```

**Express:**
```typescript
const body = req.body; // via express.json() middleware
```

## Benefits

1. **Separation of Concerns**: API and frontend are independent
2. **Scalability**: Can scale API and frontend separately
3. **Flexibility**: Can use API with other frontends (mobile apps, etc.)
4. **Standard Express**: Use the full Express ecosystem
5. **Better for Microservices**: Easier to split into multiple services later

## Next Steps

1. Install dependencies in `express-api/`
2. Update Next.js frontend to call the Express API
3. Test all endpoints
4. Remove old API routes from `app/api/` (optional)
5. Deploy both services

## Troubleshooting

### CORS Issues
Make sure `credentials: 'include'` is in all fetch calls and CORS is configured in Express.

### Cookie Issues
Ensure `FRONTEND_URL` environment variable is set correctly in the Express API.

### Connection Issues
Check that both services are running and the API_URL is correct.
