import { useState } from "react";
import { Package, Search, X } from "lucide-react";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  IconButton,
  Skeleton,
  TextInput,
} from "../ui/index.js";
import { MAX_CYCLE_DAYS } from "../../utils/replenish/replenishModel.js";

function CycleRow({ product, cycle, onSave, saving }) {
  const [days, setDays] = useState(cycle ? String(cycle.days) : "");
  const value = Number(days);
  const valid =
    Number.isInteger(value) && value >= 1 && value <= MAX_CYCLE_DAYS;
  const changed = cycle ? value !== cycle.days : days.trim() !== "";

  return (
    <tr>
      <td>{product.name || `منتج ${product.id}`}</td>
      <td dir="ltr">{product.sku || "—"}</td>
      <td>
        <div className="replenish-days">
          <TextInput
            type="number"
            min={1}
            max={MAX_CYCLE_DAYS}
            inputMode="numeric"
            aria-label={`مدة استهلاك ${product.name || product.id} بالأيام`}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          <span>يوم</span>
        </div>
      </td>
      <td>
        <Button
          size="small"
          variant="secondary"
          disabled={!changed || !valid || saving}
          onClick={() => onSave(product, value)}
        >
          حفظ
        </Button>
      </td>
    </tr>
  );
}

/**
 * How many days one unit of each product lasts. Only products with a
 * cycle get replenishment reminders.
 */
export default function ProductCyclesCard({
  cycles,
  productsQuery,
  keyword,
  onSearch,
  onSave,
  onRemove,
  saving,
}) {
  const [text, setText] = useState(keyword);
  const withCycle = Object.entries(cycles);

  let list;
  if (productsQuery.isPending) {
    list = <Skeleton height={80} />;
  } else if (productsQuery.isError) {
    list = (
      <Alert tone="error" title="تعذّر تحميل المنتجات">
        {productsQuery.error.result?.error || "حاول مرة أخرى."}
      </Alert>
    );
  } else if (!productsQuery.data.products?.length) {
    list = (
      <EmptyState
        icon={Package}
        title="لا توجد منتجات مطابقة"
        description="جرّب كلمة بحث أخرى."
      />
    );
  } else {
    list = (
      <div className="cart-table-wrap">
        <table className="cart-table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>SKU</th>
              <th>مدة الاستهلاك</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {productsQuery.data.products.map((product) => (
              <CycleRow
                key={`${product.id}-${cycles[product.id]?.days ?? ""}`}
                product={product}
                cycle={cycles[product.id]}
                onSave={onSave}
                saving={saving}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <Card>
      <Card.Header
        icon={Package}
        title="مدة استهلاك المنتجات"
        subtitle="كم يومًا تكفي القطعة الواحدة؟ مثلًا كيس القهوة 25 يومًا. من اشترى قطعتين يُذكَّر بعد ضعف المدة."
      />
      <div className="replenish-body">
        {withCycle.length > 0 ? (
          <ul className="replenish-chips" aria-label="منتجات لها مدة استهلاك">
            {withCycle.map(([id, cycle]) => (
              <li key={id}>
                <span>
                  {cycle.name || `منتج ${id}`} · {cycle.days} يوم
                </span>
                <IconButton
                  icon={X}
                  size={12}
                  label={`إزالة مدة ${cycle.name || id}`}
                  onClick={() => onRemove(id, cycle)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="form-hint">
            لم تحدد مدة لأي منتج بعد. ابحث عن منتج استهلاكي وحدد مدته.
          </p>
        )}

        <form
          className="replenish-search"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(text.trim());
          }}
        >
          <TextInput
            type="search"
            aria-label="بحث عن منتج"
            placeholder="ابحث باسم المنتج"
            prefix={<Search size={14} aria-hidden="true" />}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button size="small" type="submit" variant="secondary">
            بحث
          </Button>
        </form>
        {list}
      </div>
    </Card>
  );
}
