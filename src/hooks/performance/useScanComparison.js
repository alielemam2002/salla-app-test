import { useMemo } from "react";
import {
  compareScans,
  getPreviousScan,
} from "../../utils/performance/historyStorage.js";

/**
 * Compare the current report's strategy with the previous saved scan.
 * Returns null when there is nothing to compare against.
 */
export function useScanComparison(report, strategy) {
  return useMemo(() => {
    if (!report?.url) return null;
    const current = report[strategy];
    if (!current) return null;

    const previousScan = getPreviousScan(
      report.url,
      strategy,
      report.fetchedAt,
    );
    if (!previousScan) return null;

    const comparison = compareScans(current, previousScan);
    if (!comparison) return null;

    return { comparison, previousScan };
  }, [report, strategy]);
}
