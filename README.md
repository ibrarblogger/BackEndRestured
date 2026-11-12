# Restaurant Management System (ERP / POS) — Backend API

Production-grade REST & Real-time Backend for the **Restaurant Management System** React + TypeScript Admin Panel and Point-of-Sale (POS) platform.

## Tech Stack
- **Runtime & Language:** Node.js 20 LTS + TypeScript (Strict Mode), Express.js
- **Database:** Supabase-hosted PostgreSQL, accessed **exclusively via Prisma ORM**
- **Storage:** Supabase Storage (`menu-images`, `receipts`, `avatars`) via server-side `SUPABASE_SECRET_KEY` (`sb_secret_...`), with automatic fallback to local `/uploads` disk storage
- **Real-time:** Socket.io (Live Orders, Kitchen Display System, Notifications)
- **Authentication & Authorization:** Custom JWT (15m Access Token + 7d `httpOnly` Cookie Refresh Token with Rotation & Reuse Detection), bcrypt, Database-driven RBAC
- **Validation & Security:** Zod on all requests (`body`, `params`, `query`), Helmet, CORS whitelist, Rate Limiting, HPP, XSS/Prototype-Pollution Sanitization
- **Background Jobs & Cache:** BullMQ + Redis (automatically falls back to in-memory cache and job runner if `REDIS_URL` is omitted)
- **Logging & Docs:** Pino structured logger with `X-Request-Id` tracing, OpenAPI 3.0 / Swagger UI at `/api/docs`
- **Testing:** Vitest + Supertest

---

## Supabase Database & Storage Setup

### 1. Where to Find Prisma Connection Strings in Supabase
1. Open your project in the **Supabase Dashboard**.
2. Click **Connect** (top navigation bar) → select the **ORMs** tab → choose **Prisma**.
3. Copy the two connection URLs into `/backend/.env`:
   - `DATABASE_URL`: **Transaction Pooler** (port `6543`, ends with `?pgbouncer=true`) — used by the API at runtime.
   - `DIRECT_URL`: **Session Pooler** or **Direct Connection** (port `5432`) — used by Prisma CLI for migrations (`prisma migrate dev` / `prisma migrate deploy`).

> **Important (URL-Encoding Special Characters in Passwords):**  
> If your database password contains special characters (`@`, `#`, `%`, `:`, `/`, `?`, `&`), you **must** URL-encode them in `DATABASE_URL` and `DIRECT_URL` (e.g., `@` → `%40`, `#` → `%23`, `%` → `%25`).

### 2. Where to Find the Supabase Secret Key for Storage
1. In the Supabase Dashboard, navigate to **Project Settings → API Keys**.
2. Copy the **Project URL** into `SUPABASE_URL=https://<project-ref>.supabase.co`.
3. Copy the **Secret Key** (`sb_secret_...` or `service_role` secret) into `SUPABASE_SECRET_KEY`.
   - Never expose `SUPABASE_SECRET_KEY` to the React frontend.
   - If `SUPABASE_URL` or `SUPABASE_SECRET_KEY` are left blank in local development, the backend automatically falls back to saving files under `/backend/uploads/{menu-images,receipts,avatars}`.

### 3. Why Row Level Security (RLS) is Enabled with No Public Policies
Supabase automatically exposes the `public` schema over PostgREST using the `anon` and `authenticated` roles. Because all data access in this architecture goes strictly through our Node.js + Prisma backend (which connects as the `postgres` role with `BYPASSRLS`), migration `20261111000000_enable_rls_all_tables` enables Row Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`) on every table in `public` **without adding any public policies**. This completely blocks direct public/PostgREST access to the database while allowing Prisma unrestricted server-side access.

---

## Scripts

```bash
cd backend

# Install dependencies
npm install

# Generate Prisma Client
npm run prisma:generate

# Run database migrations (development)
npm run prisma:migrate

# Seed initial roles, permissions, Super Admin, and sample restaurant data
npm run prisma:seed

