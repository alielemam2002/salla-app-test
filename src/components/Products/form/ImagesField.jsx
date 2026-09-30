import { useState } from "react";
import {
  Check,
  Image as ImageIcon,
  ImageOff,
  Plus,
  Trash2,
} from "lucide-react";
import {
  Button,
  EmptyState,
  IconButton,
  TextInput,
  cx,
} from "../../ui/index.js";

function ImageCard({ image, index, onSetMain, onRemove }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={cx(
        "product-image-card",
        image.default && "product-image-card--default",
      )}
    >
      {failed ? (
        <div className="product-image-broken">
          <ImageOff size={20} aria-hidden="true" />
          <span>صورة غير صالحة</span>
        </div>
      ) : (
        <img
          src={image.original}
          alt={image.alt || `صورة المنتج ${index + 1}`}
          className="product-image-preview"
          onError={() => setFailed(true)}
        />
      )}
      {image.default && (
        <span className="product-image-badge">
          <Check size={12} aria-hidden="true" /> رئيسية
        </span>
      )}
      <div className="product-image-overlay">
        {!image.default && (
          <button
            type="button"
            className="product-image-btn"
            onClick={() => onSetMain(index)}
            title="تعيين كصورة رئيسية"
          >
            تعيين كرئيسية
          </button>
        )}
        <IconButton
          icon={Trash2}
          size={14}
          label="حذف الصورة"
          className="product-image-btn--delete"
          onClick={() => onRemove(index)}
        />
      </div>
    </div>
  );
}

/** URL input plus a grid of image cards (first = main). */
export default function ImagesField({
  images,
  urlInput,
  setUrlInput,
  onAdd,
  onRemove,
  onSetMain,
  disabled,
}) {
  return (
    <>
      <div className="form-group">
        <label className="form-label" htmlFor="product-image-url">
          إضافة صورة برابط مباشر
        </label>
        <div className="image-input-group">
          <TextInput
            id="product-image-url"
            aria-describedby="product-image-url-hint"
            type="url"
            dir="ltr"
            placeholder="https://example.com/product-image.jpg"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
            disabled={disabled}
          />
          <Button
            variant="primary"
            icon={Plus}
            onClick={onAdd}
            disabled={!urlInput.trim() || disabled}
          >
            إضافة الصورة
          </Button>
        </div>
        <span id="product-image-url-hint" className="form-hint">
          أدخل رابطًا مباشرًا وعامًا للصورة (JPEG أو PNG أو WebP). تشترط سلة
          وجود صورة واحدة على الأقل لتفعيل المنتج (حالة نشط).
        </span>
      </div>

      {images.length === 0 ? (
        <EmptyState
          className="product-images-empty"
          icon={ImageIcon}
          title="لم تتم إضافة صور بعد."
          description="أضف روابط الصور من الحقل أعلاه."
        />
      ) : (
        <div className="product-images-grid">
          {images.map((img, idx) => (
            <ImageCard
              key={`${img.original}-${idx}`}
              image={img}
              index={idx}
              onSetMain={onSetMain}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </>
  );
}
