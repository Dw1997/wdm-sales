# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## Project Overview

`wdm-sales` is the sales-end (销售端) of a grocery wholesale platform: a uni-app + Vue 3 app that builds to H5, WeChat Mini Program (`mp-weixin`), and native app. Core features: customer acquisition (拓客推广), mobile CRM, and order-on-behalf-of-customer (代客下单). Business context lives in `角色功能.md` and `提示词.md`.

## Build, Test, and Development Commands

```bash
npm run dev:h5           # H5 dev server (port 9022, history mode)
npm run dev:mp-weixin    # dev, WeChat Mini Program
npm run dev:app          # dev, native app
npm run build:h5         # production build, H5
npm run build:mp-weixin  # production build, WeChat Mini Program
npm run build:app        # production build, app
npm run type-check       # vue-tsc --noEmit (only static verification)
```

No test runner or linter is configured; `type-check` is the only static verification. After changes, run `npm run type-check` and manually verify affected pages in H5 and WeChat devtools.

## Architecture

### API Layer

Two files, both pointing at the real backend (`http://localhost:9000/api/v1` by default, override with `VITE_API_BASE_URL`):

1. **`src/api/index.ts`** — typed public facade grouped by domain (`authApi`, `spuApi`, `skuApi`, `priceApi`, `customerApi`, `customerLevelApi`, `creditApi`, `orderApi`, `financeApi`, `dashboardApi`, `messageApi`, plus legacy `promotionApi` / `salesApi`). Pages and stores only import from here.
2. **`src/api/request.ts`** — `uni.request` wrapper: unwraps the `{code, message, data}` envelope, adds `Authorization: Bearer <token>`, adds `Idempotency-Key` to write requests, shows loading/toast, and on 401 clears tokens and `reLaunch`es to the login page.

Contract source of truth is `docs/00-core/api/*.md` (repo root), not this file. Response shapes live in `src/types/index.ts`; amounts are two-decimal strings from the backend and are formatted with `utils/format.ts`.

Some backend endpoints are still stubs (`/sales/me*`, `/finance/credit`, `/promotion/*`, customer follow-ups); pages that use them are marked in `02-移动端设计.md` §6.1 and must degrade gracefully rather than invent data.

### Price Isolation Rule

Prices are resolved **only** by the backend quote API (`POST /prices/quote`) and snapshotted onto orders. The cart store and order pages call `priceApi.quote()` and never compute, cache, or scale prices. When the cart's customer changes, `cart.refreshPrices()` re-quotes every line.

### Auth Flow

`src/stores/auth.ts` backs tokens to `uni.storage` (`wdm_sales_access` / `wdm_sales_refresh`). On app launch, `App.vue` → `onLaunch` calls `auth.restore()`, which injects the token getter into `request.ts` and refreshes `user`. Login uses `platform=app` with phone + password. `GET /auth/me` returns `role`, `role_name` and the `permissions` list; gate UI with `auth.can('order.price_override')` etc.

### State (Pinia)

Two stores, both Composition-API style:
- **`auth`** — tokens, current user, role/permissions; `restore()` on launch.
- **`cart`** — 代客下单 cart scoped to a customer, holding SKUs and backend-quoted prices. `setCustomer()` re-quotes; `addFromQuote()` requires a quote. In-memory only, cleared after order submit.

### Page Structure & Navigation

- Main-package pages: `src/pages/{home,customers,promotion,performance,me,auth,messages,order}/*.vue`
- Sub-package pages: `src/pages-sub/product/{search,detail}.vue` (lazy-loaded, keeps main package small)
- 5-tab bar: 工作台 / 客户 / 推广 / 业绩 / 我的 (registered in `pages.json` → `tabBar`)
- Pages with `"navigationStyle": "custom"` use `<CustomNavBar>` and must manually add `paddingTop` equal to `statusBarHeight + 44px` (see home/index.vue pattern).
- New pages require a `src/pages.json` entry in the `pages` or `subPackages` array.

### Theme System

`src/uni.scss` defines SCSS theme variables (`$uni-color-primary` = `#2563eb`, etc.) that the uni-app compiler **auto-injects** into every `<style lang="scss">` block — no import needed. `src/styles/global.scss` (imported once in `App.vue`) provides utility classes (`.card`, `.btn-primary`, `.tag-*`, flex/spacing helpers) used across pages. Sizes use `rpx` units throughout.

## Coding Style & Naming Conventions

- Vue 3 Composition API with `<script setup lang="ts">`; 2-space indentation
- TypeScript everywhere; Sass (`lang="scss"`), Pinia for state, dayjs for dates
- Path alias `@/` → `src/`
- PascalCase for components/types, camelCase for functions/variables, kebab-case for page files; API payload fields use snake_case (e.g. `period_start`)
- UI copy is Chinese; sizes use `rpx` units
- Enum-to-label mapping lives in `src/utils/dict.ts` (e.g. `ORDER_STATUS`, `PAYMENT_METHOD`); formatters in `src/utils/format.ts` (uni-app-compatible, avoid dayjs in format.ts — uses native `Date`)

## Project Structure & Module Organization

All source code lives under `src/`:

- `src/pages/` — main-package pages; `src/pages-sub/` — sub-package (product search/detail)
- `src/components/` — reusable UI (`CustomNavBar`, `StatCard`, `OrderCard`, `CustomerCard`, `EmptyState`, `ProductCard`)
- `src/stores/` — Pinia stores (`auth`, `cart`)
- `src/api/` — public API facade (`index.ts`), `request()` wrapper (`request.ts`), in-memory mock backend (`mock/db.ts`, `mock/services.ts`)
- `src/types/`, `src/utils/`, `src/styles/` — domain types, helpers, theme/global styles
- `src/pages.json` — page registry and tab bar; every new page must be registered here
- `src/static/` — images and assets; `dist/` — build output (gitignored)

## Commit & Pull Request Guidelines

Git history uses short prefixed subjects (e.g. `init: wdm-sales (uni-app Vue 3)`). Prefer Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`. PRs should describe what and why, link related issues, and include screenshots for UI changes.
