// Static configuration for the Products tab and product form.

export const PRODUCTS_PER_PAGE = 30;

// Setup hints shown for errors the merchant/developer can fix
export const PRODUCT_ERROR_HINTS = {
  token_not_configured:
    "Add the store's Merchant API access token to Vercel as SALLA_ACCESS_TOKEN, then redeploy.",
  missing_scope:
    "The token works but lacks product permissions. In the Partners Portal enable 'Products Read & Write' (products.read_write), reinstall the app on the store, then put the NEW access_token in SALLA_ACCESS_TOKEN and redeploy.",
  token_expired:
    "SALLA_ACCESS_TOKEN was rejected. Access tokens expire after 14 days: put a fresh token in Vercel and redeploy, and make sure the app has the products scope.",
  session_invalid:
    "The embedded session token is invalid or expired. Refresh the session to get a new one.",
};

export const STATUS_FILTER_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "sale", label: "Active (Sale)" },
  { value: "out", label: "Out of Stock" },
  { value: "hidden", label: "Hidden" },
];

/** Badge tone per product status. */
export const PRODUCT_STATUS_TONES = {
  sale: "success",
  out: "danger",
  hidden: "neutral",
};

export const PRODUCT_TYPES = [
  { value: "product", label: "Standard Product (Physical)" },
  { value: "service", label: "Service" },
  { value: "digital", label: "Digital Product" },
  { value: "codes", label: "Digital Cards / Codes" },
  { value: "food", label: "Food / Meals" },
  { value: "group_products", label: "Group / Bundle Products" },
  { value: "donating", label: "Donation" },
];

export const PRODUCT_STATUSES = [
  { value: "sale", label: "Active (On Sale)" },
  { value: "out", label: "Out of Stock" },
  { value: "hidden", label: "Hidden" },
];

export const WEIGHT_TYPES = [
  { value: "kg", label: "kg" },
  { value: "g", label: "g" },
  { value: "lb", label: "lb" },
  { value: "oz", label: "oz" },
];
