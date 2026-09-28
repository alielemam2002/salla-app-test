import { TrendingDown, TrendingUp } from "lucide-react";

/** Expected profit/loss banner from the effective selling price and cost. */
export default function ProfitInsight({
  profit,
  margin,
  effectivePrice,
  costPrice,
  currencyLabel,
}) {
  if (profit === null) return null;
  const isLoss = profit < 0;
  const Icon = isLoss ? TrendingDown : TrendingUp;

  return (
    <div
      className={`profit-insight ${isLoss ? "profit-insight--loss" : ""}`}
      role="status"
    >
      <span className="profit-insight-icon" aria-hidden="true">
        <Icon size={18} />
      </span>
      <div className="profit-insight-text">
        <div className="profit-insight-main">
          <span>{isLoss ? "خسارة متوقعة: " : "هامش الربح المتوقع: "}</span>
          <strong>
            {Math.abs(profit).toFixed(2)} {currencyLabel}
          </strong>
          <span className="profit-insight-margin">({margin}%)</span>
        </div>
        <span className="profit-insight-sub">
          (سعر البيع {effectivePrice} {currencyLabel} - التكلفة {costPrice}{" "}
          {currencyLabel})
        </span>
      </div>
    </div>
  );
}
