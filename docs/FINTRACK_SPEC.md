# FinTrack: Personal Finance & AI Assistant — Technical Specifications & Master System Prompt

**Hackathon Prototype | Theme:** "BUILD IT. SECURE IT. MAKE IT WORK."  
**Target:** Antigravity IDE / Code Agent  

---

## 0. Role & Mission
Build a fully working, secure, demo-ready prototype of **FinTrack** — a personal finance management platform with a provider-agnostic AI assistant.

### Theme: "BUILD IT. SECURE IT. MAKE IT WORK."
- **Build it:** Real database, real APIs, zero mocked/fake UI buttons.
- **Secure it:** Strict RBAC, Row-Level Authorization (IDOR protection), encrypted keys.
- **Make it work:** End-to-end functional flows, reproducible seed data, passing build.

**Engineering Principle:** Work recursively: PLAN -> BUILD -> VERIFY -> REVIEW SECURITY -> ITERATE.  
Never leave the app in a broken state. Every commit/phase must be runnable.

---

## 1. Repo-First Protocol
1. Inspect the existing repository FIRST (structure, dependencies, DB, auth, styling).
2. Do NOT fight the existing stack. Extend it and follow its established patterns.
3. Output a short "Repo Recon Report" before writing code: stack found, conventions, gaps, plan.
4. Primary Stack: Next.js (App Router) + TypeScript + Tailwind CSS + Lucide Icons + SQLite/Prisma or LibSQL for local zero-config reproducibility (or PostgreSQL).

---

## 2. Data & Security Specifications (Non-Negotiable)
- **MONEY STORAGE:** Store all currency values as INTEGER minor units (cents/paise). NEVER store floats. Example: $12.50 is stored as `1250`.
- **ROW-LEVEL AUTHORIZATION:** Every DB query for transactions, budgets, or exports MUST be explicitly scoped by `userId`. Prevent IDOR by construction.
- **AI API KEYS:** Encrypt user-supplied AI keys at rest using AES-256-GCM (store `keyCiphertext`, `iv`, `authTag`). Decrypt ONLY server-side at runtime. Never return raw keys to the client.
- **AI FALLBACK:** Implement a local mock AI fallback engine so the assistant functions offline without an API key.
- **TAMPER-EVIDENT AUDIT LOG:** Maintain a hash-chained audit log (`prevHash` + `hash`) logging login, CRUD, export, and AI operations.
- **INPUT VALIDATION:** Enforce strict Zod schema validation on all request bodies and query parameters.
- **PASSWORD SECURITY:** Argon2id or Scrypt/Bcrypt salted hashing with strict minimum complexity.
- **SESSION SECURITY:** Secure, httpOnly, sameSite cookies containing signed/encrypted session tokens.

---

## 3. Mandatory Core Features
1. **Auth & Roles:** Login, Register, Profile, httpOnly session cookies, RBAC (`USER` vs `ADMIN`). Admin cannot read raw user transactions.
2. **Transactions:** CRUD, categorization (system + custom), multi-filter (date, category, type, range), search, and pagination.
3. **Budgets:** Category/overall creation, percentage consumption tracking, overspend visual states (`Healthy`, `Warning`, `Exceeded`).
4. **Financial Dashboard:** KPI cards (Balance, Income, Expenses, Savings), trend charts, category donut breakdown, budget progress.
5. **Personal Data Export:** Real CSV/JSON downloadable exports scoped strictly to the authenticated user.
6. **AI Assistant:** Tool-calling over the authenticated user's OWN financial data (summarize spending, category totals, budget advice).

---

## 4. UI/UX & Quality Bar
- Modern fintech SaaS design (clean typography, subtle motion, dark/light toggle, generous padding).
- Complete UX handling: Always supply Loading Skeletons, Empty States, Error Toasts, and Accessible Forms.
- Zero dead controls: Every button, filter, or chart component must be connected to real data/APIs.

---

## 5. Execution Plan
- **Step 1:** Output Repo Recon Report & Architecture Plan (`docs/APPROACH.md` & Report).
- **Step 2:** Database Schema & Migrations + Seed Script (`user@demo.com` / `admin@demo.com`).
- **Step 3:** Auth, RBAC Middleware, and Security Primitives (AES-256-GCM + Audit Log).
- **Step 4:** Financial Core API Routes & Zod Validation.
- **Step 5:** Polished Dashboard & Transaction/Budget UI Components.
- **Step 6:** AI Assistant Service & Tool Calling Layer + Offline Engine.
- **Step 7:** Verification (Security, Build, Types, IDOR Checks).
