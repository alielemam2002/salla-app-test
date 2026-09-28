import { useCallback, useState } from "react";
import { Download, Package, Plus, RefreshCw, Tag } from "lucide-react";
import { Button, Card } from "../ui/index.js";
import { useDisclosure } from "../../hooks/ui/useDisclosure.js";
import { useProductsList } from "../../hooks/products/useProductsList.js";
import { useProductSelection } from "../../hooks/products/useProductSelection.js";
import { useProductTaxonomies } from "../../hooks/products/useProductTaxonomies.js";
import { useProductMutations } from "../../hooks/products/useProductMutations.js";
import ProductEditor from "../ProductEditor/ProductEditor.jsx";
import BulkDiscountModal from "../Discounts/BulkDiscountModal.jsx";
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
  const selection = useProductSelection(list.products);
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

  const { products, isLoading, error, page, search } = list;

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
        <ProductsToolbar search={search} disabled={isLoading} />
        {content}
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
