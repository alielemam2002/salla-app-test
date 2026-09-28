import {
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Lightbulb,
  ShieldCheck,
} from "lucide-react";
import { Badge, Button, Modal, StatCard } from "../ui/index.js";
import {
  formatBytes,
  formatSavingsMs,
} from "../../utils/performance/recommendations.js";
import {
  getPriorityLabel,
  impactToTone,
  truncateUrl,
} from "../../utils/performance/formatters.js";

function itemSavings(item) {
  if (item.wastedBytes) return formatBytes(item.wastedBytes);
  if (item.wastedMs) return `${Math.round(item.wastedMs)}ms`;
  return "—";
}

/** Full audit detail for a single recommendation. */
export default function RecommendationDetailModal({ recommendation, onClose }) {
  if (!recommendation) return null;

  const {
    title,
    description,
    impact,
    metric,
    affectedMetric,
    categoryLabel,
    savingsMs,
    savingsBytes,
    whyItMatters,
    howToFix = [],
    items = [],
  } = recommendation;

  const targetMetric = affectedMetric || metric;
  const steps = howToFix.length > 0 ? howToFix : [description];

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      icon={Lightbulb}
      title={title}
      className="perf-modal perf-rec-modal"
      footer={<Button onClick={onClose}>إغلاق</Button>}
    >
      <div className="perf-rec-modal-badges">
        <Badge tone={impactToTone(impact)}>{getPriorityLabel(impact)}</Badge>
        {targetMetric && (
          <Badge tone="info">
            المؤشر المتأثر: <strong>{targetMetric}</strong>
          </Badge>
        )}
        {categoryLabel && <Badge>{categoryLabel}</Badge>}
      </div>

      {(savingsMs || savingsBytes) && (
        <div className="perf-rec-modal-block">
          <h4 className="perf-block-title">
            التوفير المتوقع المكتشف بواسطة Google:
          </h4>
          <div className="perf-stat-grid">
            {savingsMs > 0 && (
              <StatCard
                tone="success"
                label="الوقت المحفوظ تقريبياً:"
                value={`~${formatSavingsMs(savingsMs)}`}
              />
            )}
            {savingsBytes > 0 && (
              <StatCard
                tone="success"
                label="حجم البيانات المحفوظ:"
                value={formatBytes(savingsBytes)}
              />
            )}
          </div>
        </div>
      )}

      <div className="perf-rec-modal-block">
        <h4 className="perf-block-title">
          <AlertTriangle size={16} className="is-warning" aria-hidden="true" />
          لماذا يؤثر هذا على متجرك؟
        </h4>
        <p className="perf-block-text">{whyItMatters || description}</p>
      </div>

      <div className="perf-rec-modal-block">
        <h4 className="perf-block-title">
          <CheckCircle2 size={16} className="is-success" aria-hidden="true" />
          خطوات الحل والتطبيق
        </h4>
        <ol className="perf-steps">
          {steps.map((step, idx) => (
            <li key={idx} className="perf-step">
              <span className="perf-step-num">{idx + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {items.length > 0 && (
        <div className="perf-rec-modal-block">
          <h4 className="perf-block-title">
            <FileCode size={16} aria-hidden="true" />
            الملفات والعناصر المتسببة في المشكلة ({items.length})
          </h4>
          <div className="perf-table-wrap">
            <table className="perf-table perf-table--compact">
              <thead>
                <tr>
                  <th scope="col">رابط الملف أو العنصر</th>
                  <th scope="col">الحجم / التأخير</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx}>
                    <td
                      className="perf-url-cell"
                      title={item.url || item.label}
                    >
                      <code dir="ltr">
                        {truncateUrl(item.url || item.label)}
                      </code>
                    </td>
                    <td className="perf-nowrap">{itemSavings(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="perf-muted perf-inline-icon">
        <ShieldCheck size={14} aria-hidden="true" />
        المصدر: Google Lighthouse Audit Diagnostics
      </p>
    </Modal>
  );
}
