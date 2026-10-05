# Project Approach & Architecture — Build Secure 24

**Team ID:** [Pending Team Registration]  
**Project Name:** FinTrack — Personal Finance & AI Assistant  
**Team Size:** [2 or 4 Members]  
**Primary Track / Domain:** Secure FinTech & Applied AI  

---

## 1. Problem Understanding, Scope & Threat Model

### 1.1 Problem Statement & Real-World Motivation
Modern personal finance applications often present high risk surfaces: users store highly sensitive transaction records, income streams, and personal financial habits. Most apps either rely on third-party cloud AI integrations that leak PII/unencrypted data or suffer from Insecure Direct Object References (IDOR), allowing malicious users to query other users' financial records.
FinTrack solves this by delivering an end-to-end secure, provider-agnostic personal finance platform with:
1. Strict Row-Level Authorization (IDOR immunity).
2. Integer minor-unit arithmetic preventing financial calculation drifts.
3. AES-256-GCM encrypted API key storage at rest with strict server-side decryption.
4. An offline-capable AI financial assistant that executes tool-calling exclusively over the authenticated user's scoped data without leaking PII to external models.
5. A tamper-evident cryptographic hash-chained audit log (`prevHash` + `hash`).

### 1.2 Target Users & Personas
- **Registered User (`USER`):** Manages personal transactions, budgets, category structures, and interacts with the AI financial assistant. Can only access their own records.
- **System Administrator (`ADMIN`):** Manages platform health, user account statuses, and system audit logs. Strictly prohibited by RBAC and row-level authorization from reading raw user transaction records or financial metrics.
- **Security Auditor:** Inspects the tamper-evident cryptographic audit trail to verify that no log entries have been modified or backdated.

### 1.3 Threat Model & Attack Surface
- **Critical Assets:** User authentication credentials (passwords, sessions), financial transaction records, custom budget configurations, user-supplied AI API keys (OpenAI/Anthropic/Gemini), and the audit trail.
- **Potential Attack Vectors:**
  - **IDOR / Broken Object-Level Authorization:** Querying `/api/transactions/[id]` or `/api/budgets` with another user's ID.
  - **Credential Stuffing & Session Hijacking:** Brute force or session theft via JavaScript access.
  - **API Key Exfiltration:** Compromise of database dumping raw provider keys.
  - **Audit Log Tampering:** Malicious alteration of records to cover unauthorized activity.
  - **Data Precision Drift:** Floating-point rounding errors causing financial balance corruption.
- **OWASP Top 10 Mitigations:**
  - *A01: Broken Access Control:* Row-Level Authorization enforced at the query layer (`WHERE user_id = ?`).
  - *A02: Cryptographic Failures:* AES-256-GCM authenticated encryption for secrets; Argon2id/Scrypt for passwords; SHA-256 hash chains for audit logs.
  - *A03: Injection:* Parameterized queries via Prisma/SQLite + strict Zod schema validation on ingress.
  - *A05: Security Misconfiguration:* `httpOnly`, `sameSite=lax`, `secure` cookies for sessions; no raw stack traces in responses.

---

## 2. Technical Architecture & Secure System Design

### 2.1 High-Level Architecture Overview
FinTrack follows a secure multi-tier modular architecture built within `src/`:
- **Client Presentation Tier (React / Next.js App Router):** Server & Client components, responsive SaaS dashboard, KPI cards, visual charts, budget trackers, and interactive AI chat modal.
- **API & Security Gateway Tier (Next.js Route Handlers + Zod):** Strict request schema validation, authentication session decoding, and RBAC enforcement.
- **Domain Services Tier (`src/lib/`):**
  - `auth`: Session management, password hashing, RBAC.
  - `crypto`: AES-256-GCM key encryption/decryption utilities.
  - `audit`: Hash-chained audit logger maintaining cryptographic integrity.
  - `finance`: Transaction & budget calculations using integer minor units.
  - `ai`: Provider-agnostic assistant with local tool-calling and offline mock fallback engine.
