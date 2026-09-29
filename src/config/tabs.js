import {
  Megaphone,
  Package,
  Puzzle,
  ShoppingCart,
  TicketPercent,
} from "lucide-react";

/**
 * Top-level tabs. Single source of truth for the in-app tab strip and the
 * host sub-nav items registered by useNavSync.
 */
export const APP_TABS = [
  { id: "products", label: "المنتجات", icon: Package },
  { id: "coupons", label: "الكوبونات", icon: TicketPercent },
  { id: "cart-recovery", label: "السلات المتروكة", icon: ShoppingCart },
  { id: "campaigns", label: "حملات واتساب", icon: Megaphone },
  { id: "addons", label: "الإضافات", icon: Puzzle },
];

export const DEFAULT_TAB = APP_TABS[0].id;
