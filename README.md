# cart2heavy

A small full-stack shop with **three roles on one order pipeline**: customers buy, the admin confirms,
logistics delivers. Written in TypeScript end to end (Express, MongoDB, React), and it runs with a
single command.

![The cart2heavy storefront](docs/screenshots/home.png)

```bash
git clone https://github.com/shtmthw/cart2heavy.git
cd cart2heavy
docker compose up
```

Open **<http://localhost:8080>**. That is all: the shop comes with demo products, demo accounts and
simulated payments, so nothing needs to be configured. (Needs [Docker](https://docs.docker.com/get-docker/).)

| What                  | Where                                   |
| --------------------- | --------------------------------------- |
| Store                 | <http://localhost:8080>                 |
| Admin panel           | <http://localhost:8080/admin>           |
| Logistics panel       | <http://localhost:8080/logistics>       |
| Emails the shop sends | <http://localhost:8025> (Mailpit inbox) |

**Demo accounts** (created on the first start, local use only):

| Role      | Email                        | Password        |
| --------- | ---------------------------- | --------------- |
| Customer  | `demo@cart2heavy.local`      | `demo1234`      |
| Admin     | `admin@cart2heavy.local`     | `admin1234`     |
| Logistics | `logistics@cart2heavy.local` | `logistics1234` |

Stop with `Ctrl+C` (or `docker compose down`). Your data stays in Docker volumes; `docker compose down -v`
deletes it and the next start begins with fresh demo data.

---

## What it does

**Customers**

- Browse, filter by category, sort (newest, most popular, price) and page through the products. The
  three **most bought** products are shown on the home page.
- **Instant search**: suggestions while typing, arrow keys and Enter, plus a results page.
- A **cart** that works before logging in (it lives in the browser) and is merged into the account on
  login. Totals, delivery fee and the **$25 minimum order** are calculated on the server.
- **Checkout** with the address of the last order pre-filled, then pay. Orders get a **status
  timeline** (processing → confirmed → received → shipping → shipped → out for delivery → delivered)
  and emails for the important steps.
- Account page: name, profile photo, password.

![Product page](docs/screenshots/product.png)

|                                                |                                                        |
| ---------------------------------------------- | ------------------------------------------------------ |
| ![Instant search](docs/screenshots/search.png) | ![Order timeline](docs/screenshots/order-timeline.png) |
| ![Cart](docs/screenshots/cart.png)             | ![Checkout](docs/screenshots/checkout.png)             |

**Admin** (`/admin`)

- Dashboard: revenue, orders per status, orders waiting for confirmation, most bought products.
- Products: create, **edit** and delete with photo upload. A product that was ordered before is hidden
  instead of deleted, so old orders keep their history.
- Categories with a **package size** (S / M / B / L). A category that still has products cannot be deleted.
- Orders: filter by status and payment, **confirm** paid orders, cancel.

|                                                          |                                                        |
| -------------------------------------------------------- | ------------------------------------------------------ |
| ![Admin dashboard](docs/screenshots/admin-dashboard.png) | ![Admin products](docs/screenshots/admin-products.png) |

**Logistics** (`/logistics`)

- The queue of paid, confirmed orders with items, address and the **package size**, oldest first.
- One click moves an order to its next step (only forward, every change is recorded with who did it).

![Logistics queue](docs/screenshots/logistics.png)

It is responsive and follows the operating system's light/dark setting.

|                                             |                                                  |                                              |
| ------------------------------------------- | ------------------------------------------------ | -------------------------------------------- |
| ![Mobile](docs/screenshots/mobile-home.png) | ![Mobile cart](docs/screenshots/mobile-cart.png) | ![Dark mode](docs/screenshots/home-dark.png) |

---

## Configuration

`docker compose up` works without any setup. To change something, copy `.env.example` to `.env` next to
`docker-compose.yml`; Compose reads it automatically.

| Variable                | Default                           | What it does                                                                                                |
| ----------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `APP_PORT`              | `8080`                            | Port of the shop on your computer.                                                                          |
| `APP_BIND`              | `127.0.0.1`                       | Which address the shop and the Mailpit inbox listen on. `0.0.0.0` opens them to your network.               |
| `PAYMENT_PROVIDER`      | `mock` (`stripe` if a key is set) | `mock` = simulated payments, `stripe` = real Stripe Checkout.                                               |
| `STRIPE_SECRET_KEY`     | –                                 | Your Stripe key (`sk_test_…`). Setting it switches the shop to Stripe.                                      |
| `STRIPE_WEBHOOK_SECRET` | –                                 | Signing secret of the Stripe webhook (`whsec_…`), see below.                                                |
| `JWT_SECRET`            | generated                         | Secret that signs login sessions. Left empty, the server creates a random one and keeps it in the database. |
| `DELIVERY_FEE_CENTS`    | `180`                             | Delivery fee ($1.80), added once per order.                                                                 |
| `MIN_ORDER_CENTS`       | `2500`                            | Minimum value of the items in an order ($25.00).                                                            |
| `SEED_ON_START`         | `true` in Compose                 | Fill an **empty** database with demo data and the demo accounts.                                            |
| `MAILPIT_PORT`          | `8025`                            | Port of the email inbox.                                                                                    |

The server itself (running without Docker) understands a few more, all listed with comments in
[`.env.example`](.env.example): `MONGODB_URI`, `APP_URL`, `UPLOAD_DIR`, `SMTP_HOST` / `SMTP_PORT` /
`MAIL_FROM`, `TRUST_PROXY`, `LOG_LEVEL`. Invalid values stop the server at start-up with a message that
names every problem.

### Real payments with Stripe

1. Put your **test** key in `.env`: `STRIPE_SECRET_KEY=sk_test_...`
2. `docker compose up -d`. Checkout now sends customers to Stripe's payment page.
3. _(Recommended)_ Let Stripe tell the shop about payments even when the customer closes the tab:
   ```bash
   stripe listen --forward-to localhost:8080/api/payments/stripe/webhook
   ```
   Put the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET` and restart. For a live site, add
   `https://your-domain/api/payments/stripe/webhook` as an endpoint in the Stripe dashboard
   (event `checkout.session.completed`).

Prices always go to Stripe in cents and are read from the database – never from the browser.

### Using it for real

The demo setup is meant for your own computer. Before putting it on a server:

- Put it behind HTTPS (for example a reverse proxy), set `APP_URL=https://your-domain` and `TRUST_PROXY=true`.
- Start with **`SEED_ON_START=false`**, so no demo accounts exist, and create your own staff accounts:
  ```bash
  docker compose exec app node dist/create-user.js --role admin --email you@example.com --name "Your Name"
  # roles: admin, logistics, customer. Without --password a random one is printed once.
  ```
- Point `SMTP_HOST` at a real mail server instead of Mailpit and set `STRIPE_SECRET_KEY` to take real payments.
- Back up the `mongo-data` and `uploads` volumes.

---

## Development

Needs Node.js 24+, [pnpm](https://pnpm.io/installation) and Docker (for MongoDB).

```bash
pnpm install
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d mongo mailpit   # MongoDB + email inbox
cp .env.example .env
pnpm seed        # demo data (use `pnpm seed --reset` to wipe and start over)
pnpm dev         # API on :8080, web app with hot reload on http://localhost:5173
```

| Command                                            | What it does                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm dev`                                         | API (`tsx watch`) and web app (Vite) together; Vite proxies `/api` and `/uploads`. |
| `pnpm build`                                       | Type-checks and builds the web app, then bundles the API into `apps/api/dist`.     |
| `pnpm typecheck`                                   | Strict TypeScript across all packages and the e2e tests.                           |
| `pnpm lint` / `pnpm format`                        | ESLint (typescript-eslint, React hooks) / Prettier.                                |
| `pnpm test`                                        | Unit and API tests (Vitest + Supertest on an in-memory MongoDB).                   |
| `pnpm e2e`                                         | End-to-end tests in a real browser against the Docker stack, see below.            |
| `pnpm screenshots`                                 | Regenerates the pictures in `docs/screenshots/`.                                   |
| `pnpm seed`                                        | Fills an empty database with demo data.                                            |
| `pnpm create-user --role admin --email … --name …` | Creates an account of any role.                                                    |

**Tests.** `pnpm test` covers the pricing rules, the cart, checkout and payment verification (mock
and Stripe, including the webhook), the order status rules, uploads and role permissions.
`pnpm e2e` builds the Docker image, starts a private copy of the shop (port 8081) with `docker compose`,
runs the Playwright tests (sign-up → pay → admin confirm → logistics delivers → customer sees
"Delivered", plus the emails in Mailpit) and removes it again. Install the browser once with
`pnpm exec playwright install chromium`. To test a stack that is already running:
`E2E_BASE_URL=http://localhost:8080 pnpm e2e`.

### Project structure

```
apps/
  api/            Express 5 + Mongoose + Zod
    src/config      environment validation, dotenv, session secret
    src/models      User, Category, Product, Order (money is stored as integer cents)
    src/modules     auth, users, products, categories, cart, orders, payments, admin, logistics
    src/middleware  auth + roles, same-origin check, uploads, error handler
    src/payments    PaymentGateway interface: mock.ts and stripe.ts
    src/mail        nodemailer + email templates
    src/seed        demo data (+ compressed product photos), create-user
    test/           Vitest + Supertest
  web/            React 19 + Vite + React Router + TanStack Query + Tailwind CSS 4
    src/app         router, layouts, route guards
    src/features    catalog, product, search, cart, checkout, orders, account, auth, admin, logistics
    src/components  small UI primitives (button, field, dialog, table, …)
    src/lib         API client, auth and cart hooks
packages/
  shared/         Zod schemas, DTO types, order-status rules, money helpers, cart pricing
e2e/              Playwright tests and the screenshot script
Dockerfile        one image: the API that also serves the built web app
docker-compose.yml  app + MongoDB + Mailpit
```

### How it fits together

- **One image, one port.** The API serves the built React app, so there is no CORS and no hard-coded
  URL. The login lives in an `httpOnly`, `SameSite=Lax` cookie; state-changing requests must also come
  from the same origin.
- **The server decides about money.** The browser only says _which_ products and _how many_. Prices,
  delivery, the minimum order and totals are computed from the database (`packages/shared/src/pricing.ts`),
  in integer cents.
- **Checkout is safe to repeat.** An order is created _before_ payment, the cart is kept, and the
  order is marked paid only after the payment provider confirms it (when the customer returns, or via
  the Stripe webhook). Marking paid happens exactly once, so refreshes and webhook retries cannot
  double-count the "most bought" numbers or send two emails.

  ```
  cart ─► POST /api/orders/checkout ─► payment page (Stripe, or the built-in test page)
                                         │
          POST /api/orders/:id/verify ◄──┘  asks the provider "was it paid?"
             paid   → order paid · cart emptied · sales counted · "order received" email
             unpaid → order stays unpaid · cart kept · "try again" button
  ```

- **Roles are enforced on the server.** `customer`, `admin` and `logistics` accounts; the admin and
  logistics endpoints return 403 to everyone else (the UI hiding things is only a convenience).
  Public sign-up can only create customers.
- **Uploads** are checked by MIME type, extension _and_ file signature, limited to 5 MB and stored under
  random names.

---

## Publishing the image

Maintainers publish a multi-architecture image (Intel/AMD and Apple Silicon) to Docker Hub. No CPU
emulation is needed because only the build stages run, on the build machine's own architecture:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t matthew552/cart2heavy:1.0.0 -t matthew552/cart2heavy:latest --push .
```

`docker compose up` pulls `matthew552/cart2heavy:latest`; `docker compose up --build` builds the image
from the checkout instead.

---

Made and founded by [Matthew Baroi](https://github.com/shtmthw) · [Instagram](https://www.instagram.com/sht_matthew/)
