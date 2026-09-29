import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { Button } from "../ui/index.js";

/** "More" dropdown for the less-used bulk actions. */
export default function BulkActionMenu({ actions, onSelect, disabled }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="bulk-menu" ref={rootRef}>
      <Button
        size="small"
        variant="secondary"
        icon={MoreHorizontal}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        More <ChevronDown size={12} aria-hidden="true" />
      </Button>
      {open && (
        <ul className="bulk-menu-list" role="menu" id={menuId}>
          {actions.map((action) => (
            <li key={action.key} role="none">
              <button
                type="button"
                role="menuitem"
                className={`bulk-menu-item${action.danger ? " bulk-menu-item--danger" : ""}`}
                onClick={() => {
                  setOpen(false);
                  onSelect(action);
                }}
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
