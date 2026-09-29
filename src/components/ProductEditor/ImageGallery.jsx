import { useState } from "react";
import {
  Check,
  Image as ImageIcon,
  Link2,
  Plus,
  Star,
  Trash2,
  Youtube,
} from "lucide-react";
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  TextInput,
} from "../ui/index.js";

const BROKEN_IMAGE =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22100%22%20height%3D%22100%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20fill%3D%22%23333%22%20width%3D%22100%22%20height%3D%22100%22%2F%3E%3Ctext%20fill%3D%22%23999%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%20dy%3D%22.3em%22%3EInvalid%20Img%3C%2Ftext%3E%3C%2Fsvg%3E";

/** URL input + image grid with "set as main" and delete actions. */
export default function ImageGallery({
  images = [],
  onAdd,
  onRemove,
  onSetMain,
  isBusy,
  inputId,
}) {
  const [url, setUrl] = useState("");
  // { index, image } waiting for the merchant to confirm the delete.
  const [pendingDelete, setPendingDelete] = useState(null);
  const pendingIsVideo = pendingDelete?.image?.type === "video";

  const add = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    onAdd?.(trimmed);
    setUrl("");
  };

  return (
    <div className="image-gallery">
      <div className="image-gallery-add">
        <TextInput
          id={inputId}
          type="url"
          dir="ltr"
          prefix={<Link2 size={14} aria-hidden="true" />}
          placeholder="https://example.com/product-image.jpg"
          aria-label="رابط صورة جديدة"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button
          size="small"
          variant="primary"
          icon={Plus}
          onClick={add}
          disabled={!url.trim()}
          loading={isBusy}
        >
          إضافة صورة
        </Button>
      </div>

      <div id="field-images-additional">
        {images.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            className="image-gallery-empty"
            title="لا توجد صور أو فيديوهات لهذا المنتج."
            description="أضف أول صورة للمنتج برابط أعلاه، أو ارفع الملفات من إدارة الوسائط أدناه."
          />
        ) : (
          <ul className="image-gallery-grid">
            {images.map((img, idx) => {
              const isVideo = img.type === "video";
              const isMain = Boolean(
                img.default || img.is_main || img.main || idx === 0,
              );
              return (
                <li
                  key={img.id || idx}
                  className={`image-tile ${isMain ? "image-tile--main" : ""}`}
                >
                  <img
                    src={img.original || img.url}
                    alt={img.alt || `Product Image ${idx + 1}`}
                    className="image-tile-thumb"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.src = BROKEN_IMAGE;
                    }}
                  />
                  {isVideo && (
                    <span className="image-tile-video">
                      <Youtube size={12} aria-hidden="true" /> فيديو
                    </span>
                  )}
                  {isMain && (
                    <span className="image-tile-badge">
                      <Check size={11} aria-hidden="true" /> رئيسية
                    </span>
                  )}
                  <div className="image-tile-actions">
                    {!isMain && !isVideo && (
                      <IconButton
                        icon={Star}
                        label="تعيين كصورة رئيسية"
                        tone="primary"
                        size={14}
                        onClick={() => onSetMain?.(idx)}
                        disabled={isBusy}
                      />
                    )}
                    <IconButton
                      icon={Trash2}
                      label={isVideo ? "حذف الفيديو" : "حذف الصورة"}
                      tone="danger"
                      size={14}
                      onClick={() =>
                        setPendingDelete({ index: idx, image: img })
                      }
                      disabled={isBusy}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          onRemove?.(pendingDelete.index, pendingDelete.image.id);
          setPendingDelete(null);
        }}
        title={pendingIsVideo ? "حذف الفيديو" : "حذف الصورة"}
        confirmText="تأكيد"
        cancelText="إلغاء"
      >
        <p>
          {pendingIsVideo
            ? "هل أنت متأكد من حذف هذا الفيديو؟"
            : "هل أنت متأكد من حذف هذه الصورة؟"}
          {pendingDelete?.image?.id ? " سيُحذف من سلة مباشرة." : ""}
        </p>
      </ConfirmDialog>
    </div>
  );
}
