# CLAUDE.md

Guidance for working in this repo: the **Salla Embedded SDK Playground**, a React + Vite app that runs inside the Salla Merchant Dashboard iframe to test `@salla.sa/embedded-sdk` (currently `0.2.6`).

Source docs: https://docs.salla.dev/embedded-sdk/overview.md (index of all pages: https://docs.salla.dev/llms.txt, "Embedded SDK" section). The type declarations in [public/types/salla-embedded-sdk.d.ts](public/types/salla-embedded-sdk.d.ts) (synced by `scripts/sync-types.js`) are the source of truth when docs and code disagree.

## Project

| Command                     | What it does                                                 |
| --------------------------- | ------------------------------------------------------------ |
| `pnpm dev`                  | Sync SDK types, start Vite dev server                        |
| `pnpm dev:vercel`           | Run app + `api/` functions locally (needs global Vercel CLI) |
| `pnpm build`                | Sync types + `vite build` → `dist/`                          |
| `pnpm test`                 | Vitest (jsdom) with coverage                                 |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                                            |

- **Hosting: Vercel.** Config in [vercel.json](vercel.json). Serverless functions live in [api/](api/) (Node, ESM). `verify-token.js` uses `export default function handler(req, res)`; newer ones use Web-style `export async function POST(request)`. Shared code goes in [api/\_lib/](api/_lib/), whose files are not deployed as functions. There is no Netlify anymore; don't reintroduce `/.netlify/functions/*` paths.
- **Products tab (Merchant API access):**
  - [api/products.js](api/products.js) introspects the embedded token (to confirm the caller is a real merchant session), then calls `GET /admin/v2/products` with the access token from the `SALLA_ACCESS_TOKEN` env var.
  - There is **no Salla token storage**: the Merchant API token is one env var, so the Salla side works for one store, and the token must be replaced by hand when it expires after 14 days. (Upstash Redis is used only for per-merchant WhatsApp settings; see Cart Recovery.) Moving to per-store Salla tokens (Easy Mode + `app.store.authorize`) is the planned next step.
  - UI: [src/components/Products/ProductsTab.jsx](src/components/Products/ProductsTab.jsx) and [src/utils/productsApi.js](src/utils/productsApi.js).
  - **Bulk actions** (Products page selection bar): one `POST /products/actions` per submit (scope `products.read_write`), action `bulk_actions` in [api/products.js](api/products.js). [src/utils/bulkActions/bulkActionSpec.js](src/utils/bulkActions/bulkActionSpec.js) is the single source for the documented actions (`duplicate`, `sale-channels`, `features`, `notify-quantity`, `pricing`; `restore` has no UI), the pricing formulas (verbatim from the docs' table) and the `filters` shape; the server re-validates against it. "Select all matching" sends `select_all` + the list's status/category filters + `unselected_ids`, never a list of every id; it's unavailable with a text search (Salla's bulk filters have no keyword). Several products are queued by Salla, and there is no status endpoint, so operations are logged in localStorage with the status Salla returned and never shown as completed by us.
  - **Product media** (Product Editor → Appearance → "إدارة الوسائط"): image files go one per request through [api/product-media.js](api/product-media.js) (multipart) to `POST /products/{id}/images`. Salla allows 10 images per product and documents no formats or size limit; the 4.4 MB cap is Vercel's 4.5 MB request limit. Salla has **no video file upload**, only YouTube links (`POST /products/{id}/video`, action `video_attach`). Delete is `DELETE /products/images/{image}`. Images are listed from Product Details (there is no list-images endpoint). The upload queue (2 at a time, cancel, retry) is local state in `useMediaUploadQueue`; after uploads only the images query is refetched, never the product, so unsaved form edits stay.
