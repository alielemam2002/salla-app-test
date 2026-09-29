import { useId, useState } from "react";
import { Link2, Plus } from "lucide-react";
import { Button, TextInput } from "../ui/index.js";
import { MEDIA_TEXT, isYoutubeUrl } from "../../utils/productMedia.js";

/**
 * Add a product video. Salla's Merchant API has no video file upload; it
 * only takes YouTube links (POST /products/{product}/video).
 */
export default function YoutubeVideoForm({ onAdd, isAdding }) {
  const inputId = useId();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(null);

  const submit = async () => {
    const trimmed = url.trim();
    if (!isYoutubeUrl(trimmed)) {
      setError(MEDIA_TEXT.youtubeInvalid);
      return;
    }
    setError(null);
    const ok = await onAdd(trimmed);
    if (ok) setUrl("");
  };

  return (
    <div className="form-group media-youtube">
      <label className="form-label" htmlFor={inputId}>
        {MEDIA_TEXT.youtubeLabel}
      </label>
      <div className="media-youtube-row">
        <TextInput
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${inputId}-msg`}
          type="url"
          dir="ltr"
          prefix={<Link2 size={14} aria-hidden="true" />}
          placeholder={MEDIA_TEXT.youtubePlaceholder}
          value={url}
          invalid={Boolean(error)}
          onChange={(event) => {
            setUrl(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button
          size="small"
          variant="secondary"
          icon={Plus}
          onClick={submit}
          disabled={!url.trim()}
          loading={isAdding}
        >
          {MEDIA_TEXT.youtubeAdd}
        </Button>
      </div>
      <span
        id={`${inputId}-msg`}
        className={error ? "form-error-msg" : "form-hint"}
        role={error ? "alert" : undefined}
      >
        {error || MEDIA_TEXT.youtubeHint}
      </span>
    </div>
  );
}