- **Persistence Tier (SQLite via Prisma / Drizzle / Better-SQLite3):** Zero-external-dependency, reproducible database engine with atomic transactions and explicit foreign keys.

### 2.2 Data Flow & Component Interaction
1. User submits credentials -> `/api/auth/login` verifies hash, generates encrypted session, sets `httpOnly` cookie, and logs an audit entry.
2. Ingress request hits `/api/transactions` -> Middleware/Session resolver extracts `userId`. Query strictly enforces `WHERE userId = session.userId`.
3. Currency calculation converts user input to minor units (e.g. `$45.99` -> `4599`) before database storage.
4. AI assistant request receives user prompt -> Dispatches query to local tool executor scoped to `userId` -> Generates structured response using verified local numbers.

### 2.3 Technology Stack Rationale
- **Backend & Client:** Next.js 15+ (App Router) with TypeScript — unified type safety, React Server Components for zero-bundle data fetching, and native route handlers.
- **Styling:** Tailwind CSS + Vanilla CSS tokens — clean fintech aesthetics, responsive glassmorphism, and dark/light modes.
- **Database:** SQLite (via Prisma or Better-SQLite3) — provides immediate, reliable zero-configuration local execution that works out-of-the-box on any evaluator's machine without requiring Docker or external PostgreSQL services.
- **Validation:** Zod — strict runtime type validation on all request bodies, query parameters, and environment configs.
- **Cryptography:** Node.js native `crypto` module (`aes-256-gcm`, `scryptSync`, `sha256`) — audited, zero-third-party dependency risk.

### 2.4 Defense-in-Depth Security Controls
1. **Authentication & Session Security:** Salted scrypt/argon2 password hashes; tamper-resistant signed cookies with `httpOnly`, `sameSite=lax`.
2. **Authorization & Access Control (Row-Level):** Database queries are constructed with mandatory `userId` predicate; role guards prevent `ADMIN` from accessing raw user finances.
3. **Integer Minor Units:** All currency values stored as integers (cents/paise); formatting only applied at presentation boundary.
4. **Encrypted AI Keys at Rest:** AES-256-GCM with unique 96-bit IVs and 128-bit authentication tags; encryption master key isolated in environment variables.
5. **Tamper-Evident Hash Chaining:** Every audit record computes `hash = SHA256(prevHash + timestamp + action + userId + details)`.
6. **Input Validation:** Zod schemas reject extra properties and enforce bounds on numbers, strings, and dates.

---

## 3. Implementation Milestones & 24-Hour Timeline

| Milestone / Phase | Time Window | Key Objectives & Deliverables | Security Verification | Status |
|---|---|---|---|---|
| **Phase 1: Foundation & Recon** | 0h – 2h | Contract onboarding, repo reconnaissance, architecture specifications (`docs/APPROACH.md`, `docs/FINTRACK_SPEC.md`) | Log integrity & rules check | `Complete` |
| **Phase 2: DB Schema & Auth** | 2h – 6h | SQLite schema, migration/init, seed data (`user@demo.com`, `admin@demo.com`), password hashing, sessions | Auth session & scrypt verification | `Planned` |
| **Phase 3: Core Financial Services** | 6h – 12h | Transaction CRUD, categorization, multi-filtering, budgets, and integer arithmetic | IDOR testing & Zod validation | `Planned` |
| **Phase 4: Security Layer & AI Engine** | 12h – 16h | AES-256-GCM key vault, hash-chained audit log, AI assistant tool caller with offline fallback | Crypto round-trip & audit chain verification | `Planned` |
| **Phase 5: SaaS Dashboard & UX** | 16h – 20h | KPI cards, charts, budget health monitors, CSV/JSON export, responsive UI polish | Zero dead controls check | `Planned` |
| **Phase 6: Verification & Freeze** | 20h – 24h | Full test suite, security boundary audit, commit freeze in `metadata/submission.yaml` | Build, typecheck, & freeze verification | `Planned` |

---

## 4. Architecture Decision Records (ADRs)

