import Header from "./Header.jsx";
import StatusBar from "./StatusBar.jsx";
import Tabs from "./Tabs.jsx";

/**
 * Page chrome: header, connection strip, tab strip and the content area.
 * Inside the Salla dashboard the app header is dropped (No-Chrome rule):
 * the host already shows the app title and owns the theme.
 */
export default function AppLayout({
  connection,
  tabs,
  activeTab,
  onTabChange,
  children,
}) {
  return (
    <div className="app">
      <div className="app-top">
        {connection.iframeMode !== "iframe" && <Header />}
        <StatusBar {...connection} />
        <Tabs tabs={tabs} activeTab={activeTab} onTabChange={onTabChange} />
      </div>
      <main
        className="main-content"
        role="tabpanel"
        aria-label={tabs.find((t) => t.id === activeTab)?.label}
      >
        {children}
      </main>
    </div>
  );
}
