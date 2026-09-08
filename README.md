# Bookme — Backend Service

> Multi-tenant booking & reservation REST API server built with Node.js, Express, TypeScript, PostgreSQL (Supabase), and BullMQ.

---

## Quick Start

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL 14+ (or a free Supabase project)
- Redis (optional, for BullMQ async queues)

### 2. Installation
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```

### 4. Database Setup
Execute the DDL and Seed scripts in PostgreSQL / Supabase:
```bash
npm run db:migrate
npm run db:seed
```

### 5. Run Development Server
```bash
npm run dev
```
Server runs at `http://localhost:5000` with health check at `http://localhost:5000/health`.

---

## API Base URL
```
http://localhost:5000/api/v1
```

For full endpoint documentation, see [`API_DOCUMENTATION.md`](file:///C:/Users/USER/.gemini/antigravity-ide/scratch/bookme-backend/API_DOCUMENTATION.md).
