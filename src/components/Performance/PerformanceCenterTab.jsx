import React, { useState, useEffect, useCallback } from 'react';
import {
  Gauge,
  Play,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Globe,
  Key,
  ExternalLink
} from 'lucide-react';
import { validateStoreUrl } from '../../utils/performance/urlValidator.js';
import {
  useStoreDefaultUrl,
  useRunPerformanceTest,
  usePerformanceHistory
} from '../../hooks/usePerformanceQueries.js';
import PerformanceScoreCard from './PerformanceScoreCard.jsx';
import CoreWebVitalsGrid from './CoreWebVitalsGrid.jsx';
import RealUserExperienceSection from './RealUserExperienceSection.jsx';
import OpportunitiesSection from './OpportunitiesSection.jsx';
import PerformanceTrendChart from './PerformanceTrendChart.jsx';
import ScanComparisonBanner from './ScanComparisonBanner.jsx';
import GoogleApiKeyModal, { getStoredGoogleApiKey } from './GoogleApiKeyModal.jsx';

/**
 * Performance Center Main Tab
 */
export default function PerformanceCenterTab({ token, appId }) {
  const [storeUrlInput, setStoreUrlInput] = useState('');
  const [urlType, setUrlType] = useState('homepage'); // 'homepage' | 'custom'
  const [selectedStrategy, setSelectedStrategy] = useState('mobile'); // 'mobile' | 'desktop'
  const [selectedDays, setSelectedDays] = useState(30);
  const [activeReport, setActiveReport] = useState(null);
  const [scanStep, setScanStep] = useState(null); // 'preparing' | 'fetching' | 'completed' | null
  const [validationError, setValidationError] = useState(null);

  // Background strategy scan tracking
  const [isDesktopScanning, setIsDesktopScanning] = useState(false);
  const [isMobileScanning, setIsMobileScanning] = useState(false);

  // Google API Key management
  const [apiKey, setApiKey] = useState(() => getStoredGoogleApiKey());
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  // Auto-detect default store URL from Salla
  const { data: defaultStoreUrl } = useStoreDefaultUrl(token, appId);

  useEffect(() => {
    if (defaultStoreUrl && !storeUrlInput) {
      setStoreUrlInput(defaultStoreUrl);
    }
  }, [defaultStoreUrl, storeUrlInput]);

  // Performance Scan Mutation
  const runTestMutation = useRunPerformanceTest();

  // History Query for current URL and strategy
  const activeUrlForHistory = activeReport?.url || storeUrlInput;
  const { data: history = [] } = usePerformanceHistory({
    url: activeUrlForHistory,
    strategy: selectedStrategy,
    days: selectedDays
  });

  /**
   * Progressive scan execution:
   * Runs the active strategy first (so user sees results in ~8s instead of waiting 30s!),
   * then progressively runs the secondary strategy in the background.
   */
  const handleStartScan = useCallback(async (targetStrategy = selectedStrategy, force = false) => {
    setValidationError(null);

    const validation = validateStoreUrl(storeUrlInput);
    if (!validation.isValid) {
      setValidationError(validation.error);
      return;
    }

    const targetUrl = validation.normalizedUrl;
    setStoreUrlInput(targetUrl);

    setScanStep('preparing');
    if (targetStrategy === 'mobile') setIsMobileScanning(true);
    if (targetStrategy === 'desktop') setIsDesktopScanning(true);

    try {
      // 1. Run primary requested strategy first
      const firstReport = await runTestMutation.mutateAsync({
        url: targetUrl,
        strategy: targetStrategy,
        apiKey,
        force,
        existingReport: activeReport,
        onProgressStep: (step) => setScanStep(step)
      });

      setActiveReport(firstReport);
      setScanStep(null);
      if (targetStrategy === 'mobile') setIsMobileScanning(false);
      if (targetStrategy === 'desktop') setIsDesktopScanning(false);

      // 2. If the other device has not been scanned yet, run it smoothly in background
      const otherStrategy = targetStrategy === 'mobile' ? 'desktop' : 'mobile';
      const hasOtherScanned = firstReport[otherStrategy]?.score !== null;

      if (!hasOtherScanned) {
        if (otherStrategy === 'desktop') setIsDesktopScanning(true);
        if (otherStrategy === 'mobile') setIsMobileScanning(true);

        try {
          const combinedReport = await runTestMutation.mutateAsync({
            url: targetUrl,
            strategy: otherStrategy,
            apiKey,
            force,
            existingReport: firstReport
          });
          setActiveReport(combinedReport);
        } catch (err) {
          console.warn(`Background scan for ${otherStrategy} encountered error:`, err);
        } finally {
          setIsDesktopScanning(false);
          setIsMobileScanning(false);
        }
      }
    } catch (err) {
      setScanStep(null);
      setIsMobileScanning(false);
      setIsDesktopScanning(false);
    }
  }, [storeUrlInput, selectedStrategy, apiKey, activeReport, runTestMutation]);

  const handlePresetSelect = (type) => {
    setUrlType(type);
    if (type === 'homepage' && defaultStoreUrl) {
      setStoreUrlInput(defaultStoreUrl);
      setValidationError(null);
    }
  };

  const isScanning = runTestMutation.isPending && !isDesktopScanning && !isMobileScanning;
  const currentDev = activeReport ? activeReport[selectedStrategy] : null;

  return (
    <div className="perf-center-container" role="main" aria-label="مركز أداء المتجر">
      {/* Top Banner & Header */}
      <div className="perf-header-panel">
        <div className="perf-header-info">
          <div className="perf-header-badge-row">
            <div className="perf-badge-label">
              <Gauge size={16} aria-hidden="true" />
              <span>Google PageSpeed &amp; CrUX Intelligence</span>
            </div>

            {/* Google API Key Settings Button */}
            <button
              type="button"
              className="perf-api-key-btn"
              onClick={() => setIsApiKeyModalOpen(true)}
              aria-label="إعداد مفتاح Google API"
            >
              <Key size={14} />
              <span>Google API Key</span>
              {apiKey ? (
                <span className="key-status-dot configured" title="المفتاح مفعل" />
              ) : (
                <span className="key-status-dot missing" title="مفتاح اختياري" />
              )}
            </button>
          </div>

          <h1 className="perf-main-title">Performance Center (مركز أداء المتجر)</h1>
          <p className="perf-subtitle">
            قياس سرعة متجرك الحقيقية بدقة عبر محركات Google، وتشخيص أسباب البطء، وتتبع مؤشرات Core Web Vitals بدقة.
          </p>
        </div>

        {/* URL Input Form */}
        <div className="perf-url-form-box">
          <div className="perf-url-presets" role="tablist" aria-label="نوع الصفحة المراد فحصها">
            <button
              type="button"
              role="tab"
              aria-selected={urlType === 'homepage'}
              className={`preset-tab ${urlType === 'homepage' ? 'active' : ''}`}
              onClick={() => handlePresetSelect('homepage')}
            >
              الصفحة الرئيسية (Homepage)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={urlType === 'custom'}
              className={`preset-tab ${urlType === 'custom' ? 'active' : ''}`}
              onClick={() => handlePresetSelect('custom')}
            >
              رابط مخصص (Custom URL)
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleStartScan(selectedStrategy, true);
            }}
            className="perf-url-input-row"
          >
            <div className="perf-input-wrapper">
              <Globe size={18} className="perf-input-icon" aria-hidden="true" />
              <input
                type="text"
                id="perf-store-url"
                aria-label="رابط المتجر المراد فحصه"
                placeholder="https://yourstore.salla.sa"
                value={storeUrlInput}
                onChange={(e) => {
                  setStoreUrlInput(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                disabled={isScanning || runTestMutation.isPending}
                className={`perf-url-input ${validationError ? 'has-error' : ''}`}
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={isScanning || runTestMutation.isPending || !storeUrlInput.trim()}
              className="btn btn-primary perf-scan-submit-btn"
              id="run-performance-test-btn"
            >
              {runTestMutation.isPending ? (
                <>
                  <Loader2 size={18} className="spin" aria-hidden="true" />
                  <span>جاري الفحص...</span>
                </>
              ) : (
                <>
                  <Play size={18} aria-hidden="true" />
                  <span>فحص أداء المتجر</span>
                </>
              )}
            </button>
          </form>

          {validationError && (
            <div className="perf-error-notice" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{validationError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Multi-step Status Progress Box (No fake percentage bars) */}
      {scanStep && (
        <div className="perf-scanning-status-card" role="status" aria-live="polite">
          <div className="status-header">
            <Loader2 size={20} className="spin text-primary" aria-hidden="true" />
            <h3 className="status-title">
              جاري فحص سرعة المتجر لنسخة {selectedStrategy === 'mobile' ? 'الجوال' : 'الكمبيوتر'}...
            </h3>
          </div>
          <p className="status-note">
            يتم فحص المتجر عبر محرك Lighthouse Lab Data الرسمي من Google لاستخراج درجات السرعة وتوصيات التحسين.
          </p>

          <div className="status-steps-list">
            <div className={`status-step ${scanStep === 'preparing' ? 'active' : 'done'}`}>
              <CheckCircle2 size={16} className="step-icon" />
              <span>التحقق من صحة الرابط والاتصال بنطاق المتجر</span>
            </div>
            <div className={`status-step ${scanStep === 'fetching' ? 'active' : scanStep === 'preparing' ? 'pending' : 'done'}`}>
              <div className="step-bullet" />
              <span>تشغيل محرك Lighthouse لقياس Core Web Vitals وتوليد التوصيات</span>
            </div>
            <div className="status-step pending">
              <div className="step-bullet" />
              <span>استرداد بيانات المستخدمين الواقعية من Chrome UX Report (CrUX)</span>
            </div>
          </div>
        </div>
      )}

      {/* Error state banner */}
      {runTestMutation.isError && (
        <div className="perf-scan-failed-banner" role="alert">
          <AlertCircle size={22} className="error-icon" aria-hidden="true" />
          <div className="error-content">
            <h4>تعذر إكمال فحص الأداء</h4>
            <p>
              {runTestMutation.error?.message ||
                'واجهت خدمة Google صعوبة في الوصول للمتجر. يرجى التأكد من أن المتجر متاح للعامة والمحاولة مرة أخرى.'}
            </p>
          </div>
          <div className="error-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsApiKeyModalOpen(true)}
            >
              <Key size={14} />
              <span>إدخال Google API Key</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleStartScan(selectedStrategy, true)}
            >
              <RotateCw size={14} />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        </div>
      )}

      {/* If Report is available */}
      {activeReport && currentDev && (
        <div className="perf-results-view">
          {/* Scan Comparison Banner */}
          <ScanComparisonBanner
            currentReport={activeReport}
            strategy={selectedStrategy}
          />

          {/* Overall Performance Hero Score Card */}
          <PerformanceScoreCard
            report={activeReport}
            selectedStrategy={selectedStrategy}
            onSelectStrategy={(strat) => setSelectedStrategy(strat)}
            isDesktopScanning={isDesktopScanning}
            isMobileScanning={isMobileScanning}
            onRunStrategy={(strat) => handleStartScan(strat, true)}
          />

          {/* Core Web Vitals Grid (Lab Data) */}
          <CoreWebVitalsGrid
            strategy={selectedStrategy}
            metrics={currentDev.metrics}
          />

          {/* Real User Experience Section (CrUX) */}
          <RealUserExperienceSection
            fieldData={activeReport.fieldData}
          />

          {/* Opportunities & Actionable Recommendations */}
          <OpportunitiesSection
            recommendations={currentDev.recommendations}
          />

          {/* Performance History Trend Chart */}
          <PerformanceTrendChart
            history={history}
            strategy={selectedStrategy}
            selectedDays={selectedDays}
            onDaysChange={(d) => setSelectedDays(d)}
          />

          {/* Footer Attribution */}
          <div className="perf-footer-attribution">
            <div className="attribution-item">
              <span>بيانات القياس المخبري مستخرجة بواسطة: </span>
              <strong>Google Lighthouse Engine v12+</strong>
            </div>
            <span className="sep">•</span>
            <div className="attribution-item">
              <span>بيانات المستخدمين الفعليين مستخرجة من: </span>
              <strong>Google Chrome UX Report (CrUX)</strong>
            </div>
          </div>
        </div>
      )}

      {/* Initial Empty State when no test has run yet */}
      {!activeReport && !scanStep && !runTestMutation.isError && (
        <div className="perf-initial-welcome-box">
          <div className="welcome-icon-circle">
            <Gauge size={36} aria-hidden="true" />
          </div>
          <h3>جاهز لفحص متجرك واكتشاف فرص التحسين؟</h3>
          <p>
            أدخل رابط متجرك في الأعلى واضغط على &quot;فحص أداء المتجر&quot; للحصول على تقرير متكامل يشمل:
          </p>

          <div className="welcome-features-grid">
            <div className="welcome-feat-item">
              <span className="feat-check">✓</span>
              <div>
                <strong>فحص سريع ومستقل للجوال والكمبيوتر</strong>
                <span>ظهور نتائج سريعة وتحديث تلقائي لجميع الأجهزة دون بطء.</span>
              </div>
            </div>
            <div className="welcome-feat-item">
              <span className="feat-check">✓</span>
              <div>
                <strong>مؤشرات Core Web Vitals المحدثة</strong>
                <span>فحص LCP, INP, CLS, FCP, TTFB بأحدث معايير Google.</span>
              </div>
            </div>
            <div className="welcome-feat-item">
              <span className="feat-check">✓</span>
              <div>
                <strong>توصيات دقيقة مع حجم التوفير الفعلي</strong>
                <span>اكتشاف الصور الضخمة، والسكريبتات المعطلة للعرض، بدون أرقام وهمية.</span>
              </div>
            </div>
            <div className="welcome-feat-item">
              <span className="feat-check">✓</span>
              <div>
                <strong>متابعة تطور الأداء عبر الزمن</strong>
                <span>مخططات بيانية وسجل تاريخي لتتبع سرعة المتجر قبل وبعد التعديلات.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Google API Key Configuration Modal */}
      <GoogleApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onKeySaved={(newKey) => setApiKey(newKey)}
      />
    </div>
  );
}
