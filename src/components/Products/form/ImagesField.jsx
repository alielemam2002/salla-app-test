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
          <span>Invalid image</span>
        </div>
      ) : (
        <img
          src={image.original}
          alt={image.alt || `Product image ${index + 1}`}
          className="product-image-preview"
          onError={() => setFailed(true)}
        />
      )}
      {image.default && (
        <span className="product-image-badge">
          <Check size={12} aria-hidden="true" /> Main
        </span>
      )}
      <div className="product-image-overlay">
        {!image.default && (
          <button
            type="button"
            className="product-image-btn"
            onClick={() => onSetMain(index)}
            title="Set as main thumbnail"
          >
            Make Main
          </button>
        )}
        <IconButton
          icon={Trash2}
          size={14}
          label="Remove image"
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
          Add Image via Direct URL
        </label>
        <div className="image-input-group">
          <TextInput
            id="product-image-url"
            aria-describedby="product-image-url-hint"
            type="url"
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
            Add Image
          </Button>
        </div>
        <span id="product-image-url-hint" className="form-hint">
          Enter direct public image URLs (JPEG, PNG, WebP). Salla requires at
          least one image to set product status to Active.
        </span>
      </div>

      {images.length === 0 ? (
        <EmptyState
          className="product-images-empty"
          icon={ImageIcon}
          title="No images added yet."
          description="Add image URLs above."
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
