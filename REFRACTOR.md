# REFRACTOR.md — cart2heavy → TypeScript

> Status: **ALL PHASES DONE on `refactor/typescript` — image published to Docker Hub (`matthew552/cart2heavy`)** · Author: Claude (with Matthew) · Date: 2026-11-05
>
> This document is the step-by-step plan for rewriting cart2heavy in TypeScript, making it work
> better, giving it a minimal UI, dockerizing it, and publishing the image to Docker Hub. Each
> phase ends with a checklist and is ticked off as it's done.

---

## 0. The goal (what you asked for)

1. Rewrite **everything** in **TypeScript**.
2. Make the website **work better** — **build on top of** the core idea, don't replace it.
3. **UI/UX must be minimal.**
4. `README.md` with **screenshots of the finished product**.
5. Dockerize the server into an **image** and **push it to your Docker Hub** (`matthew552/...`).
6. Anyone who clones the repo runs **`docker compose up`** and gets a working store on **localhost**.

---

## 1. What exists today (read before writing a single line)

### 1.1 The core idea (this stays)

A MERN shop with **three roles** working on one order pipeline:

```
 Customer (storefront)           Admin panel                 Logistics panel
 ──────────────────────          ─────────────────           ───────────────────────
 browse / search / category  →   add & delete products   →   see confirmed orders
 top-3 "most bought"             add & delete categories     update shipping state
 server-side cart                (weight: S / M / B / L)     (received → shipping →
 checkout via Stripe             list orders, CONFIRM them    shipped → delivering →
 my orders (state + paid)                                     delivered)
 profile (name + photo)
```

| Part | Path | Stack |
|---|---|---|
| API | `Backend/` | Express 4, Mongoose 8, JWT, bcrypt, multer, Stripe, nodemailer (set up, never used) |
| Storefront | `frontend/front-end/` | React 18 + Vite, axios, Context for global state |
| Admin | `admin/Admin/` | React 18 + Vite (no navbar, no styling, no login) |
| Logistics | `logistics/LogisticsPanel/` | React 18 + Vite (single page, no login) |

Data model: `user {name, email, password, profile_img, cartObj}`, `product {name, category, price,
image, desc, total_bought}`, `category {name, weight}`, `order {userID, items[], amount, email,
address, state, date, payment, order_conformmation}`.

### 1.2 Bugs found (to be fixed by the rewrite)

