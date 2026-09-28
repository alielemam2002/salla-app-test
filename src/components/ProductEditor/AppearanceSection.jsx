import { useState } from "react";
import {
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Save,
  Plus,
  Trash2,
  Check,
  Loader2,
  Sparkles,
} from "lucide-react";
import Button from "../forms/Button.jsx";

export default function AppearanceSection({
  register,
  sectionScore,
  images = [],
  onAddImage,
  onRemoveImage,
  onSetMainImage,
  onSaveSection,
  isSaving,
  isImageActionBusy,
}) {
  const [newImageUrl, setNewImageUrl] = useState("");

  const handleAdd = () => {
    const trimmed = newImageUrl.trim();
    if (!trimmed) return;
    onAddImage?.(trimmed);
    setNewImageUrl("");
  };

  return (
    <div className="editor-section-card" id="section-appearance">
      <div className="editor-section-header">
        <div className="section-header-title">
          <div className="section-header-icon">
            <ImageIcon size={18} />
          </div>
          <div>
            <h4 className="section-title">المظهر والصور</h4>
            <span className="section-desc">
              الصورة الرئيسية، صور المعرض، العنوان الترويجي، والعنوان الفرعي.
            </span>
          </div>
        </div>

        <div className="section-header-meta">
          <span
            className={`section-score-pill ${sectionScore?.isComplete ? "section-score-pill--done" : ""}`}
          >
            {sectionScore?.isComplete ? (
              <CheckCircle2 size={13} />
            ) : (
              <AlertCircle size={13} />
            )}
            {sectionScore?.currentScore || 0}/{sectionScore?.targetWeight || 15}%
          </span>

          <Button
            size="small"
            variant="secondary"
            onClick={onSaveSection}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 size={13} className="spin" /> : <Save size={13} />}
            حفظ المظهر
          </Button>
        </div>
      </div>

      <div className="editor-section-body">
        {/* Images Management */}
        <div className="form-group" id="field-images">
          <label className="form-label required">
            معرض صور المنتج (الأساسية والإضافية)
          </label>

          {/* Add Image URL bar */}
          <div className="add-image-bar">
            <input
              type="url"
              className="form-input add-image-input"
              placeholder="https://example.com/product-image.jpg"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button
              type="button"
              size="small"
              onClick={handleAdd}
              disabled={!newImageUrl.trim() || isImageActionBusy}
            >
              {isImageActionBusy ? (
                <Loader2 size={13} className="spin" />
              ) : (
                <Plus size={14} />
              )}
              إضافة صورة
            </Button>
          </div>

          {/* Images Grid */}
          <div className="editor-images-grid" id="field-images-additional">
            {images.length === 0 ? (
              <div className="editor-images-empty">
                <ImageIcon size={32} />
                <p>لا توجد صور لهذا المنتج بعد.</p>
                <span>أضف رابط صورة أعلاه لتعيينها كصورة أساسية.</span>
              </div>
            ) : (
              images.map((img, idx) => {
                const isMain = Boolean(
                  img.default || img.is_main || img.main || idx === 0,
                );
                const src = img.original || img.url;

                return (
                  <div
                    key={img.id || idx}
                    className={`editor-image-item ${isMain ? "editor-image-item--main" : ""}`}
                  >
                    <img
                      src={src}
                      alt={img.alt || `Product Image ${idx + 1}`}
                      className="editor-image-thumb"
                      onError={(e) => {
                        e.currentTarget.src =
                          "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22100%22%20height%3D%22100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20fill%3D%22%23333%22%20width%3D%22100%22%20height%3D%22100%22%2F%3E%3Ctext%20fill%3D%22%23999%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3EInvalid%20Img%3C%2Ftext%3E%3C%2Fsvg%3E";
                      }}
                    />

                    <div className="editor-image-overlay">
                      {isMain ? (
                        <span className="main-badge">
                          <Check size={11} /> رئيسية
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="action-btn make-main-btn"
                          onClick={() => onSetMainImage?.(idx)}
                          disabled={isImageActionBusy}
                          title="تعيين كصورة رئيسية"
                        >
                          تعيين كرئيسية
                        </button>
                      )}

                      <button
                        type="button"
                        className="action-btn delete-img-btn"
                        onClick={() => onRemoveImage?.(idx, img.id)}
                        disabled={isImageActionBusy}
                        title="حذف الصورة"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="form-row-2">
          {/* Promotional Title */}
          <div className="form-group" id="field-promotion_title">
            <label className="form-label">
              <Sparkles size={13} style={{ display: "inline" }} /> عنوان ترويجي (Promotion Title)
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="مثال: خصم 30% بمناسبة اليوم الوطني"
              {...register("promotion_title")}
            />
            <span className="form-hint">يظهر كشارة بارزة فوق بطاقة المنتج في المتجر.</span>
          </div>

          {/* Subtitle */}
          <div className="form-group" id="field-subtitle">
            <label className="form-label">عنوان فرعي (Subtitle)</label>
            <input
              type="text"
              className="form-input"
              placeholder="مثال: قطن مصري 100% عالي الجودة"
              {...register("subtitle")}
            />
            <span className="form-hint">نص توضيحي قصير أسفل اسم المنتج.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
