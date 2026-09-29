import { useState } from "react";
import {
  Sparkles,
  RotateCw,
  Check,
  Copy,
  Search,
  FileText,
  Tag,
  Wand2,
  AlertCircle,
  ExternalLink,
  MessageSquareHeart,
  Briefcase,
  Crown,
} from "lucide-react";
import { Button, Modal } from "../ui/index.js";
import { generateAiProductContent } from "../../utils/aiCopilotApi.js";

const TONES = [
  {
    id: "saudi_commercial",
    label: "لهجة سعودية بيضاء",
    icon: MessageSquareHeart,
    desc: "حماسية وجذابة وقريبة لذوق المتسوق السعودي والخليجي",
  },
  {
    id: "formal_commercial",
    label: "فصحى تجارية أنيقة",
    icon: Briefcase,
    desc: "لغة عربية تسويقية احترافية ومناسبة لكافة المتاجر",
  },
  {
    id: "luxury",
    label: "فخامة ومختصرة",
    icon: Crown,
    desc: "أسلوب راقٍ وموجز للعطور والمجوهرات والبراندات الفاخرة",
  },
];

export default function AiCopilotModal({
  isOpen,
  onClose,
  product,
  productName,
  currentDescription,
  categoryName,
  onApply,
  showToast,
}) {
  const [tone, setTone] = useState("saudi_commercial");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState(null);
  const [activeTab, setActiveTab] = useState("description"); // "description" | "seo" | "tags"
  const [error, setError] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  const prodName = product?.name || productName || "";
  const prodCategory = product?.categoryName || categoryName || "";
  const prodDesc = product?.description || currentDescription || "";
  const prodPrice = product?.price || "";
  const prodCurrency = product?.currency || "ر.س";
  const prodBrand = product?.brandName || "";

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateAiProductContent({
        product: {
          name: prodName,
          category: prodCategory,
          price: prodPrice,
          currency: prodCurrency,
          brand: prodBrand,
          current_description: prodDesc,
        },
        tone,
      });

      setGeneratedData(result);
      showToast?.("تم توليد المحتوى التسويقي والسيو بنجاح!", "success");
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء الاتصال بالذكاء الاصطناعي");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyAll = () => {
    if (!generatedData) return;
    onApply?.(generatedData);
    showToast?.("تم تطبيق المحتوى الذكي على بيانات المنتج بنجاح!", "success");
    onClose();
  };

  const handleCopyText = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="مساعد كتابة المنتجات وتهيئة الـ SEO بالذكاء الاصطناعي"
      subtitle={`توليد وصف تسويقي مهيكل وعناوين سيو ووسوم لـ: ${prodName || "المنتج"}`}
      icon={Sparkles}
      size="lg"
      dir="rtl"
      footer={
        <div className="ai-modal-footer">
          <Button variant="ghost" onClick={onClose} disabled={isGenerating}>
            إلغاء
          </Button>

          {generatedData ? (
            <div className="ai-modal-footer-actions">
              <Button
                variant="secondary"
                icon={RotateCw}
                onClick={handleGenerate}
                loading={isGenerating}
              >
                إعادة التوليد
              </Button>
              <Button
                variant="primary"
                icon={Check}
                onClick={handleApplyAll}
              >
                تطبيق الكل على المنتج
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              icon={Wand2}
              onClick={handleGenerate}
              loading={isGenerating}
            >
              بدء التوليد السحري
            </Button>
          )}
        </div>
      }
    >
      <div className="ai-copilot-content">
        {/* Tone Selector */}
        <section className="ai-section">
          <h4 className="ai-section-title">اختر نبرة الصوت التسويقية (Tone of Voice):</h4>
          <div className="ai-tones-grid">
            {TONES.map((t) => {
              const ToneIcon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`ai-tone-card ${tone === t.id ? "ai-tone-card--active" : ""}`}
                  onClick={() => setTone(t.id)}
                  disabled={isGenerating}
                >
                  <div className="ai-tone-icon">
                    <ToneIcon size={20} aria-hidden="true" />
                  </div>
                  <div className="ai-tone-info">
                    <span className="ai-tone-label">{t.label}</span>
                    <span className="ai-tone-desc">{t.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {error && (
          <div className="ai-error-banner" role="alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {isGenerating && (
          <div className="ai-loading-state">
            <div className="ai-spinner">
              <Sparkles className="ai-sparkle-spin" size={28} />
            </div>
            <p className="ai-loading-text">
              يقوم الذكاء الاصطناعي بصياغة أفضل وصف تسويقي وضبط معايير السيو لمتجرك...
            </p>
          </div>
        )}

        {/* Results Preview */}
        {!isGenerating && generatedData && (
          <div className="ai-results-container">
            <div className="ai-tabs-nav" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "description"}
                className={`ai-tab-btn ${activeTab === "description" ? "ai-tab-btn--active" : ""}`}
                onClick={() => setActiveTab("description")}
              >
                <FileText size={15} />
                الوصف التسويقي
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "seo"}
                className={`ai-tab-btn ${activeTab === "seo" ? "ai-tab-btn--active" : ""}`}
                onClick={() => setActiveTab("seo")}
              >
                <Search size={15} />
                محاكي سيو Google
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "tags"}
                className={`ai-tab-btn ${activeTab === "tags" ? "ai-tab-btn--active" : ""}`}
                onClick={() => setActiveTab("tags")}
              >
                <Tag size={15} />
                الوسوم والكلمات المفتاحية
              </button>
            </div>

            {/* Tab 1: Marketing Description & Promo Badges */}
            {activeTab === "description" && (
              <div className="ai-tab-content">
                {generatedData.promotion_title && (
                  <div className="ai-result-block ai-result-block--promo">
                    <div className="ai-result-header">
                      <span className="ai-result-title">
                        العنوان الترويجي (Promotion Title) - شارة المنتج:
                      </span>
                      <Button
                        size="small"
                        variant="ghost"
                        icon={copiedKey === "promo" ? Check : Copy}
                        onClick={() =>
                          handleCopyText(generatedData.promotion_title, "promo")
                        }
                      >
                        {copiedKey === "promo" ? "تم النسخ" : "نسخ"}
                      </Button>
                    </div>
                    <div className="ai-promo-preview">
                      <span className="ai-promo-badge">
                        {generatedData.promotion_title}
                      </span>
                      <span className="ai-promo-hint">
                        يظهر كشارة بارزة فوق بطاقة المنتج في المتجر
                      </span>
                    </div>
                  </div>
                )}

                {(generatedData.subtitle || generatedData.short_description) && (
                  <div className="ai-result-block ai-result-block--secondary">
                    <div className="ai-result-header">
                      <span className="ai-result-title">العنوان الفرعي (Subtitle):</span>
                      <Button
                        size="small"
                        variant="ghost"
                        icon={copiedKey === "sub" ? Check : Copy}
                        onClick={() =>
                          handleCopyText(
                            generatedData.subtitle || generatedData.short_description,
                            "sub",
                          )
                        }
                      >
                        {copiedKey === "sub" ? "تم النسخ" : "نسخ"}
                      </Button>
                    </div>
                    <p className="ai-short-description-text">
                      {generatedData.subtitle || generatedData.short_description}
                    </p>
                  </div>
                )}

                <div className="ai-result-block">
                  <div className="ai-result-header">
                    <span className="ai-result-title">الوصف التسويقي (HTML):</span>
                    <Button
                      size="small"
                      variant="ghost"
                      icon={copiedKey === "desc" ? Check : Copy}
                      onClick={() =>
                        handleCopyText(generatedData.marketing_description, "desc")
                      }
                    >
                      {copiedKey === "desc" ? "تم النسخ" : "نسخ"}
                    </Button>
                  </div>
                  <div
                    className="ai-rendered-description"
                    dangerouslySetInnerHTML={{
                      __html: generatedData.marketing_description,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Tab 2: SEO Google Preview */}
            {activeTab === "seo" && (
              <div className="ai-tab-content">
                <div className="ai-serp-preview-box">
                  <div className="ai-serp-header">
                    <span className="ai-serp-badge">معاينة نتيجة البحث في Google</span>
                  </div>
                  <div className="ai-serp-snippet">
                    <div className="ai-serp-url" dir="ltr">
                      https://store.sa › products › {generatedData.seo_slug || "product"}
                    </div>
                    <div className="ai-serp-title">
                      {generatedData.meta_title}
                    </div>
                    <div className="ai-serp-desc">
                      {generatedData.meta_description}
                    </div>
                  </div>
                </div>

                <div className="ai-seo-field-details">
                  <div className="ai-field-card">
                    <div className="ai-field-card-header">
                      <span>عنوان الـ SEO (Meta Title)</span>
                      <span className="ai-char-badge ai-char-badge--ok">
                        {generatedData.meta_title.length} / 60 حرفاً
                      </span>
                    </div>
                    <p className="ai-field-text">{generatedData.meta_title}</p>
                  </div>

                  <div className="ai-field-card">
                    <div className="ai-field-card-header">
                      <span>وصف الـ SEO (Meta Description)</span>
                      <span className="ai-char-badge ai-char-badge--ok">
                        {generatedData.meta_description.length} / 155 حرفاً
                      </span>
                    </div>
                    <p className="ai-field-text">{generatedData.meta_description}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Tags */}
            {activeTab === "tags" && (
              <div className="ai-tab-content">
                <div className="ai-result-block">
                  <div className="ai-result-header">
                    <span className="ai-result-title">
                      الكلمات المفتاحية المقترحة ({generatedData.tags?.length || 0}):
                    </span>
                    <Button
                      size="small"
                      variant="ghost"
                      icon={copiedKey === "tags" ? Check : Copy}
                      onClick={() =>
                        handleCopyText(generatedData.tags?.join(", "), "tags")
                      }
                    >
                      {copiedKey === "tags" ? "تم النسخ" : "نسخ الكل"}
                    </Button>
                  </div>
                  <div className="ai-tags-list">
                    {generatedData.tags?.map((tag, idx) => (
                      <span key={idx} className="ai-tag-chip">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {generatedData.seo_slug && (
                  <div className="ai-result-block ai-result-block--secondary">
                    <span className="ai-result-title">رابط المنتج المقترح (Slug):</span>
                    <code className="ai-slug-code" dir="ltr">
                      /{generatedData.seo_slug}
                    </code>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
