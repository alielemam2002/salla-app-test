import { ArrowRight, ExternalLink, RotateCw, Save, Sparkles, Tag } from "lucide-react";
import { Badge, Button, Skeleton } from "../ui/index.js";

/** Top bar: back, product name/ID/SKU, store link, refresh and save. */
export default function EditorHeader({
  productId,
  name,
  sku,
  storeUrl,
  isLoading,
  isRefetching,
  isSaving,
  onBack,
  onRefresh,
  onSave,
  onOpenAi,
}) {
  return (
    <header className="editor-header">
      <div className="editor-header-start">
        <Button
          variant="ghost"
          size="small"
          icon={ArrowRight}
          onClick={onBack}
          className="editor-back-btn"
        >
          العودة لقائمة المنتجات
        </Button>

        <div className="editor-header-meta">
          <h2 className="editor-product-name">
            {isLoading ? (
              <>
                <Skeleton width={180} height={20} />
                <span className="sr-only">جارِ التحميل...</span>
              </>
            ) : (
              name || "تعديل المنتج"
            )}
          </h2>
          <div className="editor-header-tags">
            <Badge dir="ltr">ID: #{productId}</Badge>
            {sku && (
              <Badge tone="primary" icon={Tag} dir="ltr">
                {sku}
              </Badge>
            )}
            {storeUrl && (
              <a
                href={storeUrl}
                target="_blank"
                rel="noreferrer"
                className="editor-store-link"
              >
                عرض في المتجر <ExternalLink size={11} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="editor-header-actions">
        {onOpenAi && (
          <Button
            variant="ghost"
            size="small"
            icon={Sparkles}
            onClick={onOpenAi}
            className="editor-ai-btn"
          >
            توليد بالذكاء الاصطناعي ✨
          </Button>
        )}
        <Button
          variant="secondary"
          size="small"
          icon={RotateCw}
          onClick={onRefresh}
          loading={isRefetching}
          title="تحديث البيانات من سلة"
        >
          تحديث
        </Button>
        <Button
          variant="primary"
          size="small"
          icon={Save}
          onClick={onSave}
          loading={isSaving}
        >
          حفظ التغييرات
        </Button>
      </div>
    </header>
  );
}
