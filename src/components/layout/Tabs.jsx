import { SegmentedTabs } from "../ui/index.js";

/** Page-level tab strip under the header. */
export default function Tabs({ activeTab, onTabChange, tabs }) {
  return (
    <nav className="tabs-container" aria-label="Playground sections">
      <SegmentedTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        variant="underline"
        ariaLabel="Playground sections"
      />
    </nav>
  );
}
