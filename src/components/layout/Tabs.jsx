import { SegmentedTabs } from "../ui/index.js";

/** Page-level tab strip under the header. */
export default function Tabs({ activeTab, onTabChange, tabs }) {
  return (
    <nav className="tabs-container" aria-label="أقسام التطبيق">
      <SegmentedTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        variant="underline"
        ariaLabel="أقسام التطبيق"
      />
    </nav>
  );
}
