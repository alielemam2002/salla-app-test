import { useState } from "react";
import {
  Camera,
  Check,
  CheckCircle2,
  Download,
  Eye,
  Loader2,
  RefreshCw,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { Modal, Button } from "../ui/index.js";
import {
  STUDIO_STYLE_PRESETS,
  generateStudioPhotos,
  uploadStudioImageToSalla,
} from "../../utils/aiPhotoStudioApi.js";

export default function AiPhotoStudioModal({
  isOpen,
  onClose,
  product,
  token,
  productId,
  onImagesUploaded,
  showToast,
}) {
  const [selectedStyle, setSelectedStyle] = useState("marble_studio");
  const [customDetails, setCustomDetails] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [photos, setPhotos] = useState(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [error, setError] = useState(null);

  const productName = product?.name || "المنتج";

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setPhotos(null);
    setSelectedPhotoIds(new Set());

    try {
      const data = await generateStudioPhotos({
        product: {
          name: productName,
          category: product?.categoryName || product?.category || "",
          brand: product?.brandName || product?.brand || "",
          description: product?.description || "",
        },
        style: selectedStyle,
        customDetails: customDetails.trim(),
      });

      setPhotos(data.photos || []);
      // Select all 4 generated photos by default
      if (Array.isArray(data.photos)) {
        setSelectedPhotoIds(new Set(data.photos.map((p) => p.id)));
      }
      showToast?.("تمت جلسة التصوير وتوليد 4 لقطات استوديو بنجاح! 📸", "success");
    } catch (err) {
      setError(err.message || "تعذر إكمال جلسة التصوير بالذكاء الاصطناعي.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSelectPhoto = (id) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!photos) return;
    if (selectedPhotoIds.size === photos.length) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(photos.map((p) => p.id)));
    }
  };

  const handleUploadSelectedToSalla = async () => {
    if (!photos || selectedPhotoIds.size === 0) return;
    const selectedPhotos = photos.filter((p) => selectedPhotoIds.has(p.id));

    setIsUploading(true);
    setUploadProgress({ current: 0, total: selectedPhotos.length });

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < selectedPhotos.length; i++) {
      const p = selectedPhotos[i];
      setUploadProgress({ current: i + 1, total: selectedPhotos.length });

      try {
        const res = await uploadStudioImageToSalla({
          token,
          productId,
          imageUrl: p.url,
          title: `${productName} - ${p.title}`,
        });

        if (res.success) {
          succeeded++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    setIsUploading(false);
    setUploadProgress(null);

    if (succeeded > 0) {
      showToast?.(
        `تم رفع ${succeeded} صور بنجاح إلى معرض صور المنتج في سلة! 🎉`,
        "success",
      );
      onImagesUploaded?.();
      onClose();
    } else {
      showToast?.("تعذر رفع الصور إلى سلة، يرجى المحاولة لاحقاً.", "error");
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="استوديو تصوير المنتجات بالذكاء الاصطناعي (مجاني)"
        subtitle={`جلسة تصوير فوتوغرافي تجاري لـ: ${productName}`}
        icon={Camera}
        size="lg"
        dir="rtl"
        footer={
          <div className="studio-modal-footer">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isGenerating || isUploading}
            >
              إلغاء
            </Button>

            {!photos ? (
              <Button
                variant="primary"
                icon={Sparkles}
                onClick={handleGenerate}
                loading={isGenerating}
              >
                بدء جلسة التصوير الفوتوغرافي 📸
              </Button>
            ) : (
              <div className="studio-footer-actions">
                <Button
                  variant="secondary"
                  icon={RefreshCw}
                  onClick={handleGenerate}
                  disabled={isGenerating || isUploading}
                >
                  إعادة جلسة التصوير
                </Button>
                <Button
                  variant="primary"
                  icon={UploadCloud}
                  onClick={handleUploadSelectedToSalla}
                  loading={isUploading}
                  disabled={selectedPhotoIds.size === 0}
                >
                  {isUploading
                    ? `جارِ الرفع (${uploadProgress?.current || 1}/${uploadProgress?.total || selectedPhotoIds.size})...`
                    : `رفع الصور المختارة لسلة (${selectedPhotoIds.size}) 🚀`}
                </Button>
              </div>
            )}
          </div>
        }
      >
        <div className="studio-modal-content">
          {/* Preset Styles Selector */}
          <section className="studio-section">
            <div className="studio-section-header">
              <h4 className="studio-section-title">اختر نمط جلسة التصوير:</h4>
              <span className="studio-section-subtitle">
                توليد إضاءة استوديو وظلال واقعية تناسب المتجر
              </span>
            </div>

            <div className="studio-presets-grid">
              {STUDIO_STYLE_PRESETS.map((preset) => {
                const isSelected = selectedStyle === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`studio-preset-card ${isSelected ? "studio-preset-card--active" : ""}`}
                    onClick={() => setSelectedStyle(preset.id)}
                    disabled={isGenerating || isUploading}
                  >
                    <div className="studio-preset-header">
                      <span className="studio-preset-icon">{preset.icon}</span>
                      <span className="studio-preset-badge">{preset.badge}</span>
                    </div>
                    <strong className="studio-preset-name">{preset.title}</strong>
                    <p className="studio-preset-desc">{preset.description}</p>
                    {isSelected && (
                      <span className="studio-preset-checked">
                        <Check size={14} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="studio-custom-row">
              <input
                type="text"
                className="form-input studio-custom-input"
                placeholder="تفاصيل إضافية مخصصة (مثال: أزهار وردية على اليمين، خلفية رخام رمادي داكن...)"
                value={customDetails}
                onChange={(e) => setCustomDetails(e.target.value)}
                disabled={isGenerating || isUploading}
              />
            </div>
          </section>

          {/* Error Banner */}
          {error && (
            <div className="ai-error-banner" role="alert">
              <span>{error}</span>
            </div>
          )}

          {/* Loading State */}
          {isGenerating && (
            <div className="studio-loading-state">
              <div className="studio-camera-spinner">
                <Camera size={32} className="studio-pulse" />
              </div>
              <div className="studio-loading-text-group">
                <strong className="studio-loading-title">
                  جارِ التصوير والمحاكاة بالذكاء الاصطناعي...
                </strong>
                <p className="studio-loading-subtitle">
                  توزيع إضاءة الاستوديو ومحاكاة خامات الرخام والظلال بدقة 8K فائقة
                  الواقعية.
                </p>
              </div>
            </div>
          )}

          {/* Photos Results Grid */}
          {!isGenerating && photos && photos.length > 0 && (
            <section className="studio-results-section">
              <div className="studio-results-header">
                <div className="studio-results-title-wrap">
                  <h4 className="studio-results-title">
                    نتائج جلسة التصوير (4 لقطات فوتوغرافية):
                  </h4>
                  <span className="studio-results-subtitle">
                    اضغط على أي صورة لتحديدها أو استبعادها من الرفع لسلة
                  </span>
                </div>
                <button
                  type="button"
                  className="studio-select-all-btn"
                  onClick={toggleSelectAll}
                >
                  {selectedPhotoIds.size === photos.length
                    ? "إلغاء تحديد الكل"
                    : "تحديد الكل"}
                </button>
              </div>

              <div className="studio-photos-grid">
                {photos.map((photo) => {
                  const isSelected = selectedPhotoIds.has(photo.id);
                  return (
                    <div
                      key={photo.id}
                      className={`studio-photo-card ${isSelected ? "studio-photo-card--selected" : ""}`}
                      onClick={() => toggleSelectPhoto(photo.id)}
                    >
                      <div className="studio-photo-image-wrap">
                        <img
                          src={photo.url}
                          alt={photo.title}
                          className="studio-photo-image"
                          loading="lazy"
                        />
                        <div className="studio-photo-overlay">
                          <button
                            type="button"
                            className="studio-action-btn"
                            title="تكبير ومعاينة الصورة"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewPhoto(photo);
                            }}
                          >
                            <Eye size={16} />
                          </button>
                          <a
                            href={photo.url}
                            target="_blank"
                            rel="noreferrer"
                            download={`${productName}.jpg`}
                            className="studio-action-btn"
                            title="تنزيل الصورة بجودة عالية"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download size={16} />
                          </a>
                        </div>
                        <div className="studio-select-indicator">
                          {isSelected ? (
                            <CheckCircle2 size={22} className="indicator-checked" />
                          ) : (
                            <div className="indicator-empty" />
                          )}
                        </div>
                      </div>
                      <div className="studio-photo-meta">
                        <span className="studio-photo-title">{photo.title}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </Modal>

      {/* Fullscreen Photo Lightbox Modal */}
      {previewPhoto && (
        <div
          className="studio-lightbox-backdrop"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="studio-lightbox-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="studio-lightbox-header">
              <span className="studio-lightbox-title">
                {previewPhoto.title}
              </span>
              <button
                type="button"
                className="studio-lightbox-close"
                onClick={() => setPreviewPhoto(null)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="studio-lightbox-body">
              <img
                src={previewPhoto.url}
                alt={previewPhoto.title}
                className="studio-lightbox-img"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
