import { Sparkles } from "lucide-react";
import { Button } from "../../ui/index.js";

/** Promo strip linking the quick-edit modal to the full product editor. */
export default function FullEditorBanner({ onOpen }) {
  return (
    <div className="product-modal-full-editor-banner" dir="rtl">
      <span className="full-editor-banner-icon" aria-hidden="true">
        <Sparkles size={18} />
      </span>
      <div className="full-editor-banner-text">
        <strong>محرر تفاصيل المنتج المتكامل (Completion Score)</strong>
        <span>
          تحكّم في المظهر، تحسين محركات البحث SEO، الخيارات والمتغيرات مع نسبة
          اكتمال ديناميكية.
        </span>
      </div>
      <Button size="small" variant="primary" onClick={onOpen}>
        فتح محرر المنتج المتكامل
      </Button>
    </div>
  );
}
