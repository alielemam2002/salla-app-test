import { memo } from "react";
import { Search } from "lucide-react";
import { Badge, Button, Select, TextInput } from "../ui/index.js";
import { ineligibleReason } from "../../utils/campaigns/campaignModel.js";

const Row = memo(function Row({
  customer,
  selected,
  onToggle,
  groupNames,
  result,
  locked,
}) {
  const reason = ineligibleReason(customer);
  return (
    <tr className={reason ? "campaign-row--off" : ""}>
      <td>
        <input
          type="checkbox"
          checked={selected}
          disabled={Boolean(reason) || locked}
          onChange={() => onToggle(customer.id)}
          aria-label={`Select ${customer.name || "customer"}`}
          title={reason || undefined}
        />
      </td>
      <td>{customer.name || "—"}</td>
      <td dir="ltr" className="cart-num">
        {customer.mobile || "—"}
      </td>
      <td>{groupNames || "—"}</td>
      <td>
        {result ? (
          <Badge
            tone={result.ok ? "success" : "danger"}
            title={result.ok ? result.messageId : result.detail || undefined}
          >
            {result.ok ? "Accepted by Meta" : result.error}
          </Badge>
        ) : reason ? (
          <Badge tone="neutral">{reason}</Badge>
        ) : (
          <Badge tone="success" dot>
            Can receive
          </Badge>
        )}
      </td>
    </tr>
  );
});

/**
 * Pick who gets the campaign: search, group filter, select all that can
 * receive it, untick anyone. Customers who can't receive it (blocked,
 * notifications off, no international number) can't be ticked.
 */
export default function RecipientsTable({
  customers,
  visible,
  groups,
  search,
  onSearch,
  groupId,
  onGroup,
  selected,
  onToggle,
  onSelectVisible,
  onClear,
  results,
  locked,
}) {
  const groupName = new Map(groups.map((g) => [String(g.id), g.name]));
  const selectableVisible = visible.filter((c) => !ineligibleReason(c));
  return (
    <div className="campaign-recipients">
      <div className="campaign-toolbar">
        <TextInput
          type="search"
          aria-label="Search customers"
          placeholder="Search name, phone or city"
          prefix={<Search size={14} aria-hidden="true" />}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
        {groups.length > 0 && (
          <Select
            aria-label="Customer group"
            value={groupId}
            onChange={(e) => onGroup(e.target.value)}
            options={[
              { value: "", label: "All customers" },
              ...groups.map((g) => ({ value: String(g.id), label: g.name })),
            ]}
          />
        )}
        <Button
          size="small"
          onClick={() => onSelectVisible(selectableVisible)}
          disabled={!selectableVisible.length || locked}
        >
          Select all shown ({selectableVisible.length})
        </Button>
        <Button
          size="small"
          variant="ghost"
          onClick={onClear}
          disabled={!selected.size || locked}
        >
          Clear
        </Button>
        <span className="campaign-count">
          <strong>{selected.size}</strong> of {customers.length} selected
        </span>
      </div>

      <div className="cart-table-wrap">
        <table className="cart-table">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Select</span>
              </th>
              <th scope="col">Customer</th>
              <th scope="col">Mobile</th>
              <th scope="col">Groups</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((customer) => (
              <Row
                key={customer.id}
                customer={customer}
                selected={selected.has(customer.id)}
                onToggle={onToggle}
                groupNames={customer.groups
                  .map((id) => groupName.get(String(id)))
                  .filter(Boolean)
                  .join(", ")}
                result={results?.[customer.id]}
                locked={locked}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
