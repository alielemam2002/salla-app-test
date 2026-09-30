import { Filter, Search, X } from "lucide-react";
import { Button, IconButton, Select } from "../ui/index.js";
import { STATUS_FILTER_OPTIONS } from "../../utils/productConstants.js";

/** Keyword search, status filter and category filter. */
export default function ProductsToolbar({ search, disabled, categories = [] }) {
  const {
    keywordInput,
    setKeywordInput,
    statusFilter,
    categoryFilter,
    submitSearch,
    clearSearch,
    changeStatusFilter,
    changeCategoryFilter,
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
            placeholder="ابحث بالاسم أو رمز SKU…"
            aria-label="بحث في المنتجات"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
          />
          {keywordInput && (
            <IconButton
              icon={X}
              size={14}
              label="مسح البحث"
              className="products-search-clear"
              onClick={clearSearch}
            />
          )}
        </div>
        <Button type="submit" variant="secondary" disabled={disabled}>
          بحث
        </Button>
      </form>

      <div className="products-filter-wrap">
        <Filter size={15} className="products-filter-icon" aria-hidden="true" />
        <Select
          className="products-filter-select"
          aria-label="تصفية حسب الحالة"
          value={statusFilter}
          onChange={(e) => changeStatusFilter(e.target.value)}
          disabled={disabled}
          options={STATUS_FILTER_OPTIONS}
        />
        {categories.length > 0 && changeCategoryFilter && (
          <Select
            className="products-filter-select"
            aria-label="تصفية حسب التصنيف"
            value={categoryFilter || ""}
            onChange={(e) => changeCategoryFilter(e.target.value)}
            disabled={disabled}
            options={[
              { value: "", label: "كل التصنيفات" },
              ...categories.map((c) => ({
                value: String(c.id),
                label: c.name,
              })),
            ]}
          />
        )}
      </div>
    </div>
  );
}
