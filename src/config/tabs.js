import {
  Code2,
  Package,
  Puzzle,
  Terminal,
  TicketPercent,
} from "lucide-react";

/**
 * Top-level tabs. Single source of truth for the in-app tab strip and the
 * host sub-nav items registered by useNavSync.
 */
export const APP_TABS = [
  { id: "test-console", label: "Test Console", icon: Terminal },
  { id: "playground", label: "Playground", icon: Code2 },
  { id: "addons", label: "Addons", icon: Puzzle },
  { id: "products", label: "Products", icon: Package },
  { id: "coupons", label: "Coupons", icon: TicketPercent },
];

export const DEFAULT_TAB = APP_TABS[0].id;
