import { Film, Sparkles } from "lucide-react";
import { useMediaUploadQueue } from "../../hooks/productEditor/useMediaUploadQueue.js";
import { useAiImageStudio } from "../../hooks/productEditor/useAiImageStudio.js";
import { useDisclosure } from "../../hooks/ui/useDisclosure.js";
import { MEDIA_TEXT } from "../../utils/productMedia.js";
import { AI_TEXT } from "../../utils/aiImageStudio.js";
import { Button } from "../ui/index.js";
import AiImageStudio from "./AiImageStudio.jsx";
import MediaDropzone from "./MediaDropzone.jsx";
import MediaUploadQueue from "./MediaUploadQueue.jsx";
import YoutubeVideoForm from "./YoutubeVideoForm.jsx";

/**
 * "إدارة الوسائط" block of the Appearance section: bulk image upload for
 * the current product, the AI image studio, and YouTube videos. The
 * product's current media is the gallery just above it. Every file goes to
 * this product; there's no product picker or mapping.
 */
export default function MediaManager({
  productId,
  token,
  images,
  altText,
  onMediaChanged,
  onAddVideo,
  isAddingVideo,
}) {
  const queue = useMediaUploadQueue({
    token,
    productId,
    existingImages: images,
    altText,
    onBatchDone: onMediaChanged,
  });
  const studio = useAiImageStudio({
    token,
    productId,
    existingImages: images,
    altText,
    onAttached: onMediaChanged,
  });
  const studioDialog = useDisclosure();

  const full = queue.slotsLeft === 0 && !queue.running;

  return (
    <div id="field-media" className="media-manager">
      <div className="media-manager-head">
        <div>
          <h4 className="media-manager-title">
            <Film size={16} aria-hidden="true" />
            {MEDIA_TEXT.sectionTitle}
          </h4>
          <p className="media-manager-hint">{MEDIA_TEXT.sectionHint}</p>
        </div>
        <Button
          size="small"
          variant="secondary"
          icon={Sparkles}
          className="editor-ai-btn"
          onClick={() => studioDialog.open()}
        >
          {AI_TEXT.open}
        </Button>
      </div>

      <MediaDropzone
        onFiles={queue.addFiles}
        disabled={queue.running || full}
        disabledReason={full ? MEDIA_TEXT.full : null}
      />

      <MediaUploadQueue queue={queue} />

      <YoutubeVideoForm onAdd={onAddVideo} isAdding={isAddingVideo} />

      <AiImageStudio
        isOpen={studioDialog.isOpen}
        onClose={studioDialog.close}
        studio={studio}
        images={images}
        defaultPrompt={altText}
      />
    </div>
  );
}
