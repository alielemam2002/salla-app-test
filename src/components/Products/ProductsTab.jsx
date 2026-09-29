import { useCallback, useMemo, useState } from "react";
import { Download, Package, Plus, RefreshCw, Tag } from "lucide-react";
import { Button, Card } from "../ui/index.js";
import { useDisclosure } from "../../hooks/ui/useDisclosure.js";
import { useProductsList } from "../../hooks/products/useProductsList.js";
import { useProductSelection } from "../../hooks/products/useProductSelection.js";
import { useProductTaxonomies } from "../../hooks/products/useProductTaxonomies.js";
import { useProductMutations } from "../../hooks/products/useProductMutations.js";
import ProductEditor from "../ProductEditor/ProductEditor.jsx";
import BulkDiscountModal from "../Discounts/BulkDiscountModal.jsx";
import BulkActionModal from "../BulkActions/BulkActionModal.jsx";
import BulkOperationsPanel from "../BulkActions/BulkOperationsPanel.jsx";
import { STATUS_FILTER_OPTIONS } from "../../utils/productConstants.js";
import ProductModal from "./ProductModal.jsx";
import DeleteConfirmModal from "./DeleteConfirmModal.jsx";
import ProductsToolbar from "./ProductsToolbar.jsx";
import ProductsSelectionBar from "./ProductsSelectionBar.jsx";
import ProductsSummary from "./ProductsSummary.jsx";
import ProductsTable from "./ProductsTable.jsx";
import ProductsTableSkeleton from "./ProductsTableSkeleton.jsx";
import ProductsPagination from "./ProductsPagination.jsx";
import { ProductsEmptyState, ProductsErrorState } from "./ProductsStates.jsx";

// Kept for backwards compatibility; the helper lives in utils now.
export { productImage } from "../../utils/productFormat.js";

