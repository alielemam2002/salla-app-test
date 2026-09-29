import { memo } from "react";
import {
  CheckCircle2,
  FileWarning,
  Loader2,
  RotateCcw,
  Star,
  X,
  XCircle,
} from "lucide-react";
import { Badge, Button, IconButton } from "../ui/index.js";
import {
  MEDIA_TEXT,
  UPLOAD_STATUS,
  formatBytes,
} from "../../utils/productMedia.js";

const STATUS_TONE = {
  pending: "neutral",
  uploading: "info",
  uploaded: "success",
  failed: "danger",
  cancelled: "warning",
};

function ProgressBar({ value, label }) {
  const percent = Math.round(value * 100);
  return (
    <div
      className="media-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <span className="media-progress-fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** One file in the queue. Memoized: progress events re-render only this row. */
const QueueItem = memo(function QueueItem({
  item,
  locked,
  onRemove,
  onCancel,
  onRetry,
  onSetMain,
}) {
  const { status } = item;
  const isUploading = status === UPLOAD_STATUS.UPLOADING;
  let statusText = MEDIA_TEXT.status[status];
  if (isUploading && item.processing) statusText = MEDIA_TEXT.status.processing;
  else if (isUploading && item.progress !== null) {
    statusText = `${MEDIA_TEXT.status.uploading} ${Math.round(item.progress * 100)}%`;
  }

  return (
    <li className={`media-queue-item media-queue-item--${status}`}>
      <div className="media-queue-thumb">
        {item.previewUrl ? (
          <img src={item.previewUrl} alt="" loading="lazy" />
        ) : (
          <FileWarning size={20} aria-hidden="true" />
        )}
        {item.main && (
          <span className="media-queue-main">{MEDIA_TEXT.mainBadge}</span>
        )}
      </div>

      <div className="media-queue-info">
        <p className="media-queue-name" dir="auto" title={item.file.name}>
          {item.file.name}
        </p>
        <p className="media-queue-meta">
          {formatBytes(item.file.size)}
          <Badge tone={STATUS_TONE[status]} className="media-queue-status">
            {status === UPLOAD_STATUS.UPLOADED && (
              <CheckCircle2 size={12} aria-hidden="true" />
            )}
            {status === UPLOAD_STATUS.FAILED && (
              <XCircle size={12} aria-hidden="true" />
            )}
            {isUploading && (
              <Loader2 size={12} aria-hidden="true" className="ui-spin" />
            )}
            {statusText}
          </Badge>
        </p>
        {isUploading && item.progress !== null && !item.processing && (
          <ProgressBar value={item.progress} label={item.file.name} />
        )}
        {item.error && (
          <p className="media-queue-error" role="alert">
            {item.error}
          </p>
        )}
      </div>

      <div className="media-queue-actions">
        {status === UPLOAD_STATUS.PENDING && !locked && (
          <IconButton
            icon={Star}
            label={MEDIA_TEXT.setMain}
            tone={item.main ? "primary" : undefined}
            size={14}
            onClick={() => onSetMain(item.id)}
            aria-pressed={item.main}
          />
        )}
        {(status === UPLOAD_STATUS.PENDING || isUploading) && locked && (
          <IconButton
            icon={X}
            label={MEDIA_TEXT.cancel}
            tone="danger"
            size={14}
            onClick={() => onCancel(item.id)}
          />
        )}
        {(status === UPLOAD_STATUS.FAILED ||
          status === UPLOAD_STATUS.CANCELLED) &&
          !item.rejected && (
            <IconButton
              icon={RotateCcw}
              label={MEDIA_TEXT.retry}
              tone="primary"
              size={14}
              onClick={() => onRetry(item.id)}
            />
          )}
        {!isUploading && !locked && (
          <IconButton
            icon={X}
            label={MEDIA_TEXT.remove}
            size={14}
            onClick={() => onRemove(item.id)}
          />
        )}
      </div>
    </li>
  );
});

/** Selected files, overall progress, upload / cancel buttons and summary. */
export default function MediaUploadQueue({ queue }) {
  const { items, running, summary, isFinished } = queue;
  if (!items.length) return null;

  const done = summary.uploaded + summary.failed + summary.cancelled;
  const toUpload = summary.pending;

  return (
    <div className="media-queue">
      <div className="media-queue-head">
        <h4 className="media-queue-title">
          {MEDIA_TEXT.queueTitle(summary.total)}
        </h4>
        {running ? (
          <Button size="small" variant="danger" onClick={queue.cancelAll}>
            {MEDIA_TEXT.cancelAll}
          </Button>
        ) : (
          toUpload > 0 && (
            <Button size="small" variant="primary" onClick={queue.start}>
              {MEDIA_TEXT.upload(toUpload)}
            </Button>
          )
        )}
      </div>

      {running && (
        <div className="media-queue-overall" aria-live="polite">
          <span>{MEDIA_TEXT.overall(summary.uploaded, summary.batch)}</span>
          <ProgressBar
            value={summary.batch ? done / summary.total : 0}
            label={MEDIA_TEXT.uploading}
          />
        </div>
      )}

      {isFinished && (
        <div className="media-queue-summary" role="status">
          <strong>{MEDIA_TEXT.summaryTitle}</strong>
          <span className="media-queue-summary-ok">
            {MEDIA_TEXT.summaryUploaded(summary.uploaded)}
          </span>
          {summary.failed > 0 && (
            <span className="media-queue-summary-failed">
              {MEDIA_TEXT.summaryFailed(summary.failed)}
            </span>
          )}
          {summary.cancelled > 0 && (
            <span>{MEDIA_TEXT.summaryCancelled(summary.cancelled)}</span>
          )}
          <div className="media-queue-summary-actions">
            {summary.retryable + summary.cancelled > 0 && (
              <Button size="small" icon={RotateCcw} onClick={queue.retryFailed}>
                {MEDIA_TEXT.retryFailed}
              </Button>
            )}
            <Button
              size="small"
              variant="primary"
              onClick={queue.clearFinished}
            >
              {MEDIA_TEXT.done}
            </Button>
          </div>
        </div>
      )}

      <ul className="media-queue-list">
        {items.map((item) => (
          <QueueItem
            key={item.id}
            item={item}
            locked={running}
            onRemove={queue.remove}
            onCancel={queue.cancelOne}
            onRetry={queue.retryOne}
            onSetMain={queue.setMain}
          />
        ))}
      </ul>
    </div>
  );
}
