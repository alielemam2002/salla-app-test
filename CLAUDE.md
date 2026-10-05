# CLAUDE.md

Guidance for working in this repo: a React + Vite merchant app ("مدير المتجر") that runs inside the Salla Merchant Dashboard iframe using `@salla.sa/embedded-sdk` (currently `0.2.6`). Tabs: Products, Alerts, Coupons, Cart Recovery, WhatsApp Campaigns, Replenish, Addons, Settings (the old Test Console and Playground tabs were removed).

**The UI is Arabic and RTL.** `index.html` sets `lang="ar" dir="rtl"`. There is no i18n library: write Arabic user-facing text directly in components (or in the feature's label modules). Keep identifiers, API/env names, scope names, codes, currency codes and Western digits as they are; put `dir="ltr"` on LTR values (URLs, phones, SKUs, codes, tokens). Use logical CSS properties only (no `left`/`right`/`margin-left`).

Source docs: https://docs.salla.dev/embedded-sdk/overview.md (index of all pages: https://docs.salla.dev/llms.txt, "Embedded SDK" section). The type declarations in [public/types/salla-embedded-sdk.d.ts](public/types/salla-embedded-sdk.d.ts) (synced by `scripts/sync-types.js`) are the source of truth when docs and code disagree.

## Project

| Command                     | What it does                                                 |
| --------------------------- | ------------------------------------------------------------ |
| `pnpm dev`                  | Sync SDK types, start Vite dev server                        |
| `pnpm dev:vercel`           | Run app + `api/` functions locally (needs global Vercel CLI) |
| `pnpm build`                | Sync types + `vite build` → `dist/`                          |
| `pnpm test`                 | Vitest (jsdom) with coverage                                 |
| `pnpm lint` / `pnpm format` | ESLint / Prettier                                            |

- **Hosting: Vercel.** Config in [vercel.json](vercel.json). Serverless functions live in [api/](api/) (Node, ESM). `verify-token.js` uses `export default function handler(req, res)`; newer ones use Web-style `export async function POST(request)`. Shared code goes in [api/\_lib/](api/_lib/), whose files are not deployed as functions. **The Hobby plan allows at most 12 functions** (each `api/*.js`; a 13th fails the deployment, guarded by `src/utils/__tests__/vercelFunctions.test.js`): add an action to an existing endpoint, or a `vercel.json` rewrite to one, instead of a new file. There is no Netlify anymore; don't reintroduce `/.netlify/functions/*` paths.
- **Products tab (Merchant API access):**
  - [api/products.js](api/products.js) introspects the embedded token (to confirm the caller is a real merchant session), then calls `GET /admin/v2/products` with **that store's own OAuth token** (`sallaApiFor(merchant_id)`).
  - **Store tokens (Easy Mode, no token in env):** app `1644707987` has `redirect_urls` = Salla's callback (`https://accounts.salla.sa/callback/1644707987`), `webhook_url` = `https://salla-app-test.vercel.app/api/salla-webhook`, `webhook_security_strategy` = `signature` (set with the Salla Partners MCP `salla_apps connect`). Salla sends each store's tokens in `app.store.authorize` on install and on every app update; [api/salla-webhook.js](api/salla-webhook.js) verifies the signature and [api/_lib/merchantTokens.js](api/_lib/merchantTokens.js) saves them encrypted (secretBox) in Redis `salla:tokens:{merchant}` (`expires` is a Unix timestamp in seconds). `app.uninstalled` deletes them. `getAccessToken(merchantId)` refreshes a day before expiry at `https://accounts.salla.sa/oauth2/token` (`grant_type=refresh_token`, `SALLA_CLIENT_ID` / `SALLA_CLIENT_SECRET`) under a per-store lock (`salla:token-refresh:{merchant}`, SET NX + owner-checked release via `kvDelIfValue`), re-reads inside the lock, and saves BOTH new tokens before releasing: refresh tokens are single-use and a double use revokes the chain. A rejected refresh (400/401) marks the record `revoked`. [api/_lib/salla.js](api/_lib/salla.js) only exposes `sallaApiFor(merchantId)` (the raw request is private); `merchantId` must come from introspect or a signed webhook. A store without tokens gets 403 `store_not_authorized` ("reinstall the app"); messages for these codes live in `src/utils/sallaAccess.js`. Endpoint tests mock `getAccessToken` (store `999` = never authorized); `src/utils/__tests__/merchantTokens.test.js` covers the real flow (encryption, refresh, race, revoke). To get tokens for an already-installed store, reinstall (or update) the app after deploying. (Upstash Redis holds per-merchant data only: store tokens, WhatsApp settings, alerts, replenish.)
  - UI: [src/components/Products/ProductsTab.jsx](src/components/Products/ProductsTab.jsx) and [src/utils/productsApi.js](src/utils/productsApi.js).
  - **Bulk actions** (Products page selection bar): one `POST /products/actions` per submit (scope `products.read_write`), action `bulk_actions` in [api/products.js](api/products.js). [src/utils/bulkActions/bulkActionSpec.js](src/utils/bulkActions/bulkActionSpec.js) is the single source for the documented actions (`duplicate`, `sale-channels`, `features`, `notify-quantity`, `pricing`; `restore` has no UI), the pricing formulas (verbatim from the docs' table) and the `filters` shape; the server re-validates against it. "Select all matching" sends `select_all` + the list's status/category filters + `unselected_ids`, never a list of every id; it's unavailable with a text search (Salla's bulk filters have no keyword). Several products are queued by Salla, and there is no status endpoint, so operations are logged in localStorage with the status Salla returned and never shown as completed by us.
  - **Product media** (Product Editor → Appearance → "إدارة الوسائط"): image files go one per request through [api/product-media.js](api/product-media.js) (multipart) to `POST /products/{id}/images`. Salla allows 10 images per product and documents no formats or size limit; the 4.4 MB cap is Vercel's 4.5 MB request limit. Salla has **no video file upload**, only YouTube links (`POST /products/{id}/video`, action `video_attach`). Delete is `DELETE /products/images/{image}`. Images are listed from Product Details (there is no list-images endpoint). The upload queue (2 at a time, cancel, retry) is local state in `useMediaUploadQueue`; after uploads only the images query is refetched, never the product, so unsaved form edits stay.
- **Alerts tab (stock alerts for the merchant):** [api/stock-alerts.js](api/stock-alerts.js) (actions `overview`, `stock`, `settings_save`, `mark_read`, `clear`) and [api/salla-webhook.js](api/salla-webhook.js), the app's Salla webhook endpoint. The webhook verifies every delivery with `SALLA_WEBHOOK_SECRET` (Signature strategy: HMAC-SHA256 of the raw body, hex, in `X-Salla-Signature`; Token strategy: `Authorization` equals the secret; timing-safe), handles only `order.created`, and acknowledges and ignores every other event (app events can carry OAuth tokens: never log bodies). For each ordered product it reads `GET /products/{id}` and, if the product is out of stock or at/under the merchant's threshold, pushes an alert to the Redis list `alerts:{merchant}` (newest first, max 200). Salla retries failed deliveries, so each order is handled once (`alerts:order:{merchant}:{order}` SET NX, released on failure so the retry works; a 500 asks Salla to retry, token/scope errors return 200). It reads products with the webhook `merchant`'s own token; a store that never authorized the app is skipped (`store_not_authorized`). The tab also scans `GET /products` (10 pages × 60) for out-of-stock/low products right now, so it works before the webhook is set up. Threshold options and `stockLevel()` (unlimited stock never alerts; an untracked quantity only alerts when Salla's status is `out`) are in `src/utils/alerts/stockModel.js`, shared with the server. The webhook URL (`https://<domain>/api/salla-webhook`) and `order.created` are registered by hand in the Partners Portal (app → Webhooks/Notifications). UI: [src/components/Alerts/](src/components/Alerts/), hooks `src/hooks/alerts/` (overview re-checked every minute while the tab is open).
- **Coupons tab (storewide coupons):** [api/coupons.js](api/coupons.js) does list/get/create/update/delete on `/admin/v2/coupons` with the same introspect + store-token pattern. The app needs scopes `marketing.read` and `marketing.read_write`. The payload is built from an allow-list and never sends include/exclude lists, so coupons created here always apply to the entire store. Coupons that have rules the form doesn't manage (products, customer groups, payment methods, groups, marketers) are view/delete only, because Salla's update is a `PUT`. Salla dates have no offset; they are read as store time (+03:00). UI: [src/components/Coupons/](src/components/Coupons/), hooks in `src/hooks/coupons/`, pure helpers in `src/utils/coupons/`.
- **Cart Recovery tab (stage 1, read-only):** [api/carts.js](api/carts.js) lists `GET /admin/v2/carts/abandoned` (cursor pagination: follow `pagination.next`, 60 per page, capped at 20 pages) and reads `GET /carts/abandoned/{id}` plus product names from `GET /products/{id}`. Needs scope `carts.read`. Salla has no API for an app to message customers, so reminders are manual: the WhatsApp button opens a `wa.me` link with Salla's `checkout_url` and the merchant sends it. The threshold, message templates, chosen coupon and "WhatsApp opened" log live in this browser's localStorage. Recovered carts / recovery rate need the `abandoned.cart.purchased` webhook and storage (stage 2), so they aren't shown. UI: [src/components/CartRecovery/](src/components/CartRecovery/), hooks in `src/hooks/cartRecovery/`, helpers in `src/utils/cartRecovery/`.
  - **WhatsApp Cloud API:** [api/whatsapp.js](api/whatsapp.js) sends an approved template via `POST https://graph.facebook.com/{version}/{phone-number-id}/messages`, one cart per request, only when the merchant presses Send (or "Send to N shown carts", which goes one at a time and skips carts messaged in the last 24 h). It reads the cart from Salla itself and refuses purchased carts. "Sent" = Meta accepted it; delivery/read need Meta's webhook (stage 2). The sent log is per browser. A per-browser switch ("قالب معتمد" / "رسالة نصية", `sendMode` in the settings store) makes Send use `mode: "text"`: the message from the tab's editor goes out as a normal `type: "text"` message; WhatsApp only delivers it inside the 24-hour window after the customer's last message (otherwise Meta error 131047, explained in Arabic). The recipient is still taken from Salla's cart, never from the browser.
  - **Per-merchant WhatsApp settings:** each merchant enters their own Phone Number ID, access token, template name/language and variable order in the app (WhatsApp settings dialog). Stored in Upstash Redis under `wa:settings:{merchant_id}` (merchant id from the verified session); the token is AES-256-GCM encrypted with `WA_SETTINGS_KEY` ([api/_lib/secretBox.js](api/_lib/secretBox.js)) and never returned to the browser (only its last 4 characters). Saving first checks the id + token with Meta (`GET /{phone-number-id}?fields=display_phone_number,verified_name,quality_rating`). There is no shared/server fallback account: a merchant can send from the app only after connecting their own account and while their **Send from the app** switch is on (`enabled` in the record, action `settings_enable`, enforced on the server: `send` returns 403 `whatsapp_disabled`). Otherwise reminders are manual (wa.me). `send_test` works while switched off. Libs: [api/_lib/kv.js](api/_lib/kv.js) (Upstash REST, no dependency), [api/_lib/whatsappGraph.js](api/_lib/whatsappGraph.js), [api/_lib/whatsappSettings.js](api/_lib/whatsappSettings.js).
  - **Connect with Facebook (Meta Embedded Signup, test):** button "ربط واتساب عبر فيسبوك" in the Cart Recovery status (shown only when `signup_config` says `available`: `META_APP_ID` + `META_APP_SECRET` + `META_ES_CONFIG_ID` + storage). [useEmbeddedSignup](src/hooks/whatsapp/useEmbeddedSignup.js) preloads Meta's JS SDK ([src/utils/whatsapp/embeddedSignup.js](src/utils/whatsapp/embeddedSignup.js)) so `FB.login({ config_id, response_type: "code", override_default_response_type: true, extras: { setup: {} } })` runs right in the click (popup blockers). The popup posts `WA_EMBEDDED_SIGNUP` (FINISH → `waba_id` + `phone_number_id`, CANCEL → `current_step` / `error_message`; only `facebook.com` origins are trusted); FB.login's callback gets a code valid ~30 s. When both are in, `signup_complete` ([api/whatsapp.js](api/whatsapp.js), [api/_lib/metaSignup.js](api/_lib/metaSignup.js)): exchange the code (`GET /oauth/access_token?client_id&client_secret&code`, the URL is never logged) → check the number (`fetchPhoneProfile`) → `POST /{waba}/subscribed_apps` → `POST /{phone}/register` with a 6-digit PIN (stored sealed as `pin`, reused when the same number reconnects) → `saveAccount(..., { source: "embedded_signup" })` → templates sync. Subscribe/register failures come back as `warnings` (the account is still saved). A typed token sets `source: "manual"`. The business token may expire (60-day config); reconnecting refreshes it. The merchant still adds a payment method in WhatsApp Manager. Untested inside the Salla iframe: if the dashboard's iframe blocks popups, FB.login can't open. The Meta app's webhook URL is `/api/meta-webhook`, a `vercel.json` rewrite to [api/salla-webhook.js](api/salla-webhook.js) (Hobby limit, see Hosting); [api/_lib/metaWebhook.js](api/_lib/metaWebhook.js) handles GET (`hub.verify_token` handshake) and any POST with `X-Hub-Signature-256` (checked with `META_APP_SECRET`, acknowledged only, bodies never logged).
