import React, { useState, useEffect, useCallback } from 'react';
import {
  Gauge,
  Play,
  RotateCw,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Globe,
  Smartphone,
  Monitor,
  Info,
  Layers
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

  // Auto-detect default store URL from Salla
  const { data: defaultStoreUrl, isLoading: isLoadingStoreUrl } = useStoreDefaultUrl(token, appId);

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

  const handleStartScan = useCallback(async () => {
    setValidationError(null);

    const validation = validateStoreUrl(storeUrlInput);
    if (!validation.isValid) {
      setValidationError(validation.error);
      return;
    }

    const targetUrl = validation.normalizedUrl;
    setStoreUrlInput(targetUrl);

    setScanStep('preparing');

    try {
      const report = await runTestMutation.mutateAsync({
        url: targetUrl,
        onProgressStep: (step) => setScanStep(step)
      });
      setActiveReport(report);
      setScanStep(null);
    } catch (err) {
      setScanStep(null);
    }
  }, [storeUrlInput, runTestMutation]);

  const handlePresetSelect = (type) => {
    setUrlType(type);
    if (type === 'homepage' && defaultStoreUrl) {
      setStoreUrlInput(defaultStoreUrl);
      setValidationError(null);
    }
  };

  const isScanning = runTestMutation.isPending;
  const currentDev = activeReport ? activeReport[selectedStrategy] : null;

  return (
    <div className="perf-center-container" role="main" aria-label="مركز أداء المتجر">
      {/* Top Banner & Header */}
      <div className="perf-header-panel">
        <div className="perf-header-info">
          <div className="perf-badge-label">
            <Gauge size={16} aria-hidden="true" />
            <span>Google PageSpeed &amp; CrUX Intelligence</span>
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
              handleStartScan();
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
                disabled={isScanning}
                className={`perf-url-input ${validationError ? 'has-error' : ''}`}
                dir="ltr"
              />
            </div>

            <button
              type="submit"
              disabled={isScanning || !storeUrlInput.trim()}
              className="btn btn-primary perf-scan-submit-btn"
              id="run-performance-test-btn"
            >
              {isScanning ? (
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
      {isScanning && (
        <div className="perf-scanning-status-card" role="status" aria-live="polite">
          <div className="status-header">
            <Loader2 size={20} className="spin text-primary" aria-hidden="true" />
            <h3 className="status-title">جاري فحص سرعة المتجر عبر خوادم Google...</h3>
          </div>
          <p className="status-note">
            قد يستغرق الفحص الكامل لبيئات الجوال والكمبيوتر من 10 إلى 25 ثانية لقياس مؤشرات Lighthouse واستخراج توصيات التحسين.
          </p>

          <div className="status-steps-list">
            <div className={`status-step ${scanStep === 'preparing' ? 'active' : 'done'}`}>
              <CheckCircle2 size={16} className="step-icon" />
              <span>التحقق من صحة الرابط والاتصال بنطاق المتجر</span>
            </div>
            <div className={`status-step ${scanStep === 'fetching' ? 'active' : scanStep === 'preparing' ? 'pending' : 'done'}`}>
              <div className="step-bullet" />
              <span>تشغيل محرك Lighthouse Lab Data لأجهزة الجوال والكمبيوتر</span>
            </div>
            <div className="status-step pending">
              <div className="step-bullet" />
              <span>استرداد بيانات المستخدمين الواقعية من Chrome UX Report (CrUX)</span>
            </div>
            <div className="status-step pending">
              <div className="step-bullet" />
              <span>توليد التوصيات وفرص توفير الحجم والوقت</span>
            </div>
          </div>
        </div>
      )}

      {/* Error state if mutation failed */}
      {runTestMutation.isError && (
        <div className="perf-scan-failed-banner" role="alert">
          <AlertCircle size={22} className="error-icon" aria-hidden="true" />
          <div className="error-content">
            <h4>تعذر إكمال فحص الأداء</h4>
            <p>
              {runTestMutation.error?.message ||
                'واجهت خدمة Google PageSpeed صعوبة في الوصول للمتجر. يرجى التأكد من أن المتجر متاح للعامة والمحاولة مرة أخرى.'}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleStartScan}
          >
            <RotateCw size={14} />
            <span>إعادة المحاولة</span>
          </button>
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
      {!activeReport && !isScanning && !runTestMutation.isError && (
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
                <strong>نقاط الأداء الرسمية من Google</strong>
                <span>تقييم موضوعي مبني على سرعة استجابة المتجر واستقراره.</span>
              </div>
            </div>
            <div className="welcome-feat-item">
              <span className="feat-check">✓</span>
              <div>
                <strong>مؤشرات Core Web Vitals المحدثة</strong>
                <span>فحص LCP, INP, CLS, FCP, TTFB لكل من الجوال والكمبيوتر.</span>
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
    </div>
  );
}