| # | Where | Problem |
|---|---|---|
| B1 | `product_view.jsx`, `my_cart.jsx` | Call `GET /api/items/getall_item` but the route is `POST` and paginated (2/page). **Home product grid never loads and the cart is always "empty"** — this is the bug in `todo.txt`. |
| B2 | `order_controls.js` | Stripe `unit_amount` gets **dollars instead of cents** → a $250 item is charged $2.50. |
| B3 | `order_controls.js` | Prices/amount come **from the client** → anyone can set their own price. $25 minimum is also checked on the client value. |
| B4 | `order_controls.js` | Order is created and **cart is cleared before payment**; cancelling Stripe loses the cart. |
| B5 | `my_cart.jsx` → `update_total_item_ordered_amnt` | "Most bought" counter is bumped by a **separate unauthenticated call before payment**, and by **+1 regardless of quantity**. |
| B6 | `Order_paymentVerificaiton` | **Unauthenticated**; trusts `?success=true` → anyone can mark any order paid. |
| B7 | `order_model.js` | `date: { default: Date.now() }` runs **once at boot** → every order gets the same date. |
| B8 | `lazy_category_loading` | `totalPages` counts **all** products, not the category's. |
| B9 | `handle_order_status` | `save()` not awaited; responds with an array of pending promises. |
| B10 | `navbar.jsx` | Logged-out cart icon navigates to `/cart` (route doesn't exist). |
| B11 | `searchResult` | Product page depends on in-memory context → **refreshing the page breaks it**. |
| B12 | `server.js` | CORS only allows `:5173` → admin/logistics apps on other ports are blocked. |
| B13 | Everywhere | `http://localhost:5000` hard-coded in ~30 places. |

### 1.3 Security problems

| # | Problem | Fix in the rewrite |
|---|---|---|
| S1 | **MongoDB Atlas user + password hard-coded** in `Backend/config/db.js` and pushed to GitHub | Config via env only; **you should change that Atlas password** |
| S2 | **`Backend/.env` committed** (JWT secret + Stripe test key) | `.env` git-ignored, `.env.example` committed; **roll the Stripe test key** |
| S3 | **Admin & logistics endpoints have no auth** (add/delete products, confirm orders, change status) | Role-based auth: `customer` / `admin` / `logistics` |
| S4 | `update_user_pfp` has no auth → **anyone can rename / re-photo any user** by ID | Only ever act on the logged-in user |
| S5 | JWT stored in `localStorage` | httpOnly, SameSite cookie (SPA and API share an origin) |
| S6 | Uploads: extension check only, no size limit | MIME + extension check, 5 MB limit, random file names |
| S7 | `Backend/node_modules` committed (5,550 files) | Deleted from the repo, git-ignored |

---

## 2. Target architecture

**Still MERN, now fully TypeScript.** Same database, same domain, same three roles — rebuilt cleanly.

```
                       docker compose up
 ┌───────────────────────────────────────────────────────────────┐
 │  app  (matthew552/cart2heavy)            http://localhost:8080│
 │  ┌──────────────────────────┐   ┌──────────────────────────┐  │
 │  │ Express 5 API (TS)       │   │ React 19 SPA (TS)        │  │
 │  │ /api/*                   │   │ /          storefront    │  │
 │  │ /uploads/*  (volume)     │◄──│ /admin     admin panel   │  │
 │  │ serves the built SPA     │   │ /logistics logistics     │  │
 │  └────────────┬─────────────┘   └──────────────────────────┘  │
 │               │                                               │
 │  ┌────────────▼───────┐   ┌──────────────────────────────┐    │
 │  │ mongo:7  (volume)  │   │ mailpit  http://localhost:8025│    │
 │  └────────────────────┘   │ (catches order emails)       │    │
 │                           └──────────────────────────────┘    │
 └───────────────────────────────────────────────────────────────┘
```

**One image, one port.** The API serves the built frontend → no CORS, no hard-coded URLs, cookie
auth just works, and Docker Hub gets a single image.

### 2.1 Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript (strict)** everywhere | the main ask |
| Monorepo | **pnpm workspaces** | one install, shared types between API and web |
| API | **Express 5**, **Mongoose** (typed schemas), **Zod** validation | same framework you know, typed + validated |
| Auth | `jsonwebtoken` in httpOnly cookie, **bcryptjs** (pure JS, so the image is easy to build for several CPU types), role middleware | fixes S3–S5 |
| Uploads | `multer` → `/app/uploads` (Docker volume) | same idea as now, safer |
| Payments | `PaymentProvider` interface: **`mock`** (default) and **`stripe`** (when `STRIPE_SECRET_KEY` is set) | `compose up` works with no Stripe account; real Stripe with one env var |
| Email | `nodemailer` → **Mailpit** in compose | finishes the email feature you started |
| Logging / hardening | `pino-http`, `helmet`, `express-rate-limit` | |
| Web | **React 19 + Vite + React Router + TanStack Query** | server state, caching, refresh-safe URLs |
| Forms | `react-hook-form` + the **same Zod schemas** as the API | one source of truth |
| UI | **Tailwind CSS v4** + a handful of small components (button, input, card, dialog, select, table, badge), `lucide-react` icons, `sonner` toasts (replace every `window.alert`) | minimal by default |
| Tests | **Vitest + Supertest + mongodb-memory-server** (API), **Playwright** (e2e + README screenshots) | |
| Quality | ESLint (flat config, typescript-eslint), Prettier, `tsc --noEmit` | |
| Runtime | Node 24 LTS (`node:24-alpine`), non-root user | |

### 2.2 Repository layout (after)

```
cart2heavy/
├─ apps/
│  ├─ api/                     # Express 5 + TS
│  │  ├─ src/
│  │  │  ├─ config/env.ts      # Zod-validated env
│  │  │  ├─ db.ts
│  │  │  ├─ models/            # User, Product, Category, Order (typed)
│  │  │  ├─ modules/           # auth, users, products, categories, cart, orders, payments, admin, logistics
│  │  │  │   └─ <x>/{routes,controller,service}.ts
│  │  │  ├─ middleware/        # auth, requireRole, validate, upload, errorHandler
│  │  │  ├─ payments/          # provider.ts, mock.ts, stripe.ts
│  │  │  ├─ mail/              # transporter + templates
│  │  │  ├─ seed/              # seed.ts + images/ (compressed copies of today's product images)
│  │  │  ├─ app.ts             # builds the express app (used by tests)
│  │  │  └─ server.ts          # starts it
│  │  └─ test/
│  └─ web/                     # React 19 + Vite + TS
│     └─ src/
│        ├─ app/               # router, providers, layouts
│        ├─ features/          # catalog, product, search, cart, checkout, orders, account,
│        │                     # admin/{dashboard,products,categories,orders}, logistics
│        ├─ components/ui/     # minimal primitives
│        └─ lib/               # api client, money formatting, auth hooks
├─ packages/
│  └─ shared/                  # Zod schemas, DTO types, OrderStatus, weight enum, money utils
├─ e2e/                        # Playwright tests + screenshot script
├─ docs/screenshots/           # images used in README
├─ Dockerfile                  # multi-stage → one image
├─ docker-compose.yml          # app + mongo + mailpit, works with no .env
├─ .env.example
├─ .dockerignore / .gitignore
├─ README.md                   # rewritten, with screenshots
└─ REFRACTOR.md                # this file
```

The old `Backend/`, `frontend/`, `admin/`, `logistics/` folders and `todo.txt` are **deleted** once
the new app does everything they did (they stay in git history). The 10 product images (48 MB) are
compressed and reused as seed data. `user_images/` (74 MB of uploaded test avatars) is not carried
over.

---

## 3. Domain model (TypeScript)

Kept the same, with types, constraints and a few fields added. **Money is stored as integer
cents** (fixes B2 for good).

```ts
type Role = 'customer' | 'admin' | 'logistics';

interface User {
  name: string; email: string /* unique, lowercase */; passwordHash: string;
  role: Role; avatar?: string /* optional now; initials shown if none */;
  cart: { product: ObjectId; quantity: number }[];   // was cartObj {id: qty}
  createdAt; updatedAt;
}

type Weight = 'small' | 'medium' | 'big' | 'large';  // same 4 sizes as the admin form
interface Category { name: string /* unique */; slug: string; weight: Weight; }

interface Product {
  name: string; description: string; priceCents: number; image: string;
  category: ObjectId /* now a real reference, was a free-text name */;
  totalBought: number /* bumped by quantity, only after payment */;
  isActive: boolean /* hide instead of hard-delete if it was ever ordered */;
  createdAt; updatedAt;
}

type OrderStatus =            // the same steps as today, as an enum
  | 'processing'              // "Item Is Being Processed!"
  | 'confirmed'               // "Order Has Been Confirmed!"           (admin)
  | 'received'                // "Received By The Logistics Team."     (logistics)
  | 'shipping'                // "Being Shipped By The Logistics Teams."
  | 'shipped'                 // "Shipped By The Logistics Teams."
  | 'out_for_delivery'        // "Being Delivered By The Logistics Teams."
  | 'delivered'               // "Succesfully Delivered ..."
  | 'cancelled';              // new: admin can cancel

interface Order {
  user: ObjectId; email: string;
  items: { product: ObjectId; name: string; priceCents: number; quantity: number; weight: Weight }[]; // snapshot
  subtotalCents: number; deliveryCents: number; totalCents: number;   // computed ON THE SERVER
  address: { fullName; line1; line2?; city; postalCode; country; phone };
  status: OrderStatus; statusHistory: { status: OrderStatus; at: Date; by: ObjectId }[];
  payment: { provider: 'mock' | 'stripe'; status: 'pending' | 'paid' | 'failed'; sessionId?: string; paidAt?: Date };
  createdAt; updatedAt;                                                 // fixes B7
}
```

Business rules kept: **$25 minimum order** and the **delivery charge** (today it's 180 cents =
$1.80; it becomes the `DELIVERY_FEE_CENTS` setting, default `180`). Both enforced on the server.

---

## 4. API (old → new)

All under `/api`, JSON, validated by Zod, consistent `{ error: { code, message } }` on failure,
proper HTTP status codes (today most errors return 200 with `success:false`).

| Old | New | Auth |
|---|---|---|
| `POST /user/register` (photo required) | `POST /auth/register` (photo optional) | — |
| `POST /user/login` | `POST /auth/login` → sets cookie | — (rate-limited) |
| — | `POST /auth/logout` | user |
| `get_userImg`, `get_user_cred`, `Token_decryption` | `GET /auth/me` | user |
| `update_user_pfp`, `del_user_pfp` | `PATCH /me` (name, avatar), `DELETE /me/avatar` | user |
| — | `PATCH /me/password` | user |
| `POST /items/getall_item?currPage` + `getItemsPageNumbers` | `GET /products?page&limit&category&q&sort` → `{ items, page, totalPages, total }` | — |
| `POST /items/fetchSingleItems` | `GET /products/:id` | — |
| `POST /items/getItemBySearch` | `GET /products/suggest?q=` (instant dropdown) | — |
| `GET /items/get_mostBoughtProducts` | `GET /products?sort=popular&limit=3` | — |
| `POST /category/lazyLoad_categories` | `GET /products?category=<slug>` (fixes B8) | — |
| `GET /category/get_categories`, `lazyLoad_categoriesSelection` | `GET /categories` (with product counts) | — |
| `POST /cart/get_cart` | `GET /cart` (product details + line totals) | user |
| `POST /cart/add_to_cart`, `remove_from_cart` | `PUT /cart/items/:productId {quantity}`, `DELETE /cart/items/:productId` | user |
| — | `POST /cart/merge` (guest cart → account on login) | user |
| `POST /order/place_order` | `POST /orders/checkout {address}` → `{ orderId, redirectUrl }` (prices from DB) | user |
| `POST /order/order_payment_verification` | `POST /orders/:id/verify` (asks Stripe/mock; idempotent) + `POST /payments/stripe/webhook` | user (owner) |
| — | `POST /orders/:id/pay` (retry payment on an unpaid order) | user (owner) |
| `POST /order/my_orders` | `GET /orders/mine`, `GET /orders/:id` | user |
| `POST /items/add_item`, `del_item` | `POST /admin/products`, `PATCH /admin/products/:id` (**new: edit**), `DELETE /admin/products/:id` | admin |
| `add_category`, `remove_categories` | `POST/PATCH/DELETE /admin/categories/:id` (can't delete one that's still in use) | admin |
| `fetch_all_orders` + `getTotalPages` | `GET /admin/orders?page&status&payment` | admin |
| `confirm_order` | `POST /admin/orders/:id/confirm` (only paid orders), `POST /admin/orders/:id/cancel` | admin |
| — | `GET /admin/stats` (revenue, orders by status, top products) | admin |
| `GET /order/filter_confirmed_orders` | `GET /logistics/orders?status` (confirmed+, paid only) | logistics |
| `POST /order/update_order_status` (batch) | `PATCH /logistics/orders/:id/status` (only forward steps, recorded in history) | logistics |
| `GET /` → "Hi" | `GET /api/health` (used by the Docker healthcheck) | — |
| `/item_images/*`, `/user_images/*` | `/uploads/products/*`, `/uploads/avatars/*` | — |

### 4.1 Checkout flow (fixes B2–B6)

```
cart ──► POST /orders/checkout {address}
           server: load products from DB, compute totals, check $25 min,
                   create Order(payment: pending), keep the cart
           ──► redirectUrl
                ├─ stripe: Stripe Checkout session (amounts in cents)
                └─ mock:   /checkout/mock/:orderId  ("Test payment — Pay / Cancel")
           ◄── back to /checkout/result?orderId=…
         POST /orders/:id/verify   → server asks the payment provider whether it was paid
           paid  → payment.status=paid, clear the cart, totalBought += quantity,
                   email "order received" (Mailpit)
           not   → order stays unpaid, cart is kept, "Retry payment" button
```

Stripe webhook (`checkout.session.completed`) runs the **same idempotent** "mark paid" function,
so a closed tab still records the payment.

---

## 5. Frontend — one minimal app, three areas

### 5.1 Pages

**Storefront (`/`)**
- **Home**: short hero line + search, category chips, "Most bought" (top 3), product grid with
  category filter, sort (popular / newest / price ↑↓), pagination. Replaces the 4-slide "Next"
  carousel.
- **Product `/products/:id`**: real URL (fixes B11), image, description, category, price,
  "bought N times", quantity stepper, add to cart.
- **Search**: instant dropdown in the header (300 ms debounce, ↑/↓/Enter with the keyboard) +
  `/search?q=` results page.
- **Cart `/cart`**: lines with +/−/remove, subtotal, delivery, total, $25 minimum hint. **Guest
  cart** in localStorage, merged into the account on login (you no longer get "Log In To Purchase
  Items!" just for adding something).
- **Checkout `/checkout`**: address form (saved from the last order), order summary → pay.
- **Orders `/orders`**, **order detail `/orders/:id`**: status timeline (processing → … →
  delivered), paid/unpaid badge, retry payment.
- **Account `/account`**: name, avatar (upload/remove), change password.
- **Login / Register**: their own pages (today they're popups inside the navbar).

**Admin (`/admin`, role `admin`)**
- **Dashboard**: revenue, number of orders, orders per status, top products.
- **Products**: table with search + pagination, **create / edit** (new) / delete, image preview.
- **Categories**: name + weight (S/M/B/L), product count, add / edit / delete.
- **Orders**: table filtered by status and payment, detail drawer, **Confirm** (paid only), cancel.

**Logistics (`/logistics`, role `logistics`)**
- Queue of confirmed + paid orders, filter by status, address + items, **package size taken from
  the category weight** (that's what `weight` was for), move to the next step with one click and
  a toast — replaces the "pick in a dropdown → Save → page reload" flow.

### 5.2 Minimal UI/UX rules

- Neutral palette (white / zinc), **one accent colour**, system font stack, generous whitespace.
- No decorative images or gradients. Product photos are the only imagery.
- One primary action per screen. Clear empty, loading (skeletons) and error states.
- Toasts instead of `window.alert`. No full-page reloads.
- Works on mobile (tested at 390 px); keyboard and screen-reader friendly (labels, focus rings,
  aria attributes).
- Dark mode follows the operating system setting.
- Header: logo · search · cart (count badge) · account menu. Footer: one line with your
  credit + GitHub/Instagram links (kept from the current footer).

---

## 6. Docker, Compose & Docker Hub

### 6.1 Dockerfile (multi-stage, one image)
1. `base` — `node:24-alpine`, corepack-enabled pnpm.
2. `deps` — `pnpm fetch` / `pnpm install --frozen-lockfile` (cached layer).
3. `build` — build `packages/shared` → `apps/web` (Vite) → `apps/api` (tsc/tsup).
4. `runtime` — only production `node_modules` + `apps/api/dist` + `apps/web/dist` + seed images;
   `USER node`; `EXPOSE 8080`; `HEALTHCHECK` on `/api/health`; `NODE_ENV=production`.
   - No secrets in the image (checked with `docker history` / by inspecting the image).
   - Build steps run on the build machine's own CPU type and the last stage has no `RUN`
     commands, so a **linux/amd64 + linux/arm64** image (Intel/AMD **and** Apple Silicon) can be
     built without CPU emulation.

### 6.2 `docker-compose.yml` (works with **no** `.env`)
```yaml
services:
  app:
    image: matthew552/cart2heavy:latest   # pulled from Docker Hub …
    build: .                              # … or built locally if needed
    ports: ["${APP_PORT:-8080}:8080"]
    environment:
      MONGODB_URI: mongodb://mongo:27017/cart2heavy
      JWT_SECRET: ${JWT_SECRET:-dev-only-change-me}
      APP_URL: http://localhost:${APP_PORT:-8080}
      PAYMENT_PROVIDER: ${PAYMENT_PROVIDER:-mock}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:-}
      SMTP_HOST: mailpit
      SMTP_PORT: 1025
      SEED_ON_START: "true"               # fills an empty DB with demo data + accounts
    volumes: [uploads:/app/uploads]
    depends_on:
      mongo: { condition: service_healthy }
  mongo:
    image: mongo:7
    volumes: [mongo-data:/data/db]
    healthcheck: { test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"] }
  mailpit:
    image: axllent/mailpit
    ports: ["8025:8025"]
volumes: { mongo-data: {}, uploads: {} }
```
→ `git clone … && cd cart2heavy && docker compose up` → **http://localhost:8080** (store),
**/admin**, **/logistics**, **http://localhost:8025** (emails).

Port **8080** instead of 5000 because macOS uses 5000 for AirPlay. Can be changed with `APP_PORT`.

### 6.3 Seed data (first start only, if the DB is empty)
- Categories: e.g. Motherboards, Phones, Laptops, Desktops (with weights).
- ~12 products using compressed versions of the existing images (MSI MPG / MAG / MEG ACE /
  MEG GODLIKE + the Mobile / Laptop / Desktop images).
- Demo accounts (local only — README says to change them):
  `admin@cart2heavy.local / admin1234`, `logistics@cart2heavy.local / logistics1234`,
  `demo@cart2heavy.local / demo1234`.
- A few orders at different stages so the admin/logistics screens aren't empty.

### 6.4 Publishing
- `docker buildx build --platform linux/amd64,linux/arm64 -t matthew552/cart2heavy:1.0.0 -t matthew552/cart2heavy:latest --push .`
  (multi-platform builds may need a `docker-container` buildx builder — created only if needed).
- Check it: remove the local image → `docker pull` → run `docker compose up` from a **fresh clone**.

---

## 7. Execution plan — step by step

Each phase ends with something that runs. Commits are made per phase on a branch (see §9).

### Phase 1 — Clean slate & tooling
- [x] Branch `refactor/typescript`.
- [x] Root `package.json` (pnpm workspaces), `pnpm-workspace.yaml`, `tsconfig.base.json` (strict),
      ESLint + Prettier, `.gitignore`, `.dockerignore`, `.env.example`, `.nvmrc`.
- [x] Remove the committed `Backend/node_modules` and `Backend/.env` from git.
- [x] Scaffold `packages/shared`, `apps/api`, `apps/web`.
- **Done when:** `pnpm install && pnpm typecheck && pnpm lint` pass on the empty scaffold.

### Phase 2 — Shared package
- [x] Zod schemas + inferred types: auth, user, product, category, cart, address, order, pagination,
      API error shape.
- [x] `OrderStatus` (+ allowed transitions, labels shown to the user), `Weight`, money helpers
      (`formatCents`, `toCents`).
- **Done when:** builds and both apps import it.

### Phase 3 — API core
- [x] Env config (Zod, fails fast with a clear message), Mongo connection, pino logging, helmet,
      error handler, 404, `/api/health`.
- [x] Mongoose models with TS types + indexes (email unique, category slug, product text index).
- [x] Auth: register/login/logout/me, bcryptjs, JWT cookie, `requireAuth`, `requireRole`,
      login/register rate limiting.
- [x] Upload middleware (MIME + size), file-cleanup helper.
- **Done when:** Vitest + Supertest auth tests pass (register, login, me, wrong password, role guard).

### Phase 4 — API features
- [x] Products: list (filter / search / sort / paginate), detail, suggest, admin create/edit/delete.
- [x] Categories: list with counts, admin CRUD with "in use" protection.
- [x] Cart: get, set quantity, remove, merge guest cart.
- [x] Orders & payments: checkout (server-side pricing, $25 min, delivery fee), `PaymentProvider`
      (mock + stripe), verify (idempotent), retry pay, Stripe webhook, my orders.
- [x] Admin: orders list/filter, confirm (paid only), cancel, stats.
- [x] Logistics: queue, step forward with `statusHistory`.
- [x] Mail: order received / confirmed / shipped / delivered emails (plain + simple HTML).
- [x] Seed script (`pnpm seed`, plus `SEED_ON_START`) + compressed seed images.
- **Done when:** tests for pricing rules, the cart, checkout→verify (mock), role permissions, and
      status steps all pass.

### Phase 5 — Web: base & storefront
- [x] Vite + React + TS + Tailwind v4, router with layouts (store / admin / logistics), TanStack
      Query, typed API client (`fetch`, cookies), auth context (`/auth/me`), route guards.
- [x] UI primitives (button, input, select, card, badge, dialog, table, skeleton, toast).
- [x] Header (search dropdown, cart badge, account menu), footer.
- [x] Home, product page, search page, category filter, pagination, sort.
- [x] Cart (guest + logged in, merge on login), checkout, mock payment page, payment result page.
- [x] Login, register, account (name / avatar / password), orders list + detail with timeline.
- **Done when:** full customer flow works against the dev API.

### Phase 6 — Web: admin & logistics
- [x] Admin layout + dashboard stats.
- [x] Products table + create/edit form (image upload, preview), delete with confirmation.
- [x] Categories manager.
- [x] Orders table + filters + detail + confirm/cancel.
- [x] Logistics queue + one-click status step + package-size label.
- **Done when:** a seeded order can go processing → confirmed → … → delivered, and the customer
      sees each step.

### Phase 7 — Docker
- [x] Multi-stage `Dockerfile`, `.dockerignore`, API serves SPA (history fallback) + `/uploads`.
- [x] `docker-compose.yml` (app + mongo + mailpit, healthchecks, volumes, defaults).
- [x] Image hygiene: non-root user, no dev dependencies, no secrets, reasonable size (target < 250 MB; actual: ~312 MB unpacked / ~71 MB compressed, of which the `node:24-alpine` base is ~255 MB – see the progress log).
- **Done when:** `docker compose up --build` on a clean machine state → store at :8080, seeded.

### Phase 8 — Tests, e2e & screenshots
- [x] Playwright e2e against the compose stack: register → add to cart → checkout → mock pay →
      admin confirm → logistics deliver → customer sees "Delivered".
- [x] Screenshot script (desktop + one mobile shot): home, product, cart, checkout, orders timeline,
      admin dashboard, admin products, logistics → `docs/screenshots/*.png`.
- **Done when:** e2e is green and the screenshots look right.

### Phase 9 — README & cleanup
- [x] Delete old `Backend/`, `frontend/`, `admin/`, `logistics/`, `todo.txt`.
- [x] New `README.md`: what it is, screenshots, quick start (`docker compose up`), demo accounts,
      environment variables table, how to turn on Stripe, how to develop locally (`pnpm dev`),
      project structure, scripts, a short architecture note, credits.
- [x] Update this file: tick every box and add a "What changed" summary.

### Phase 10 — Publish
- [x] `docker buildx … --push` to Docker Hub: `matthew552/cart2heavy:1.0.0` and `:latest` (same digest
      `sha256:ddb7ba25…`, platforms `linux/amd64` + `linux/arm64`).
- [x] Checked from a clean state: fresh `git clone` of the branch → `docker compose pull` pulled the image from Docker Hub →
      `docker compose up` → health OK, the three demo logins work, products are served.

---

## 8. How we'll know it works (verification)

| Check | How |
|---|---|
| Types | `pnpm typecheck` (all workspaces, strict) |
| Lint | `pnpm lint` |
| API logic | `pnpm test` — Vitest + Supertest + in-memory MongoDB |
| End to end | `pnpm e2e` — Playwright against `docker compose up` |
| Compose from scratch | fresh clone → `docker compose up` → `curl localhost:8080/api/health` → log in as each demo account |
| Image | `docker pull matthew552/cart2heavy:latest` on a machine state without the local image; `docker image inspect` shows no secrets |
| Security fixes | tests: changing the price in the request has no effect; customer gets 403 on `/api/admin/*` and `/api/logistics/*`; verifying someone else's order gets 403/404 |

---

## 9. Decisions & open questions

| Topic | Decision |
|---|---|
| Stack | Still MERN, all TS: Express 5 + Mongoose + React 19 + Vite |
| Payments | `mock` by default (so `compose up` needs no account), Stripe when `STRIPE_SECRET_KEY` is set |
| Port | `8080` (set with `APP_PORT`) |
| Old folders | deleted at the end, kept in git history |
| Docker Hub image | ✅ **`matthew552/cart2heavy`** — one image, tags `1.0.0` + `latest`, amd64 + arm64 |
| One app vs three apps | ✅ **One app with role logins** — `/` storefront, `/admin`, `/logistics` |
| Leaked secrets in git history | ✅ **Removed from the code from now on**, history left as it is. **Your to-do:** change the MongoDB Atlas password and roll the Stripe test key |
| Git workflow | ✅ **Commit each phase on `refactor/typescript`, no push** — you review and merge/push yourself |

---

## 10. Progress log

- 2026-11-05 — Read the whole codebase, wrote this plan.
- 2026-11-05 — Decisions made (§9): one image `matthew552/cart2heavy`, one app with role logins,
  secrets removed from now on (history kept), commit per phase on `refactor/typescript`, no push.
- 2026-11-05 — Phase 1 done: pnpm workspace, strict TS 6.0 (typescript-eslint doesn't support TS 7 yet), ESLint 10 flat config, Prettier,
  `.gitignore`/`.dockerignore`/`.env.example`, scaffolds for `packages/shared`, `apps/api`, `apps/web`; `Backend/node_modules` + `Backend/.env`
  untracked. `pnpm typecheck && pnpm lint && pnpm test` pass.
- 2026-11-05 — Phase 2 done: `packages/shared` has the enums/labels, money helpers (integer cents), order-status rules, Zod schemas and
  wire DTO types; 15 unit tests. Small additions to the API list: `GET /api/config` (shop rules for the guest cart) and `GET /products?ids=` (to render a guest cart).
- 2026-11-05 — Phase 3 done: Zod-validated env (`loadConfig`), pino/helmet/error handler, Mongoose models, auth (register/login/logout/me), `/api/me` account
  endpoints (name, avatar, password), cookie JWT, role guards, same-origin check, rate-limited login, hardened image upload (type + signature + 5 MB +
  random names). 28 Vitest/Supertest tests on an in-memory MongoDB. Product search uses an escaped case-insensitive regex instead of a Mongo text index
  (partial words like "mpg" must match for the instant dropdown), so no text index is created.
- 2026-11-05 — Phase 4 done: products (list/filter/search/sort/paginate, detail, suggest, admin create/edit/delete with hide-if-ordered), categories
  (counts, admin CRUD, in-use protection), server-side cart (+ guest merge), checkout with server-side pricing and the $25 minimum, `PaymentGateway`
  (`mock` with its own "test payment" endpoints, `stripe` in cents + webhook), idempotent verify/mark-paid, retry payment, admin orders/confirm/cancel/stats,
  logistics queue with forward-only steps and status history, emails (received / confirmed / shipped / delivered / cancelled), seed (`pnpm seed`,
  `SEED_ON_START`) with 8 compressed photos (48 MB -> 0.6 MB). 102 tests. Notes: the minimum order applies to the items (subtotal), not to the delivery
  fee; logistics endpoints are for the `logistics` role only (admins use their own screens); cancelling a paid order lowers the "most bought" counter
  but does not refund (no refund automation).
- 2026-11-05 — Phase 5 done: React 19 + Vite 8 + React Router 8 + TanStack Query + Tailwind v4 storefront. Home (hero, most bought, category chips, sort,
  pagination – all in the URL), product page (refresh-safe), instant search dropdown (debounced, arrow keys, Enter, Esc) + results page, one cart hook
  for guests (localStorage) and users (server) with merge on login, checkout (address prefilled from the last order), mock payment + result pages,
  orders list + detail with timeline, account (name, photo, password), login/register, dark mode, mobile. Checked in a real browser (Playwright).
  Deviations: `GET /api/auth/me` answers `{ user: null }` (200) for visitors instead of 401, so a normal page load logs no console errors; the
  same-origin check also accepts the `APP_URL` origin (reverse proxies that rewrite `Host`); Vite's proxy keeps the browser `Host`.
- 2026-11-05 — Phase 6 done: lazy-loaded admin (dashboard with an "awaiting confirmation" count, products table with create / edit / delete + photo
  upload and preview, categories manager with package size, orders table with filters, detail dialog, confirm / cancel) and logistics (queue, package
  size, address, one-click next step with toast, auto-refresh every 30 s). Verified in a browser as admin, logistics and customer (a customer on
  `/admin` sees "no access"). `AdminStatsDTO.awaitingConfirmation` added.
- 2026-11-05 — Phase 7 done: multi-stage `Dockerfile` (build / production dependencies via `pnpm deploy --prod` / empty uploads dir / runtime), final
  stage has no `RUN`, runs as `node`, healthcheck on `/api/health`, no secrets in the image. `docker-compose.yml`: app + mongo (healthcheck, not
  published) + mailpit; the app and Mailpit listen on 127.0.0.1 by default (`APP_BIND=0.0.0.0` opens them). Verified: seeded on first start only, SPA
  routes, uploads on the volume as the unprivileged user, data and sessions survive a restart. Extra hardening over the plan: with no `JWT_SECRET`
  the server creates a random secret once and keeps it in MongoDB (no well-known default secret in compose). Image size: the Node 24 Alpine base
  alone is ~255 MB unpacked, so the 250 MB target is missed by ~60 MB (production dependencies are 58 MB, `stripe` alone 22 MB); accepted.
- 2026-11-05 — Phase 8 done: `pnpm e2e` builds and starts its own compose stack (project `c2h-e2e`, port 8081, Mailpit 8026), runs 19 Playwright
  tests in Chromium (storefront, search/keyboard, guest cart, customer sign-up → cancel → retry → pay → track, account, permissions in UI and API,
  admin catalog with photo upload, the full processing → delivered lifecycle across customer/admin/logistics with the emails checked in Mailpit,
  cancellation) and removes the stack; any uncaught error or `console.error` fails a test. `pnpm screenshots` writes 14 images to
  `docs/screenshots/`. The e2e run found and fixed two real bugs: the CSP blocked `blob:` images (admin photo preview) and URL filter updates could
  use a stale copy of the query string (now `useQueryParams`, built on the current address).
- 2026-11-05 — Phase 9 done: the old `Backend/`, `frontend/`, `admin/`, `logistics/` and `todo.txt` are deleted (history keeps them); new `README.md` with
  screenshots, quick start, demo accounts, configuration, Stripe, development, structure and architecture. Extras found while documenting: a
  `pnpm create-user` command (also `docker compose exec app node dist/create-user.js …`) so a real deployment can make its own admin without demo
  data, and `docker-compose.dev.yml` (publishes MongoDB / SMTP for `pnpm dev`).

---

## 11. What changed (summary)

**Rewritten in TypeScript (strict)** as a pnpm monorepo: `packages/shared` (Zod schemas, DTO types, pricing, order-status rules),
`apps/api` (Express 5, Mongoose 9, Zod, 109 tests), `apps/web` (React 19, Vite 8, React Router 8, TanStack Query, Tailwind 4), `e2e` (19
Playwright tests + screenshots). One Docker image (`matthew552/cart2heavy`) that serves API and web app; `docker compose up` gives a seeded shop.

**Bugs from §1.2**

| # | Result |
|---|---|
| B1 | The product grid and the cart use the right endpoints and are covered by e2e. |
| B2 | Prices are integer cents everywhere; a test checks the exact `unit_amount` sent to Stripe. |
| B3 | Prices, delivery, totals and the $25 minimum are computed on the server from the database; tests send forged prices. |
| B4 | The order is created before payment, the cart is only emptied after the provider confirms; cancel and retry keep it. |
| B5 | "Most bought" grows by quantity, once, after payment (idempotent mark-paid); no separate unauthenticated call. |
| B6 | Payment is verified by asking the provider (or its webhook); `?success=true` is ignored; only the owner can verify. |
| B7 | `createdAt` comes from Mongoose timestamps (per document). |
| B8 | `totalPages` counts the filtered products. |
| B9 | Status changes are awaited, atomic and recorded in `statusHistory`. |
| B10 | The cart is a normal page for guests too. |
| B11 | Every page has a real URL and loads its own data; reload is covered by e2e. |
| B12/B13 | One origin, relative URLs, nothing hard-coded. |

**Security from §1.3**

| # | Result |
|---|---|
| S1/S2 | Configuration only through environment variables (validated at start-up); `.env` is git-ignored, `.env.example` is committed. **Still your to-do:** change the MongoDB Atlas password and roll the Stripe test key, they remain in the git history. |
| S3 | Role-based auth (`customer` / `admin` / `logistics`) on the server; tests cover every admin and logistics route for each role. |
| S4 | Account endpoints only ever act on the logged-in user. |
| S5 | `httpOnly`, `SameSite=Lax` cookie plus a same-origin check. |
| S6 | Uploads: MIME + extension + file signature, 5 MB, random names. |
| S7 | `node_modules` and `.env` are no longer tracked. |

**Deviations from the plan** (all small): `GET /auth/me` answers `{ user: null }` for visitors; `GET /api/config` and `GET /products?ids=`
were added for the guest cart; product search is a regex, not a text index; logistics endpoints are for the `logistics` role only; the Docker
image is ~312 MB unpacked (target was 250); the compose ports listen on 127.0.0.1 by default and the session secret is generated when unset;
`create-user` and `docker-compose.dev.yml` were added.
- 2026-11-05 — Phase 10 prepared, not finished: multi-arch build verified locally, fresh-clone `docker compose up` verified (builds locally), final
  `pnpm e2e` 19/19 green. Waiting for the Docker Hub push (see Phase 10 above).
- 2026-11-05 — Follow-up: seed catalog now uses real product names/prices (MSI boards, Apple devices; photos are still the old placeholders), UI polish
  (soft page background, rounder cards/controls, pill sort select, bigger logo shifted right, mobile chip/scroll fixes), Instagram link removed.
- 2026-11-05 — Follow-up 2: whole site on one warm dark theme (#69281D), peach accent, page/menu/dialog/card animations, header full width with the logo
  left-aligned; seed photos replaced with CC-licensed Wikimedia Commons photos (credits in README); motherboards are ASUS ROG Strix boards because
  MSI blocks downloads and has no free photos.
- 2026-11-05 — Follow-up 3: theme changed to the slate/lavender palette (#494D5F page, lighter slate cards, #D0BDF4 accent), Inter + Plus Jakarta Sans fonts
  (logo keeps its look), product page now has about / details / delivery / related products.
- 2026-11-05 — Follow-up 4: mobile pass over all three areas (no side scroll, 16px inputs, 44px targets, sticky bottom actions, admin lists as cards, bottom
  sheets, 2x2 dashboard stats), `e2e/tests/mobile.spec.ts` guards it (24 e2e tests), darker background (#1C1E27), README phone section, `APP_URL`
  overridable in compose.
- 2026-11-05 — Phase 10 done: image pushed (1.0.0 + latest, amd64 + arm64) and verified from a fresh clone.
