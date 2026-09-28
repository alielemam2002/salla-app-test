import PerformanceScoreCard from "./PerformanceScoreCard.jsx";
import CoreWebVitalsGrid from "./CoreWebVitalsGrid.jsx";
import RealUserExperienceSection from "./RealUserExperienceSection.jsx";
import OpportunitiesSection from "./OpportunitiesSection.jsx";
import PerformanceTrendChart from "./PerformanceTrendChart.jsx";
import ScanComparisonBanner from "./ScanComparisonBanner.jsx";

/** Everything shown once a report exists, top to bottom. */
export default function ResultsView({
  report,
  device,
  strategy,
  onSelectStrategy,
  isDesktopScanning,
  isMobileScanning,
  onRunStrategy,
  comparison,
  history,
  selectedDays,
  onDaysChange,
}) {
  return (
    <div className="perf-results">
      <ScanComparisonBanner data={comparison} strategy={strategy} />

      <PerformanceScoreCard
        report={report}
        selectedStrategy={strategy}
        onSelectStrategy={onSelectStrategy}
        isDesktopScanning={isDesktopScanning}
        isMobileScanning={isMobileScanning}
        onRunStrategy={onRunStrategy}
      />

      <CoreWebVitalsGrid strategy={strategy} metrics={device.metrics} />

      <RealUserExperienceSection fieldData={report.fieldData} />

      <OpportunitiesSection recommendations={device.recommendations} />

      <PerformanceTrendChart
        history={history}
        strategy={strategy}
        selectedDays={selectedDays}
        onDaysChange={onDaysChange}
      />

      <footer className="perf-attribution">
        <span>
          بيانات القياس المخبري مستخرجة بواسطة:{" "}
          <strong>Google Lighthouse Engine v12+</strong>
        </span>
        <span aria-hidden="true">•</span>
        <span>
          بيانات المستخدمين الفعليين مستخرجة من:{" "}
          <strong>Google Chrome UX Report (CrUX)</strong>
        </span>
      </footer>
    </div>
  );
}