- **Coupons tab (storewide coupons):** [api/coupons.js](api/coupons.js) does list/get/create/update/delete on `/admin/v2/coupons` with the same introspect + `SALLA_ACCESS_TOKEN` pattern. The token needs scopes `marketing.read` and `marketing.read_write`. The payload is built from an allow-list and never sends include/exclude lists, so coupons created here always apply to the entire store. Coupons that have rules the form doesn't manage (products, customer groups, payment methods, groups, marketers) are view/delete only, because Salla's update is a `PUT`. Salla dates have no offset; they are read as store time (+03:00). UI: [src/components/Coupons/](src/components/Coupons/), hooks in `src/hooks/coupons/`, pure helpers in `src/utils/coupons/`.
- **Cart Recovery tab (stage 1, read-only):** [api/carts.js](api/carts.js) lists `GET /admin/v2/carts/abandoned` (cursor pagination: follow `pagination.next`, 60 per page, capped at 20 pages) and reads `GET /carts/abandoned/{id}` plus product names from `GET /products/{id}`. Needs scope `carts.read`. Salla has no API for an app to message customers, so reminders are manual: the WhatsApp button opens a `wa.me` link with Salla's `checkout_url` and the merchant sends it. The threshold, message templates, chosen coupon and "WhatsApp opened" log live in this browser's localStorage. Recovered carts / recovery rate need the `abandoned.cart.purchased` webhook and storage (stage 2), so they aren't shown. UI: [src/components/CartRecovery/](src/components/CartRecovery/), hooks in `src/hooks/cartRecovery/`, helpers in `src/utils/cartRecovery/`.
  - **WhatsApp Cloud API:** [api/whatsapp.js](api/whatsapp.js) sends an approved template via `POST https://graph.facebook.com/{version}/{phone-number-id}/messages`, one cart per request, only when the merchant presses Send (or "Send to N shown carts", which goes one at a time and skips carts messaged in the last 24 h). It reads the cart from Salla itself and refuses purchased carts. "Sent" = Meta accepted it; delivery/read need Meta's webhook (stage 2). The sent log is per browser.
  - **Per-merchant WhatsApp settings:** each merchant enters their own Phone Number ID, access token, template name/language and variable order in the app (WhatsApp settings dialog). Stored in Upstash Redis under `wa:settings:{merchant_id}` (merchant id from the verified session); the token is AES-256-GCM encrypted with `WA_SETTINGS_KEY` ([api/_lib/secretBox.js](api/_lib/secretBox.js)) and never returned to the browser (only its last 4 characters). Saving first checks the id + token with Meta (`GET /{phone-number-id}?fields=display_phone_number,verified_name,quality_rating`). Merchant settings win; the `META_WA_*` env vars are only a server default for testing. Libs: [api/_lib/kv.js](api/_lib/kv.js) (Upstash REST, no dependency), [api/_lib/whatsappGraph.js](api/_lib/whatsappGraph.js), [api/_lib/whatsappSettings.js](api/_lib/whatsappSettings.js).
