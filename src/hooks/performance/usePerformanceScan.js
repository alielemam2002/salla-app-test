import { useCallback, useEffect, useState } from "react";
import { validateStoreUrl } from "../../utils/performance/urlValidator.js";
import {
  useRunPerformanceTest,
  useStoreDefaultUrl,
} from "./usePerformanceQueries.js";

/**
 * State machine for a Performance Center scan: URL form, validation,
 * progressive mobile/desktop scanning, and the active report.
 *
 * The requested strategy runs first so results show quickly; the other
 * device is then scanned in the background and merged into the report.
 */
export function usePerformanceScan({ token, appId, apiKey }) {
  const [storeUrlInput, setStoreUrlInput] = useState("");
  const [urlType, setUrlType] = useState("homepage"); // 'homepage' | 'custom'
  const [selectedStrategy, setSelectedStrategy] = useState("mobile");
  const [activeReport, setActiveReport] = useState(null);
  const [scanStep, setScanStep] = useState(null); // 'preparing' | 'fetching' | 'completed' | null
  const [validationError, setValidationError] = useState(null);
  const [isDesktopScanning, setIsDesktopScanning] = useState(false);
  const [isMobileScanning, setIsMobileScanning] = useState(false);

  const { data: defaultStoreUrl } = useStoreDefaultUrl(token, appId);
  const runTestMutation = useRunPerformanceTest();

  // Prefill with the store's own URL once Salla returns it
  useEffect(() => {
    if (defaultStoreUrl && !storeUrlInput) {
      setStoreUrlInput(defaultStoreUrl);
    }
  }, [defaultStoreUrl, storeUrlInput]);

  const setScanningFor = (strategy, value) => {
    if (strategy === "mobile") setIsMobileScanning(value);
    if (strategy === "desktop") setIsDesktopScanning(value);
  };

  const startScan = useCallback(
    async (targetStrategy = selectedStrategy, force = false) => {
      setValidationError(null);

      const validation = validateStoreUrl(storeUrlInput);
      if (!validation.isValid) {
        setValidationError(validation.error);
        return;
      }

      const targetUrl = validation.normalizedUrl;
      setStoreUrlInput(targetUrl);

      setScanStep("preparing");
      setScanningFor(targetStrategy, true);

      try {
        const firstReport = await runTestMutation.mutateAsync({
          url: targetUrl,
          strategy: targetStrategy,
          apiKey,
          force,
          existingReport: activeReport,
          onProgressStep: (step) => setScanStep(step),
        });

        setActiveReport(firstReport);
        setScanStep(null);
        setScanningFor(targetStrategy, false);

        const otherStrategy =
          targetStrategy === "mobile" ? "desktop" : "mobile";
        const hasOtherScanned = firstReport[otherStrategy]?.score !== null;

        if (!hasOtherScanned) {
          setScanningFor(otherStrategy, true);
          try {
            const combinedReport = await runTestMutation.mutateAsync({
              url: targetUrl,
              strategy: otherStrategy,
              apiKey,
              force,
              existingReport: firstReport,
            });
            setActiveReport(combinedReport);
          } catch (err) {
            console.warn(
              `Background scan for ${otherStrategy} encountered error:`,
              err,
            );
          } finally {
            setIsDesktopScanning(false);
            setIsMobileScanning(false);
          }
        }
      } catch {
        setScanStep(null);
        setIsMobileScanning(false);
        setIsDesktopScanning(false);
      }
    },
    [storeUrlInput, selectedStrategy, apiKey, activeReport, runTestMutation],
  );

  const changeUrl = useCallback((value) => {
    setStoreUrlInput(value);
    setValidationError(null);
  }, []);

  const selectPreset = useCallback(
    (type) => {
      setUrlType(type);
      if (type === "homepage" && defaultStoreUrl) {
        setStoreUrlInput(defaultStoreUrl);
        setValidationError(null);
      }
    },
    [defaultStoreUrl],
  );

  const isPending = runTestMutation.isPending;

  return {
    // form
    storeUrlInput,
    changeUrl,
    urlType,
    selectPreset,
    validationError,
    // scan
    startScan,
    isPending,
    isScanning: isPending && !isDesktopScanning && !isMobileScanning,
    scanStep,
    isDesktopScanning,
    isMobileScanning,
    error: runTestMutation.isError ? runTestMutation.error : null,
    // results
    activeReport,
    selectedStrategy,
    setSelectedStrategy,
    currentDevice: activeReport ? activeReport[selectedStrategy] : null,
  };
}