/** Products tab container: wires hooks to presentational components. */
export default function ProductsTab({ embedded, showToast }) {
  const getToken = useCallback(
    () => embedded?.auth?.getToken?.() || null,
    [embedded],
  );

  const list = useProductsList({ getToken, showToast });
  const { appliedKeyword, statusFilter, categoryFilter } = list.search;
  const selection = useProductSelection(list.products, {
    total: list.total,
    scopeKey: `${appliedKeyword}|${statusFilter}|${categoryFilter}`,
  });
  const taxonomies = useProductTaxonomies(getToken);
  const { saveProduct, removeProduct, handleBulkSuccess } = useProductMutations(
    {
      getToken,
      list,
      selection,
      showToast,
    },
  );

  const productForm = useDisclosure();
  const deleteDialog = useDisclosure();
  const bulkDiscount = useDisclosure();
  const [editorProduct, setEditorProduct] = useState(null);
  // { uiAction, selection } while a bulk action dialog is open. The
  // selection is a snapshot so clearing it after submit doesn't change the
  // dialog's numbers.
  const [bulkAction, setBulkAction] = useState(null);

  const { products, isLoading, error, page, search } = list;

  // Human-readable list filters; they are also the Salla bulk filters used
  // by "select all matching".
  const filterLabels = useMemo(() => {
    const labels = [];
    if (statusFilter) {
      const opt = STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter);
      labels.push(`Status: ${opt?.label || statusFilter}`);
    }
    if (categoryFilter) {
      const cat = taxonomies.categories.find(
        (c) => String(c.id) === String(categoryFilter),
      );
      labels.push(`Category: ${cat?.name || categoryFilter}`);
    }
    return labels;
  }, [statusFilter, categoryFilter, taxonomies.categories]);

  const openBulkAction = (uiAction) =>
    setBulkAction({
      uiAction,
      selection: {
        count: selection.count,
        sampleProducts: selection.selectedProducts,
        filterLabels: selection.allMatching ? filterLabels : [],
        bulkSelection: selection.allMatching
          ? {
              mode: "all",
              excludedIds: selection.excludedIds,
              status: statusFilter,
              categoryId: categoryFilter,
            }
          : { mode: "ids", ids: selection.selectedIds },
      },
    });

  const pageFullySelected =
    selection.isAllSelected && list.total > products.length;

  if (editorProduct) {
    return (
      <ProductEditor
        productId={editorProduct.id}
        initialProduct={editorProduct}
        token={getToken()}
        onBack={() => {
          setEditorProduct(null);
          list.loadPage(page);
        }}
        showToast={showToast}
      />
    );
  }

  let content;
  if (isLoading && !products.length) {
    content = <ProductsTableSkeleton progress={list.progress} />;
  } else if (error) {
    content = (
      <ProductsErrorState
        error={error}
        onRetry={() => list.loadPage(page)}
        onRefreshSession={() => embedded?.auth?.refresh()}
      />
    );
  } else if (!products.length) {
    content = (
      <ProductsEmptyState
        hasFilters={search.hasFilters}
        onClearFilters={search.clearSearch}
      />
    );
  } else {
    content = (
      <>
        <ProductsSelectionBar
          count={selection.count}
          onBulkDiscount={() => bulkDiscount.open()}
          onClear={selection.clear}
          allMatching={selection.allMatching}
          canSelectAllMatching={
            !selection.allMatching && pageFullySelected && !appliedKeyword
          }
          matchingTotal={list.total}
          onSelectAllMatching={selection.selectAllMatching}
          searchBlocksSelectAll={pageFullySelected && Boolean(appliedKeyword)}
          filterLabels={filterLabels}
          onBulkAction={openBulkAction}
        />
        <ProductsSummary
          count={products.length}
          total={list.total}
          page={page}
          totalPages={list.totalPages}
          showingAll={list.showingAll}
          appliedKeyword={search.appliedKeyword}
          statusFilter={search.statusFilter}
        />
        <ProductsTable
          products={products}
          selection={selection}
          onEdit={productForm.open}
          onOpenEditor={setEditorProduct}
          onDelete={deleteDialog.open}
        />
        {!list.showingAll && (
          <ProductsPagination
            page={page}
            totalPages={list.totalPages}
            disabled={isLoading}
            onPageChange={list.loadPage}
          />
        )}
      </>
    );
  }

  return (
    <div className="products-container">
      <Card className="products-panel">
        <Card.Header
          icon={Package}
          title="Products Management"
          subtitle="Full CRUD & Bulk Discounts on Salla Admin API"
          actions={
            <>
              <Button
                variant="accent"
                icon={Tag}
                onClick={() => bulkDiscount.open()}
                disabled={isLoading}
              >
                {selection.count > 0
                  ? `Bulk Discount (${selection.count})`
                  : "Bulk Discount"}
              </Button>
              <Button
                variant="primary"
                icon={Plus}
                onClick={() => productForm.open(null)}
                disabled={isLoading}
              >
                Add Product
              </Button>
              <Button
                variant="secondary"
                icon={RefreshCw}
                onClick={list.refresh}
                disabled={isLoading}
              >
                Refresh
              </Button>
              <Button
                variant="secondary"
                icon={Download}
                onClick={list.loadAll}
                disabled={isLoading || !!error}
              >
                Fetch all
              </Button>
            </>
          }
        />
        <ProductsToolbar
          search={search}
          disabled={isLoading}
          categories={taxonomies.categories}
        />
        {content}
        <BulkOperationsPanel onRefreshProducts={list.refresh} />
      </Card>

      <ProductModal
        isOpen={productForm.isOpen}
        onClose={productForm.close}
        onSave={saveProduct}
        product={productForm.data}
        taxonomies={taxonomies}
        onOpenFullEditor={(prod) => {
          productForm.close();
          setEditorProduct(prod);
        }}
      />

      <DeleteConfirmModal
        isOpen={deleteDialog.isOpen}
        product={deleteDialog.data}
        onClose={deleteDialog.close}
        onConfirm={removeProduct}
      />

      {bulkAction && (
        <BulkActionModal
          key={bulkAction.uiAction.key}
          uiAction={bulkAction.uiAction}
          selection={bulkAction.selection}
          lookups={taxonomies}
          currency={products[0]?.price?.currency || "SAR"}
          getToken={getToken}
          onClose={() => setBulkAction(null)}
          onSubmitted={selection.clear}
          onRefreshProducts={list.refresh}
          showToast={showToast}
        />
      )}

      <BulkDiscountModal
        isOpen={bulkDiscount.isOpen}
        onClose={bulkDiscount.close}
        selectedProducts={selection.selectedProducts}
        allLoadedProducts={products}
        totalStoreProducts={list.pagination?.total ?? products.length}
        categories={taxonomies.categories}
        token={getToken()}
        onSuccess={handleBulkSuccess}
        showToast={showToast}
      />
    </div>
  );
}