### ADR-001: Representation of Monetary Values in Integer Minor Units
- **Status:** Accepted
- **Context:** Floating point arithmetic (`0.1 + 0.2 = 0.30000000000000004`) causes severe calculation drift and rounding vulnerabilities in financial ledgers.
- **Options Considered:**
  1. Standard IEEE 754 Floating Point (`REAL` / `FLOAT`).
  2. String / Decimal representations.
  3. Minor Unit Integers (cents/paise as `INTEGER`).
- **Decision & Rationale:** Option 3 is selected. All monetary balances, transaction amounts, and budget limits are stored as integers representing minor currency units. Conversion to display format (`$X.YY`) is handled strictly in the UI presentation layer.
- **Security & Performance Trade-offs:** Eliminates precision drift, enables exact equality comparisons, and optimizes database index performance.

### ADR-002: Row-Level Scoping for IDOR Immunity
- **Status:** Accepted
- **Context:** Broken Object Level Authorization (IDOR) is the most critical vulnerability in financial apps where changing an ID parameter in an API call leaks other users' records.
- **Options Considered:**
  1. Application-level check after fetching records (`record.userId === session.userId`).
  2. Enforced SQL query scoping (`WHERE id = ? AND userId = ?`).
- **Decision & Rationale:** Option 2 is chosen. By injecting the authenticated `userId` directly into every SQL query clause, unauthorized access attempts return empty sets or 404s at the database level, preventing memory leaks or race conditions.
- **Security & Performance Trade-offs:** Guaranteed protection against IDOR; high query selectivity using compound indices `(userId, id)`.

### ADR-003: AES-256-GCM Envelope Encryption for AI Provider Keys
- **Status:** Accepted
- **Context:** Users may supply their own OpenAI, Anthropic, or Gemini API keys. Storing these in plaintext exposes credentials if database snapshots or backups leak.
- **Options Considered:**
  1. Plaintext storage.
  2. Asymmetric RSA encryption.
  3. Symmetric AES-256-GCM authenticated encryption.
- **Decision & Rationale:** Option 3 is chosen. AES-256-GCM provides confidentiality and integrity (authentication tag), protecting against ciphertext tampering. Keys are decrypted strictly in memory at runtime when executing LLM calls.
- **Security & Performance Trade-offs:** High throughput, hardware-accelerated AES instructions, zero plaintext key exposure.

### ADR-004: Tamper-Evident Hash-Chained Audit Trail
- **Status:** Accepted
- **Context:** Regulatory and security standards require immutable logging of authentication, CRUD, and data export events.
- **Options Considered:**
  1. Standard append-only logging table.
  2. Cryptographic hash-chained audit ledger (`prevHash` + `SHA256`).
- **Decision & Rationale:** Option 2 is chosen. Each audit entry computes `SHA-256(prevHash + entryPayload)`, making retroactive modification or record deletion immediately detectable.
- **Security & Performance Trade-offs:** Negligible cryptographic overhead per operation; allows client/auditor verification of audit trail integrity.

---

## 5. Engineering Journal & Real-Time Decision Log

### [2026-10-05 12:35 IST] Entry 1: Project Initialization & Scope Lock
- **Focus:** Contract onboarding agreement, repository reconnaissance, specification lock (`docs/FINTRACK_SPEC.md`), and architectural blueprint.
- **Key Challenges:** Establishing zero-configuration reproducible database stack on Windows/Node 24 while maintaining enterprise-grade security primitives.
- **Resolution:** Outlined architecture with Next.js App Router, SQLite/Prisma, native Node.js crypto primitives, and strict row-level authorization.

---

## 6. Testing, Security Verification & Deployment Record

### 6.1 Testing & Security Verification Strategy
- **Unit & Integration Tests:** End-to-end tests for password hashing, AES-256-GCM encryption/decryption, row-level authorization IDOR tests, and audit hash chain verification.
- **Static Analysis & Linting:** Strict TypeScript type checking (`tsc --noEmit`), ESLint validation.

### 6.2 Deployment Verification
- **Live Deployment Platform:** Self-contained Next.js production build (`npm run build && npm start`) / Vercel ready.
- **Deployment URL:** [To be populated upon deployment]
- **Health Check Endpoint:** `/api/health`