- **Vercel env vars:**

  | Variable             | Required? | Purpose                                                             |
  | -------------------- | --------- | ------------------------------------------------------------------- |
  | `SALLA_ACCESS_TOKEN` | Yes       | The store's Merchant API access token, needed for the Products tab. |
  | `SALLA_APP_ID`       | Yes       | Used for introspect. Falls back to the `app_id` the page sends.     |
  | `ENV`                | No        | Selects the verify-token upstream.                                  |
  | `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) | For WhatsApp settings | Upstash Redis. Set automatically when you add Upstash Redis to the Vercel project. |
  | `WA_SETTINGS_KEY` | For WhatsApp settings | 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts merchants' WhatsApp tokens. Changing it means merchants re-enter their token. |
  | `META_WA_TOKEN` / `META_WA_PHONE_NUMBER_ID` | No | Server-default WhatsApp account (testing), used when a merchant hasn't connected their own. |
  | `META_WA_TEMPLATE_NAME` / `META_WA_TEMPLATE_LANG` / `META_WA_TEMPLATE_PARAMS` | No | Template for the server default (defaults `hello_world` / `en_US` / none). Params come from `customer_name,cart_total,cart_items,checkout_url,coupon_code`. |
  | `META_GRAPH_VERSION` | No | Graph API version (default `v23.0`). |

- **Token verification:** frontend [src/utils/tokenVerification.js](src/utils/tokenVerification.js) → `POST /api/verify-token` → [api/verify-token.js](api/verify-token.js) → Salla exchange-authority. `ENV` env var picks the upstream (`prod` default = `api.salla.dev`; `dev` = Salla's internal dev worker, not reachable for partners).
- **App ID** is read from the `app_id` URL query param ([src/utils/constants.js](src/utils/constants.js)).
- **Bootstrap flow** lives in [src/hooks/useAppBootstrap.js](src/hooks/useAppBootstrap.js): `init()` → `getToken()` → verify → `ready()` (or `destroy()` on failure).
- The SDK is exposed globally as `window.salla.embedded` for the in-app code playground ([src/hooks/useExposeEmbeddedGlobally.js](src/hooks/useExposeEmbeddedGlobally.js)).
- Tests sit next to code in `__tests__/` folders; `src/test/setup.js` is the Vitest setup.

### Code structure (logic vs. UI)

- **`src/components/ui/`**: shared presentational kit (`Button`, `IconButton`, `Modal`, `ConfirmDialog`, `Card`, `Field`/`TextInput`/`Select`/`Textarea`/`FormRow`, `Badge`, `Alert`, `EmptyState`, `Skeleton`, `Spinner`, `SegmentedTabs`, `Switch`, `KeyValueList`, `CodeBlock`, `StatCard`, `ToastViewport`). Import from `src/components/ui/index.js`. It makes no SDK or API calls. `Modal` renders through a portal into `document.body`, so tests should query it with `screen`, not `container`.
- **`src/hooks/ui/`**: generic UI hooks (`useDisclosure`, `useAsyncAction`, `useClipboard`).
- **`src/hooks/app/usePlaygroundApp.js`**: app-level orchestration (bootstrap, theme sync, iframe detection, nav sync, message log). `App.jsx` only renders.
- **Feature pattern**: `*Tab.jsx` is a thin container that calls the feature hooks in `src/hooks/<feature>/` and passes data and callbacks to presentational components in the same component folder. Pure helpers go in `src/utils/`.
- **Tabs** are defined once in [src/config/tabs.js](src/config/tabs.js), which is used by both the tab strip and `useNavSync`.
- **Styles**: [src/styles/index.css](src/styles/index.css) imports everything in cascade order: `tokens.css` (Salla palette, PingARLT, light/dark), `base.css`, `layout.css` (shell), `features/*.css`, and `ui/*.css` (`kit.css` last). Use tokens instead of hardcoded colors, and logical properties (`margin-inline-start`, `inset-inline-end`) for RTL.

---

## Salla Embedded SDK reference

The SDK is a postMessage bridge between your iframe app and the Salla Merchant Dashboard (host). Always call the SDK's methods; never send raw `postMessage` events yourself. The message format is internal and may change.

### Install

```js
// npm (recommended)
import { embedded } from "@salla.sa/embedded-sdk";
```

```html
<!-- CDN -->
<script src="https://unpkg.com/@salla.sa/embedded-sdk/dist/umd/index.js"></script>
<script>
  const embedded = Salla.embedded; /* or SallaEmbeddedSDK.embedded */
</script>
```

### How Salla loads the app

1. The partner registers an **Embedded Page** in the Partners Portal (My Apps → app → Embedded Pages): a **Route Slug** (becomes `https://s.salla.sa/embedded/app/{appId}/{slug}`), the **Iframe URL**, and optionally **Default Page**.
2. The merchant opens the app and clicks "Use App" / "Run App", and the dashboard loads the Iframe URL.
3. Salla appends query params: `token` (short-lived session token), `theme` (`light`|`dark`), `lang` (`ar`|`en`). This project also expects `app_id`.
4. Publishing requires an **Embedded App Banner** at 1420×520 px (App Details → publish → App Features).

### Lifecycle (core methods on `embedded`)

