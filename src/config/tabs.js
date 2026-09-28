import { Code2, Gauge, Package, Puzzle, Terminal } from "lucide-react";

/**
 * Top-level tabs. Single source of truth for the in-app tab strip and the
 * host sub-nav items registered by useNavSync.
 */
export const APP_TABS = [
  { id: "test-console", label: "Test Console", icon: Terminal },
  { id: "playground", label: "Playground", icon: Code2 },
  { id: "addons", label: "Addons", icon: Puzzle },
  { id: "products", label: "Products", icon: Package },
  { id: "performance", label: "Performance Center", icon: Gauge },
];

export const DEFAULT_TAB = APP_TABS[0].id;
