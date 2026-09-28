import { Globe } from "lucide-react";

/** Google result preview for the product's SEO title/description/URL. */
export default function SerpPreview({ url, title, description }) {
  return (
    <figure className="serp-preview" aria-label="معاينة نتيجة البحث">
      <figcaption className="serp-preview-caption">
        <Globe size={13} aria-hidden="true" />
        معاينة نتيجة بحث Google المباشرة (SERP Live Preview)
      </figcaption>
      <div className="serp-preview-card" dir="auto">
        <div className="serp-preview-url" dir="ltr">
          {url}
        </div>
        <div className="serp-preview-title">{title}</div>
        <p className="serp-preview-desc">{description}</p>
      </div>
    </figure>
  );
}
