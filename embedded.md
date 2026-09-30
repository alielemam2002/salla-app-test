**All `embedded.*` methods** — v0.2.6, grouped by module.

**Core** (`embedded.*`)
| Method | Signature | Does |
|---|---|---|
| `init(options?)` | `→ Promise<{layout}>` | Bootstrap, get `{theme, dir, locale, currency, width}` |
| `ready()` | `→ void` | Tell host "loaded, remove spinner" |
| `destroy()` | `→ void` | Tear down, clean up listeners |
| `isReady()` | `→ boolean` | Check init state |
| `getState()` | `→ EmbeddedState` | `{ready, initializing, layout}` |
| `onInit(cb)` | `→ Unsubscribe` | Fires when init completes (immediately if already done) |
| `onThemeChange(cb)` | `→ Unsubscribe` | Host flips theme live |

**`auth`**
| Method | Signature | Does |
|---|---|---|
| `getToken()` | `→ string \| null` | Short-lived token from `?token=` |
| `getAppId()` | `→ string \| null` | App ID from `?app_id=` |
| `refresh()` | `→ void` | Ask host to reload iframe with fresh token |
| `introspect(opts?)` | `→ Promise<IntrospectResponse>` | ⚠️ dev/debug only — verifies token client-side. **Production must verify on your backend** (`POST /exchange-authority/v1/introspect`, per the skill), not this. |

**`page`**
| Method | Signature | Does |
|---|---|---|
| `navigate(path, opts?)` | `→ void` | SPA route change (internal) |
| `redirect(url)` | `→ void` | Full reload (external) |
| `navTo(path, opts?)` | `→ void` | Auto-picks navigate vs redirect |
| `setTitle(title)` | `→ void` | Set host document title |
| `resize/autoResize/stopAutoResize` | — | **Deprecated**, no-ops — host manages iframe height |

**`nav`**
| Method | Signature | Does |
|---|---|---|
| `setAction(config)` | `→ void` | Set navbar primary button (title, value, icon, optional dropdown `extendedActions`) |
| `clearAction()` | `→ void` | Remove it |
| `onActionClick(cb)` | `→ Unsubscribe` | Listen for clicks, receives `value` |
| `addNavItem(item)` | `→ Promise<{value, id}>` | Inject a sub-nav tab (2s timeout if host doesn't ack) |
| `updateNavItem(patch)` | `→ void` | Patch by `value` |
| `removeNavItem(value)` | `→ void` | Remove by `value` (parent removal takes children too) |
| `onNavItemClick(cb)` | `→ Unsubscribe` | Listen for sub-nav clicks, receives `{value, url}` |

**`ui`**
| Method | Signature | Does |
|---|---|---|
| `loading.show()` / `.hide()` | `→ void` | Full-page loading indicator |
| `breadcrumbs.show()` / `.hide()` | `→ void` | Toggle host breadcrumb bar |
| `toast.show(opts)` | `→ void` | `{type, message, duration?}` |
| `toast.success/error/warning/info(msg, duration?)` | `→ void` | Shorthand toasts |
| `confirm(opts)` | `→ Promise<{confirmed}>` | Modal dialog — `{title, message, confirmText?, cancelText?, variant?}` |

**`checkout`**
| Method | Signature | Does |
|---|---|---|
| `getAddons()` | `→ Promise<{success, addons?, error?}>` | List app's addons (host caches 30 min) |
| `create(item(s), config?)` | `→ void` | Start checkout — single `{type:"addon", slug, quantity?}` or array |
| `onResult(cb)` | `→ Unsubscribe` | Fires after payment/3DS redirect: `{success, order_id?, status, error?, context?}` |
| `resetCache()` | `→ void` | Clear host-side addon cache |
| `destroy()` | `→ void` | Called automatically by `EmbeddedApp.destroy()` |