| Method                                                  | Returns                           | Notes                                                                                             |
| ------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `init(options?: { debug?: boolean })`                   | `Promise<{ layout: LayoutInfo }>` | Opens the bridge. Must be awaited first.                                                          |
| `ready()`                                               | `void`                            | Removes the host loading overlay. Call **only after** backend verification and initial data load. |
| `destroy()`                                             | `void`                            | Exit the embedded view. Use on auth failure instead of leaving the merchant on a hung loader.     |
| `onInit(cb: (state: EmbeddedState) => void)`            | unsubscribe                       | Fires once the SDK is initialised.                                                                |
| `onThemeChange(cb: (theme: "light" \| "dark") => void)` | unsubscribe                       | Theme sync is **required**.                                                                       |
| `getState()`                                            | `Readonly<EmbeddedState>`         | `{ ready, initializing, layout }`                                                                 |
| `isReady()`                                             | `boolean`                         |                                                                                                   |

`LayoutInfo = { theme: "light" | "dark", dir: "ltr" | "rtl", width: number, locale: string, currency: string }`

```js
const { layout } = await embedded.init({ debug: true });
document.documentElement.classList.toggle("dark", layout.theme === "dark");
document.documentElement.lang = layout.locale;
document.documentElement.dir = layout.dir;
```

### Authentication ("Trust-but-Verify")

Flow: `init()` → `auth.getToken()` → send the token to **your backend** → backend calls Salla introspect → backend issues its own session (JWT/cookie) → load data → `ready()`. Never run business logic on an unverified frontend token.

**`embedded.auth`**

| Method                 | Returns                                                                                 | Notes                                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `getToken()`           | `string \| null`                                                                        | Token from URL; `null` means the page was opened outside Salla.                                                                                 |
| `getAppId()`           | `string \| null`                                                                        |                                                                                                                                                 |
| `refresh()`            | `void`                                                                                  | Host reloads the iframe with a fresh token. Use on backend 401. Guard against refresh loops.                                                    |
| `introspect(options?)` | `Promise<{ isVerified, isError, error?, data: { merchant_id, user_id, exp } \| null }>` | **Dev/debug only.** Not a production auth check. Options: `appId?`, `token?` (both auto-read from the URL), `refreshOnError?` (default `true`). |

**Backend introspect endpoint**

```
POST https://api.salla.dev/exchange-authority/v1/introspect
S-Source: <YOUR_APP_ID>          # required
Content-Type: application/json

{ "token": "<token from URL>" }
```

- Success: `{ "status": 200, "success": true, "data": { "merchant_id": 123456, "user_id": 987654, "exp": "2026-01-19T12:00:00Z" } }`
- Failure: `{ "status": 401, "success": false, "error": { "message": "Decryption failed", "code": 0 } }` (`code` is 0–4)
- Always send `S-Source`; it binds verification to your app.
- Note: this repo's function currently calls `/exchange-authority/v1/verify` with `{ token, iss, subject, env }`. The documented endpoint is `/introspect` with `{ token }`.

### `embedded.page`

| Method                                     | Notes                                                                                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `navigate(path, { state?, replace? })`     | SPA navigation to a dashboard route (e.g. `/orders`, `/products`). Use absolute paths. Use `replace: true` for automatic redirects. |
| `redirect(url)`                            | Full `window.location.assign()` at host level, for external URLs and OAuth. Only use trusted URLs.                                  |
| `navTo(path, options?)`                    | Picks `navigate` for internal paths and `redirect` for URLs.                                                                        |
| `setTitle(title)`                          | Host document title. Keep it to 1–3 words.                                                                                          |
| `resize` / `autoResize` / `stopAutoResize` | **Deprecated, no-ops.** The host sizes the iframe.                                                                                  |

### `embedded.nav`

**Primary navbar action** (top-bar button, optional dropdown):

```js
embedded.nav.setAction({
  title: "Actions", value: "main-action", icon: "sicon-plus", disabled: false, subTitle: "",
  extendedActions: [{ title: "Export CSV", value: "export_csv", subTitle?, icon?, disabled? }],
});
const off = embedded.nav.onActionClick((value) => { /* primary or extended value */ });
embedded.nav.clearAction(); // on unmount / context switch
```