- **WhatsApp Campaigns tab:** send an approved Marketing template (offer, promo code…) to customers the merchant picks. [api/customers.js](api/customers.js) lists `GET /admin/v2/customers` (cursor pagination, `fields[]=is_blocked&fields[]=is_notifications_enabled`; the number is `mobile_code` + `mobile`, which Salla stores apart) and `GET /customers/groups`; scope `customers.read` (Salla allows 500 customer requests per 10 min). Blocked customers, customers with notifications off, and numbers without a country code can't be selected. Sending is action `send_campaign` in [api/whatsapp.js](api/whatsapp.js): the campaign's template/language/variables (`customer_name` | `coupon_code` | `custom`) on the merchant's own account, only while "Send from the app" is on. The browser sends one customer at a time (tab must stay open), stops on errors that repeat for everyone (template not approved, token expired…), and requires a consent tick. Campaign history is per browser. UI: [src/components/Campaigns/](src/components/Campaigns/), hooks `src/hooks/campaigns/`, helpers `src/utils/campaigns/`.
- **Replenish tab (smart replenishment reminders):** the merchant sets how many days one unit of a product lasts (`rp:cycles:{merchant}`). [api/salla-webhook.js](api/salla-webhook.js) schedules a reminder per product from `order.created` (the payload has the customer's `mobile` + `mobile_code` and `items[].product.{name,url}`, so no Salla API call): due = order date + days × units (max 6) − lead days (at least 1 day). Salla retries are deduped per order; buying the product again supersedes the older reminder; `order.cancelled` / `order.refunded` / `order.deleted` cancel the order's reminders (subscribe to those events in the Partners Portal). [api/replenish.js](api/replenish.js): `GET` is the Vercel Cron (`vercel.json` `crons`, `0 16 * * *` UTC, Hobby = once a day, needs `CRON_SECRET` as `Authorization: Bearer`); `POST` actions `get`, `settings_save`, `cycle_set`, `send_now`, `cancel`, `send_test`. Sending uses the merchant's own WhatsApp account (the same "Send from the app" switch) with a separate approved Marketing template (`template`, `language`, `params` from `customer_name` | `product_name` | `product_url` | `coupon_code`); switching on needs the merchant's opt-in confirmation (`consentAt`), WhatsApp connected + on, and `CRON_SECRET`. Daily cap (25/50/100), 131049 → retry after 24 h (up to 7 times), 131026 → skipped, errors that repeat for everyone stop the run and leave reminders scheduled. Redis keys and the run are documented in [api/_lib/replenish.js](api/_lib/replenish.js); shared rules in `src/utils/replenish/replenishModel.js`. The message links to the product page. [storefront/reorder-snippet.js](storefront/reorder-snippet.js) is an App Snippet for one-click reorder (`?reorder=<order id>` → `salla.order.createCartFromOrder`), not deployed and untested on a live store because the demo store is in maintenance mode; Salla's snippet validator rejects banned words (e.g. `replaceState`) even inside comments. Endpoint tests share the in-memory Upstash fake `src/test/fakeRedis.js`.
- **Settings tab (stage 1 of 2):** one place for what every feature shares. [src/components/Settings/](src/components/Settings/), hooks `src/hooks/settings/useSettings.js`, labels `src/utils/settings/settingsLabels.js`.
  - **Store details:** [api/store.js](api/store.js) (`info`) returns `access` (`tokenStatus`: authorized, expiry, `offline_access`, scopes; never token values), `store` (picked fields of `GET /store/info`: plan, status, verified, licenses, owner, default branch…) and `user` (`GET https://accounts.salla.sa/oauth2/user/info`, `data` envelope: commercial / tax numbers) via `sallaUserInfo()` in [api/_lib/salla.js](api/_lib/salla.js). Each part fails on its own (`errors.store` / `errors.user`); a store without tokens gets `access.authorized: false` and no Salla call.
  - **WhatsApp account, entered once:** action `account_save` in [api/whatsapp.js](api/whatsapp.js): Phone Number ID + **WABA ID (required)** + token (blank = keep), checked with Meta (`checkWithMeta`), saved by `saveAccount()` which keeps the cart reminder template fields; then it reads the templates. The "Send from the app" switch and disconnect reuse `settings_enable` / `settings_delete` (which also deletes the templates snapshot).
  - **Templates library:** read from Meta, not typed: `templates_sync` → `GET /{waba-id}/message_templates?fields=id,name,language,status,category,parameter_format,components` (cursor paging, 5 × 100), normalised by `normalizeTemplate()` in [api/_lib/whatsappGraph.js](api/_lib/whatsappGraph.js) (header/body/footer/buttons, `variables: { header, body, buttons }`, positional `{{1}}` or named `{{name}}`), stored as a snapshot in `wa:templates:{merchant}`; `templates_list` reads the snapshot. Reading templates needs `whatsapp_business_management` on the token (Meta 10/200 → explained).
  - **Stage 2: features pick from the library.** A *binding* ([src/utils/whatsapp/templateBinding.js](src/utils/whatsapp/templateBinding.js), shared with the server) = a library template + what fills each variable: `slots` of `{ part: header|body|button, name, index?, url?, source, value? }`, `source` from `BINDING_SOURCES[feature]` (cart: `TEMPLATE_VARIABLES`; replenish: `REPLENISH_VARIABLES`; campaign: `customer_name`, `coupon_code`) or `custom` (fixed text). `resolveBinding()` re-reads name/language/format/button URLs from the library snapshot, requires `APPROVED`, and requires every variable (the browser's template details are never trusted). `buildBoundMessage()` ([api/_lib/whatsappGraph.js](api/_lib/whatsappGraph.js)) sends header/body parameters (named templates with `parameter_name`) and URL-button suffixes (`urlButtonValue`: only the part after the button's fixed URL). Cart and replenish bindings are saved in `wa:bindings:{merchant}` via `binding_save` / `binding_get` in [api/whatsapp.js](api/whatsapp.js) (deleted with the account); `send`, `send_test` and the replenish run/test use them and fall back to the old typed template if there is none (`sendingBlocker` / `validateSettings({ hasBinding })`). Campaigns send `binding` + `couponCode` with every `send_campaign` (checked each time). UI: one [TemplatePicker](src/components/whatsapp/TemplatePicker.jsx) (approved templates only, sensible default sources, live preview), used by the cart reminder modal ([CartTemplateModal](src/components/CartRecovery/CartTemplateModal.jsx), which replaced the old account + template modal; the account lives in Settings), the campaign form (campaign coupon shown when a slot uses it) and the replenish template mode ("حفظ القالب"). Tabs get `onNavigate` from `App.jsx` to send the merchant to Settings. Hooks: `src/hooks/whatsapp/useTemplateBindings.js`.
- **Vercel env vars:**

  | Variable             | Required? | Purpose                                                             |
  | -------------------- | --------- | ------------------------------------------------------------------- |
  | `SALLA_CLIENT_ID` / `SALLA_CLIENT_SECRET` | Yes | The app's OAuth client (Partners Portal → the app → App Keys). Used only to refresh store tokens. Never commit or log them. |
  | `SALLA_APP_ID`       | Yes       | Used for introspect. Falls back to the `app_id` the page sends.     |
  | `ENV`                | No        | Selects the verify-token upstream.                                  |
  | `KV_REST_API_URL` / `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) | For WhatsApp settings | Upstash Redis. Set automatically when you add Upstash Redis to the Vercel project. |
  | `WA_SETTINGS_KEY` | Yes | 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts stores' Salla tokens and merchants' WhatsApp tokens. Changing it means stores must reinstall and merchants re-enter their WhatsApp token. |
  | `META_GRAPH_VERSION` | No | Graph API version (default `v23.0`). |
  | `META_APP_ID` / `META_ES_CONFIG_ID` | For "connect with Facebook" | The Meta app's ID and the Facebook Login for Business configuration ID (WhatsApp Embedded Signup). Public: sent to the browser to open the popup. |
  | `META_APP_SECRET` | For "connect with Facebook" | Meta app secret. Exchanges the signup code and verifies `/api/meta-webhook` deliveries. Server only, never logged. |
  | `META_WEBHOOK_VERIFY_TOKEN` | For the Meta webhook | Any random string; the same value goes in the Meta app's webhook "Verify token". |
  | `CRON_SECRET` | For replenish reminders | Random string (16+ chars). Vercel sends it to the daily cron as `Authorization: Bearer …`; without it the run refuses to start and automatic reminders can't be switched on. |
  | `SALLA_WEBHOOK_SECRET` | Yes | The app's current webhook secret (Portal, or `salla_apps get`). Verifies every delivery, including `app.store.authorize` (the tokens). If it's rotated, update it or tokens stop arriving. |

- **Token verification:** frontend [src/utils/tokenVerification.js](src/utils/tokenVerification.js) → `POST /api/verify-token` → [api/verify-token.js](api/verify-token.js) → Salla exchange-authority. `ENV` env var picks the upstream (`prod` default = `api.salla.dev`; `dev` = Salla's internal dev worker, not reachable for partners).
- **App ID** is read from the `app_id` URL query param ([src/utils/constants.js](src/utils/constants.js)).
- **Bootstrap flow** lives in [src/hooks/useAppBootstrap.js](src/hooks/useAppBootstrap.js): `init()` → `getToken()` → verify → `ready()` (or `destroy()` on failure).
- Tests sit next to code in `__tests__/` folders; `src/test/setup.js` is the Vitest setup.

### Code structure (logic vs. UI)

- **`src/components/ui/`**: shared presentational kit (`Button`, `IconButton`, `Modal`, `ConfirmDialog`, `Card`, `Field`/`TextInput`/`Select`/`Textarea`/`FormRow`, `Badge`, `Alert`, `EmptyState`, `Skeleton`, `Spinner`, `SegmentedTabs`, `Switch`, `KeyValueList`, `CodeBlock`, `StatCard`, `ToastViewport`). Import from `src/components/ui/index.js`. It makes no SDK or API calls. `Modal` renders through a portal into `document.body`, so tests should query it with `screen`, not `container`.
- **`src/hooks/ui/`**: generic UI hooks (`useDisclosure`, `useAsyncAction`, `useClipboard`).
- **`src/hooks/app/usePlaygroundApp.js`**: app-level orchestration (bootstrap, theme sync, iframe detection, nav sync, message log). `App.jsx` only renders. Inside the Salla iframe the header and connection strip are hidden (No-Chrome rule); no developer toasts are shown to merchants.
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
