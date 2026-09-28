import { Filter, Search, X } from "lucide-react";
import { Button, IconButton, Select } from "../ui/index.js";
import { STATUS_FILTER_OPTIONS } from "../../utils/productConstants.js";

/** Keyword search and status filter. */
export default function ProductsToolbar({ search, disabled }) {
  const {
    keywordInput,
    setKeywordInput,
    statusFilter,
    submitSearch,
    clearSearch,
    changeStatusFilter,
  } = search;

  return (
    <div className="products-toolbar">
      <form
        role="search"
        className="products-search-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          submitSearch();
        }}
      >
        <div className="products-search-field">
          <Search
            size={16}
            className="products-search-icon"
            aria-hidden="true"
          />
          <input
            type="search"
            className="form-input products-search-input"
            placeholder="Search by name or SKU..."
            aria-label="Search products"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
          />
          {keywordInput && (
            <IconButton
              icon={X}
              size={14}
              label="Clear search"
              className="products-search-clear"
              onClick={clearSearch}
            />
          )}
        </div>
        <Button type="submit" variant="secondary" disabled={disabled}>
          Search
        </Button>
      </form>

      <div className="products-filter-wrap">
        <Filter size={15} className="products-filter-icon" aria-hidden="true" />
        <Select
          className="products-filter-select"
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => changeStatusFilter(e.target.value)}
          disabled={disabled}
          options={STATUS_FILTER_OPTIONS}
        />
      </div>
    </div>
  );
}