**Sub-nav items** (host-level tabs, with one optional level of `children`):

| Method                                                                  | Notes                                                                                                                                                           |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `addNavItem({ title, value, url, disabled?, active?, children? })`      | `Promise<{ value, id }>` (`id` is deprecated, same as `value`). `value` must be globally unique across parents and children, and can't be changed.              |
| `updateNavItem({ value, title?, url?, disabled?, active?, children? })` | Patches a parent or child. Passing `children` on a parent replaces the whole list. `active: true` clears the other active siblings. Unknown values are ignored. |
| `removeNavItem(value)`                                                  | Removing a parent removes its whole group. Native items are never removed.                                                                                      |
| `onNavItemClick(({ value, url }) => …)`                                 | Returns unsubscribe. Key on `value`. (`id` in the payload is deprecated. The docs' "common examples" still show `id`; use `value`.)                             |

### `embedded.ui`

| Method                                                             | Notes                                                                                                              |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `toast.success/error/warning/info(message, duration?)`             | Default duration 3000 ms. The docs advise skipping success toasts when the UI update already shows the result.     |
| `toast.show({ type, message, duration? })`                         | `type`: `success` \| `error` \| `warning` \| `info`                                                                |
| `confirm({ title, message, confirmText?, cancelText?, variant? })` | `Promise<{ confirmed: boolean }>`. `variant`: `info` (default) \| `warning` \| `danger`. Use `danger` for deletes. |
| `loading.show()` / `loading.hide()`                                | Dashboard-level loader. Always call `hide()` in `finally`. For in-component spinners, use your own UI.             |
| `breadcrumbs.hide()` / `breadcrumbs.show()`                        | Host breadcrumbs. Restore them when leaving focused flows.                                                         |

### `embedded.checkout` (addon purchases; Salla handles billing)

| Method                                 | Notes                                                                                                                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getAddons()`                          | `Promise<{ success, addons?: { slug, name, price, product_id, product_price_id }[], error?: { code, message } }>`. Cached host-side for 30 min. Errors resolve (no throw).                                        |
| `create(item \| item[], { context? })` | `item = { type: "addon", slug, quantity?=1 }`. Throws synchronously for an empty array or a missing slug/type. Addons are defined in the Partners Portal publish form (Pricing step). VAT is applied at checkout. |
| `onResult((result) => …)`              | Returns unsubscribe. `result = { success, order_id?, status: "paid"\|"pending"\|"failed"\|"cancelled"\|"success", error?, context? }`.                                                                            |
| `resetCache()` / `destroy()`           |                                                                                                                                                                                                                   |

**Register `onResult` during init, before any `create()`.** After a 3DS redirect, the iframe reloads and the stored result (including your `context`) arrives via `onResult`. Pass the current route in `context` to restore state.

### Design rules (required for a native feel)

- **No-Chrome rule:** no sidebar, top navbar or breadcrumbs inside the iframe. Use `page.setTitle`, `nav.setAction` and `nav.addNavItem`. Content should be full width.
- **Theme:** support light and dark and react to `onThemeChange`.
- **Colors:**

  | Token     | Light                    | Dark                    |
  | --------- | ------------------------ | ----------------------- |
  | primary   | `#004d5b` (189 100% 17%) | `#baefe3` (166 70% 84%) |
  | secondary | `#73fcd7` (163 100% 82%) | `#baefe3`               |
  | success   | `#00b259`                | `#00b259`               |
  | danger    | `#f5434a`                | `#f5434a`               |
  | bg-main   | `#f8f8f8`                | `#1d1e20`               |

- **Font:** PingARLT, served from `https://cdn.salla.network/fonts/lib/pingarlt/PingARLT-{Regular,Medium,Bold}.woff2`.
- **Icons:** Hugeicons (`hgi hgi-stroke hgi-star`). The SDK examples also use Salla icon classes (`sicon-plus`, `salla-icon-plus`).
- Arabic/RTL: honour `layout.dir` and `layout.locale`.

### Cleanup pattern

```js
const cleanups = [
  embedded.nav.onActionClick(handleAction),
  embedded.nav.onNavItemClick(handleSubNav),
  embedded.checkout.onResult(handleResult),
  embedded.onThemeChange(applyTheme),
];
// on unmount:
cleanups.forEach((fn) => fn());
embedded.nav.clearAction();
```

### Resources

- SDK source and issues: https://github.com/SallaApp/embedded-sdk
- Upstream playground: https://github.com/SallaApp/embedded-sdk-playground
- Partners Portal: https://portal.salla.partners · Support: support@salla.dev · Telegram: https://t.me/salladev

---

## Salla platform reference (docs.salla.dev)

The full docs are indexed at https://docs.salla.dev/llms.txt. Every page is available as Markdown by adding `.md` (e.g. `https://docs.salla.dev/webhooks.md`), which is the reliable way to fetch them. The site root and folder URLs (like `/embedded-sdk`) return 404. The index covers much more than apps (themes/Twilight, storefront, report builder), so only fetch the section you need.

### Where things are

| Topic                                          | Page(s)                                                                                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Getting started / create an app                | `get-started.md`, `create-app.md`, `partner-apis/get-started.md`, `playbook/introduction.md`                 |
| OAuth & tokens                                 | `authorization.md`                                                                                           |
| Merchant API basics                            | `responses.md`, `pagination.md`, `rate-limiting.md`, `multi-lang-support.md`, `versioning.md`, `security.md` |
| Merchant API endpoints                         | "API Docs" section of `llms.txt` (orders, products, customers, shipments, settings…)                         |
| Webhooks                                       | `webhooks.md`, `conditional-webhooks.md`, `webhook-events/*.md` (payload models per resource)                |
| App lifecycle events                           | `partner-apis/app-events.md`                                                                                 |
| Addons / billing                               | `partner-apis/addon-subscriptions.md`, `recurring-payments/*.md`                                             |
| App Functions (serverless handlers Salla runs) | `app-functions/*.md`, per-event triggers under `app-fuctions/events-*.md` (typo is in the real URL)          |
| Storefront snippets / e-commerce events        | `partner-apis/app-snippet.md`, `ecommerc-events/*.md`                                                        |
| Shipping apps                                  | `ship-fulfillment-apis/*.md`, `awb/*.md`                                                                     |
| App Store listing                              | `partner-apis/app-details-builder/*.md`, review: `845943f0.md`                                               |
| Salla CLI                                      | `salla-cli/*.md`                                                                                             |
| AI agent kit / MCP                             | `ai-agent-kit/*.md`                                                                                          |

### OAuth (merchant access tokens)

- Endpoints: authorize `https://accounts.salla.sa/oauth2/auth`, token and refresh `https://accounts.salla.sa/oauth2/token`, user info `https://accounts.salla.sa/oauth2/user/info`. Install link: `https://s.salla.sa/apps/install/{app-id}`.
- **Easy Mode** (the only mode allowed for published apps): no callback. Salla sends the tokens to your webhook in the `app.store.authorize` event (`data.access_token`, `refresh_token`, `expires` as a Unix timestamp, `scope`). **Custom Mode** (authorization-code with a callback URL) is for dev/testing only.
- Access tokens last **14 days**. Refresh tokens last **1 month**, and you need the `offline_access` scope to get one.
- **Refresh tokens are single-use.** Each refresh issues a new one. Reusing a refresh token (including two parallel refreshes) revokes both it and its access tokens, and the merchant must reinstall. Serialise refreshes per merchant.
- The embedded-page session token (the introspect flow above) is **not** an API token. It only proves who the merchant and user are. To call the Merchant API you need the OAuth access token stored from `app.store.authorize`.

### Merchant API conventions

- Base URL: `https://api.salla.dev/admin/v2`. HTTPS only. Header `Authorization: Bearer <ACCESS_TOKEN>`. Access is limited to the app's granted scopes (missing scope → 401 `"The access token should have access to one of those scopes: …"`).
- Success envelope: `{ "status": 200, "success": true, "data": … }`. Error envelope: `{ "status": 422, "success": false, "error": { "code", "message", "fields": { field: [msgs] } } }`.
- Status slugs: 400 `bad_request`, 401 `unauthorized` (invalid, expired or revoked token, deleted or inactive user, missing scope), 403 `forbidden`, 404 `not_found`, 422 `validation_failed`, 429 `too_many_requests`, 5xx: retry later.
- Pagination: `?page=N&per_page=M` (max 60). The response includes `pagination: { count, total, perPage, currentPage, totalPages, links }`.
- Rate limits (leaky bucket, per store plan, per minute): Plus 120 · Pro 360 · Special 720, then 1 req/s. The customers endpoint is limited to 500 per 10 minutes. Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After`.
- Localised responses: send `Accept-Language: ar|en`.
- You can optionally restrict API access to "App Trusted IPs" in the Partners Portal.

### Webhooks

- Envelope: `{ "event": "order.created", "merchant": 1234509876, "created_at": "2022-12-31 12:31:25", "data": { … } }`. Webhook version 2 is the default.
- Security strategy is shown in `X-Salla-Security-Strategy`:
  - **Signature** (default): `X-Salla-Signature` = HMAC-SHA256(**raw request body**, webhook secret) as hex. Compute it over the raw bytes and compare with a timing-safe equality check. (The docs' sample uses `JSON.stringify(req.body)`, which can break on re-serialisation.)
  - **Token**: compare the `Authorization` header to your secret.
- Salla waits about 30 s for a response. Return 200 quickly, do the work asynchronously, and dedupe for idempotency.
- **App events** (`partner-apis/app-events.md`): `app.store.authorize`, `app.installed`, `app.updated` (followed by a new `app.store.authorize`), `app.uninstalled`, `app.trial.started|expired|canceled`, `app.subscription.started|renewed|canceled|expired`, `app.feedback.created`, `app.settings.updated`.
- Store events include `order.*` (created, updated, status.updated, cancelled, refunded, deleted, payment/coupon/total/products updated, shipment._), `product._`(created, deleted, quantity.low, price/status/image/category/brand/tags updated;`product.updated`and`product.available`are deprecated),`customer._`, `category._`, `brand._`, `shipment._`, `shipping.zone._`, `shipping.company._`, `store.branch._`, `abandoned.cart`, `coupon.applied`, `invoice.created`, `specialoffer._`, `review.added`. See `webhooks.md`for the full list and`webhook-events/\*.md` for payloads.

### Addons & subscriptions

- Plans and addons are configured in the Partners Portal publish form (Pricing step). The `app.subscription.*` events fire for **both** the base plan and addons, so always branch on `data.item_type` (`"addon"` vs. plan) and match the addon by `data.item_slug`. `data.quantity` holds the purchased units, and usage tracking is your job.
- One-time addons send only `started` (and `canceled` if the merchant cancels). For partner-recurring addons, **you** trigger each cycle with `POST /admin/v2/apps/subscriptions/{subscription_id}/renew` (using the latest subscription id, once per cycle; it is rate limited against double charges). Success sends `app.subscription.renewed` with a new `subscription_id`.
- Addon subscriptions are available by request only; using them without approval can fail review.
- In-app purchase UI goes through `embedded.checkout` (see above).

### App Functions

- These are serverless handlers that Salla runs on store events, and often replace a webhook server. The handler receives `context = { payload, settings, merchant }` and can call Salla APIs with automatic auth.
- **Synchronous actions** (e.g. `shipment.creating`) block the user and can modify or reject the operation: aim for under 500 ms, 5 s maximum. **Async events** run after the operation as fire-and-forget (30 s).
- Docs: `app-functions/what-are-app-functions.md`, `supported-events.md`, `responses.md`, `testing.md`, `cli.md`.
