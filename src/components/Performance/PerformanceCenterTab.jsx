import { useState } from "react";
import { useDisclosure } from "../../hooks/ui/useDisclosure.js";
import { usePerformanceHistory } from "../../hooks/performance/usePerformanceQueries.js";
import { usePerformanceScan } from "../../hooks/performance/usePerformanceScan.js";
import { useGoogleApiKey } from "../../hooks/performance/useGoogleApiKey.js";
import { useScanComparison } from "../../hooks/performance/useScanComparison.js";
import PerformanceHeader from "./PerformanceHeader.jsx";
import UrlScanForm from "./UrlScanForm.jsx";
import ScanProgress from "./ScanProgress.jsx";
import ScanErrorBanner from "./ScanErrorBanner.jsx";
import ResultsView from "./ResultsView.jsx";
import WelcomeState from "./WelcomeState.jsx";
import GoogleApiKeyModal from "./GoogleApiKeyModal.jsx";

/**
 * Performance Center tab (container). State lives in hooks; the children
 * below are presentational.
 */
export default function PerformanceCenterTab({ token, appId }) {
  const [selectedDays, setSelectedDays] = useState(30);
  const apiKeyDialog = useDisclosure();
  const { apiKey, hasKey, saveKey, clearKey } = useGoogleApiKey();
  const scan = usePerformanceScan({ token, appId, apiKey });

  const { data: history = [] } = usePerformanceHistory({
    url: scan.activeReport?.url || scan.storeUrlInput,
    strategy: scan.selectedStrategy,
    days: selectedDays,
  });
  const comparison = useScanComparison(
    scan.activeReport,
    scan.selectedStrategy,
  );

  const openApiKey = () => apiKeyDialog.open();
  const rescan = () => scan.startScan(scan.selectedStrategy, true);
  const showWelcome = !scan.activeReport && !scan.scanStep && !scan.error;

  return (
    <div
      className="perf-center"
      role="region"
      aria-label="مركز أداء المتجر"
      dir="rtl"
      lang="ar"
    >
      <PerformanceHeader hasApiKey={hasKey} onOpenApiKey={openApiKey}>
        <UrlScanForm
          url={scan.storeUrlInput}
          onUrlChange={scan.changeUrl}
          urlType={scan.urlType}
          onPresetSelect={scan.selectPreset}
          onSubmit={rescan}
          isPending={scan.isPending}
          validationError={scan.validationError}
        />
      </PerformanceHeader>

      {scan.scanStep && (
        <ScanProgress
          scanStep={scan.scanStep}
          strategy={scan.selectedStrategy}
        />
      )}

      {scan.error && (
        <ScanErrorBanner
          message={scan.error.message}
          onOpenApiKey={openApiKey}
          onRetry={rescan}
          onRetryDesktop={
            scan.selectedStrategy !== "desktop"
              ? () => {
                  scan.setSelectedStrategy("desktop");
                  scan.startScan("desktop", true);
                }
              : null
          }
        />
      )}

      {scan.activeReport && scan.currentDevice && (
        <ResultsView
          report={scan.activeReport}
          device={scan.currentDevice}
          strategy={scan.selectedStrategy}
          onSelectStrategy={scan.setSelectedStrategy}
          isDesktopScanning={scan.isDesktopScanning}
          isMobileScanning={scan.isMobileScanning}
          onRunStrategy={(strategy) => scan.startScan(strategy, true)}
          comparison={comparison}
          history={history}
          selectedDays={selectedDays}
          onDaysChange={setSelectedDays}
        />
      )}

      {showWelcome && <WelcomeState />}

      {apiKeyDialog.isOpen && (
        <GoogleApiKeyModal
          isOpen
          onClose={apiKeyDialog.close}
          initialKey={apiKey}
          onSave={saveKey}
          onClear={clearKey}
        />
      )}
    </div>
  );
}
