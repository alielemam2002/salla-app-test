import {
  Bell,
  Megaphone,
  Package,
  Puzzle,
  Repeat,
  Settings,
  ShoppingCart,
  Smartphone,
  TicketPercent,
} from "lucide-react";

/**
 * Top-level tabs. Single source of truth for the in-app tab strip and the
 * host sub-nav items registered by useNavSync.
 */
export const APP_TABS = [
  { id: "products", label: "المنتجات", icon: Package },
  { id: "alerts", label: "التنبيهات", icon: Bell },
  { id: "coupons", label: "الكوبونات", icon: TicketPercent },
  { id: "cart-recovery", label: "السلات المتروكة", icon: ShoppingCart },
  { id: "campaigns", label: "حملات واتساب", icon: Megaphone },
  { id: "replenish", label: "إعادة الشراء", icon: Repeat },
  { id: "mobile-app", label: "تطبيق الجوال", icon: Smartphone },
  { id: "addons", label: "الإضافات", icon: Puzzle },
  { id: "settings", label: "الإعدادات", icon: Settings },
];

export const DEFAULT_TAB = APP_TABS[0].id;
