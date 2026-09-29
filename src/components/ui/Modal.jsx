import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cx } from "./cx.js";

/**
 * Dialog shell: backdrop, header (icon badge + title + subtitle + close),
 * scrollable body and optional footer.
 *
 * - Closes on Escape and backdrop click unless `dismissible` is false
 *   (use that while a request is in flight).
 * - size: "sm" | "md" | "lg" | "xl"
 * - tone: "default" | "danger" (tints the icon badge)
 * - dir: set "rtl" for Arabic dialogs; the portal sits outside any
 *   container-level `dir`, so it isn't inherited.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  tone = "default",
  size = "md",
  dismissible = true,
  footer,
  headerExtra,
  children,
  className,
  bodyClassName,
  ariaLabel,
  dir,
  closeLabel = "إغلاق",
}) {
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && dismissible) onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, dismissible, onClose]);

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdrop = () => {
    if (dismissible) onClose?.();
  };

  return createPortal(
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cx("modal-content", `modal-content--${size}`, className)}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        dir={dir}
      >
        {(title || Icon) && (
          <div className="modal-header">
            <div className="modal-title-wrap">
              {Icon && (
                <div
                  className={cx(
                    "modal-icon-badge",
                    tone !== "default" && `modal-icon-badge--${tone}`,
                  )}
                >
                  <Icon size={20} />
                </div>
              )}
              <div>
                <h3 id={titleId} className="modal-title">
                  {title}
                </h3>
                {subtitle && <span className="modal-subtitle">{subtitle}</span>}
              </div>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              disabled={!dismissible}
              aria-label={closeLabel}
            >
              <X size={18} />
            </button>
          </div>
        )}
        {headerExtra}
        <div className={cx("modal-body", bodyClassName)}>{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
