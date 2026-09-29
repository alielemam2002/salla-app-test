import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "../ui/index.js";
import {
  MAX_UPLOAD_BYTES,
  MEDIA_TEXT,
  formatBytes,
} from "../../utils/productMedia.js";

/** Drag & drop area + file picker. Hands the picked FileList to `onFiles`. */
export default function MediaDropzone({ onFiles, disabled, disabledReason }) {
  const inputRef = useRef(null);
  const [isOver, setIsOver] = useState(false);

  const handleDrop = (event) => {
    event.preventDefault();
    setIsOver(false);
    if (!disabled && event.dataTransfer?.files?.length) {
      onFiles(event.dataTransfer.files);
    }
  };

  return (
    <div
      className={`media-dropzone${isOver ? " media-dropzone--over" : ""}${
        disabled ? " media-dropzone--disabled" : ""
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={handleDrop}
    >
      <UploadCloud
        size={28}
        aria-hidden="true"
        className="media-dropzone-icon"
      />
      <p className="media-dropzone-title">{MEDIA_TEXT.dropTitle}</p>
      <p className="media-dropzone-or">{MEDIA_TEXT.dropOr}</p>
      <Button
        size="small"
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        {MEDIA_TEXT.choose}
      </Button>
      <p className="media-dropzone-hint">
        {disabled && disabledReason
          ? disabledReason
          : MEDIA_TEXT.dropHint(formatBytes(MAX_UPLOAD_BYTES))}
      </p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="media-dropzone-input"
        aria-label={MEDIA_TEXT.choose}
        tabIndex={-1}
        onChange={(event) => {
          if (event.target.files?.length) onFiles(event.target.files);
          // Allow picking the same file again after removing it.
          event.target.value = "";
        }}
      />
    </div>
  );
}