# Start development server (tsx watch)
npm run dev

# Build TypeScript to dist/
npm run build

# Start production server
npm start

# Run ESLint & Vitest test suite
npm run lint
npm test
```

## Connecting the React + TypeScript Admin Panel
- **Base API URL:** `http://localhost:5000/api/v1`
- **Swagger UI Docs:** `http://localhost:5000/api/docs`
- **Postman Collection:** Import [`postman_collection.json`](./postman_collection.json)
- **CORS & Cookies:** Configure Axios / Fetch with `withCredentials: true` (`credentials: 'include'`) so the `httpOnly` `refresh_token` cookie is sent automatically to `/api/v1/auth/refresh` and `/api/v1/auth/logout`.
- **Access Token:** Attach `Authorization: Bearer <accessToken>` on all protected requests.

---

## Multi-Currency (35 Currencies) & Multi-Language (14 Languages)
- **Supported Currencies (35):** `PKR` (`Rs.`), `USD` (`$`), `AED`, `SAR`, `GBP`, `EUR`, `CAD`, `AUD`, `QAR`, `KWD`, `OMR`, `BHD`, `INR`, `BDT`, `LKR`, `MYR`, `SGD`, `IDR`, `THB`, `PHP`, `TRY`, `EGP`, `ZAR`, `NGN`, `CHF`, `SEK`, `NOK`, `DKK`, `CNY`, `HKD`, `JPY`, `KRW`, `NZD`, `BRL`, `MXN`.
- **Supported Languages (14):** `en`, `ur` (RTL), `ar` (RTL), `es`, `fr`, `de`, `tr`, `hi`, `zh`, `ja`, `pt`, `ru`, `it`, `ms`.
- **Admin-Only Policy:** Only Super Admin (`super-admin` / `super_admin`) can update active currency (`PUT /api/v1/branches/currency`) or language (`PUT /api/v1/branches/language`); changes persist directly to Supabase (`Branch.currency` & `Setting`). Other roles receive `403 Forbidden`.
- **POS & Dashboard Localization:** Fetch `GET /api/v1/branches/localization?lang=ur` or `GET /api/v1/dashboard/kpis?lang=ur` for active currency symbols, decimal formatting, text direction (`ltr` / `rtl`), and UI translation strings.

---

## Implemented Modules (Phases 1–5)
1. **Auth, RBAC, Users & Audit Logs:** `/api/v1/auth`, `/api/v1/users`, `/api/v1/audit`
2. **Branches & Localization:** `/api/v1/branches`
3. **Menu, Variants, Add-ons & Combos:** `/api/v1/menu`
4. **Tables, Floors, Reservations & Waitlist:** `/api/v1/tables`
5. **Orders, Split/Merge, Invoices & Kitchen KDS:** `/api/v1/orders`, `/api/v1/kitchen`
6. **Payments, Cash Drawer & Refunds:** `/api/v1/payments`
7. **Inventory, Recipes, Wastage & Stock Takes:** `/api/v1/inventory`
8. **Suppliers, Purchase Orders & Goods Receipts:** `/api/v1/suppliers`
9. **Customers, Loyalty Points, Coupons & CRM Campaigns:** `/api/v1/customers`
10. **Staff, Shifts, Attendance, Leaves & Payroll:** `/api/v1/staff`
11. **Expenses, Receipt Uploads & Accounting (`pnl`, `daily-closing`, `cash-flow`, `tax-report`):** `/api/v1/expenses`
12. **Delivery Zones, Riders & Dispatch Tracking:** `/api/v1/delivery`
13. **Analytics Reports (JSON/CSV/Excel/PDF):** `/api/v1/reports`
14. **KPI Dashboard (30s Cached + Real-time Trends):** `/api/v1/dashboard`
15. **Notifications & Background Jobs (BullMQ / In-memory fallback):** `/api/v1/notifications`, `/api/v1/jobs`


