import { missingScopeMessage, storeAccessMessage } from "../sallaAccess.js";

/**
 * Turn a failed coupons API result into text a merchant can act on.
 * Never exposes stack traces or the raw token diagnostics from the server.
 */

const ACTION_TITLES = {
  load: "تعذّر تحميل الكوبونات.",
  create: "تعذّر إنشاء الكوبون.",
  update: "تعذّر تعديل الكوبون.",
  delete: "تعذّر حذف الكوبون.",
};

export const FIELD_LABELS = {
  code: "كود الكوبون",
  type: "نوع الخصم",
  amount: "قيمة الخصم",
  maximum_amount: "الحد الأقصى للخصم",
  minimum_amount: "الحد الأدنى للطلب",
  start_date: "تاريخ البداية",
  expiry_date: "تاريخ الانتهاء",
  usage_limit: "حد الاستخدام",
  usage_limit_per_user: "حد الاستخدام لكل عميل",
  free_shipping: "شحن مجاني",
  exclude_sale_products: "استثناء المنتجات المخفضة",
  group_suffix: "لاحقة المجموعة",
};

// Salla sometimes returns translation keys instead of sentences.
const isTranslationKey = (msg) => /^[a-z_]+(\.[a-z_]+)+$/i.test(msg || "");

function reasonFor(result) {
  const { status, code } = result;
  if (code === "network_error" || status === 0) {
    return "مشكلة في الاتصال. تحقق من الإنترنت ثم أعد المحاولة.";
  }
  if (code === "session_invalid") {
    return "انتهت جلسة سلة. حدّث الجلسة ثم أعد المحاولة.";
  }
  const access = storeAccessMessage(code);
  if (access) return access;
  if (code === "missing_scope") {
    return missingScopeMessage(
      "التسويق (marketing.read_write) لإدارة الكوبونات",
    );
  }
  switch (status) {
    case 400:
      return "الطلب غير صالح.";
    case 401:
      return "لم تقبل سلة بيانات اعتماد التطبيق.";
    case 403:
      return "غير مسموح للتطبيق بتنفيذ هذا الإجراء.";
    case 404:
      return "هذا الكوبون لم يعد موجودًا. ربما تم حذفه.";
    case 409:
      return "يوجد كوبون بنفس الكود مسبقًا.";
    case 422:
      return "بعض الحقول غير صحيحة.";
    case 429:
      return "طلبات كثيرة إلى سلة. انتظر دقيقة ثم أعد المحاولة.";
    default:
      if (status >= 500)
        return "حدثت مشكلة مؤقتة في سلة. حاول مرة أخرى لاحقًا.";
      return null;
  }
}

/**
 * @param {object} result - `{ status, code, error, fields }` from couponsApi
 * @param {"load"|"create"|"update"|"delete"} action
 * @returns {{ title: string, reason: string, fieldErrors: Record<string,string>, canRefreshSession: boolean }}
 */
export function describeCouponError(result = {}, action = "load") {
  const fieldErrors = {};
  if (result.fields && typeof result.fields === "object") {
    for (const [key, messages] of Object.entries(result.fields)) {
      const text = Array.isArray(messages)
        ? messages.join(" ")
        : String(messages);
      if (text) fieldErrors[key] = text;
    }
  }

  const known = reasonFor(result);
  const sallaMessage =
    result.code === "salla_api_error" && !isTranslationKey(result.error)
      ? result.error
      : null;
  // For 4xx from Salla, its own message is usually the most specific reason.
  const reason =
    (result.status >= 400 && result.status < 500 && sallaMessage) ||
    known ||
    sallaMessage ||
    "حدث خطأ ما. أعد المحاولة.";

  return {
    title: ACTION_TITLES[action] || ACTION_TITLES.load,
    reason,
    fieldErrors,
    canRefreshSession: result.code === "session_invalid",
  };
}
