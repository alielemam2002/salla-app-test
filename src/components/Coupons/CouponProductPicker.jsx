import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Package, Search, X } from "lucide-react";
import { Button, IconButton, TextInput } from "../ui/index.js";
import { fetchProductsPage } from "../../utils/productsApi.js";

/**
 * Picker for selecting a specific product to target with a coupon.
 */
export default function CouponProductPicker({
  selectedIds = [],
  selectedProduct = null,
  onSelect,
  onRemove,
  getToken,
  error,
}) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualId, setManualId] = useState("");
  const [showManual, setShowManual] = useState(false);
  const debounceTimer = useRef(null);

  // Search products when keyword changes
  useEffect(() => {
    if (!keyword.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      const token = getToken?.();
      if (!token) return;

      setLoading(true);
      try {
        const res = await fetchProductsPage(token, {
          keyword: keyword.trim(),
          perPage: 8,
        });
        if (res.success && Array.isArray(res.products)) {
          setResults(res.products);
        } else {
          setResults([]);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceTimer.current);
  }, [keyword, getToken]);

  const hasSelected = selectedIds.length > 0;
  const currentId = selectedIds[0];

  const handleManualAdd = (e) => {
    e.preventDefault();
    const idNum = Number(manualId.trim());
    if (Number.isInteger(idNum) && idNum > 0) {
      onSelect?.({ id: idNum, name: `منتج #${idNum}` });
      setManualId("");
      setShowManual(false);
    }
  };

  return (
    <div className="coupon-product-picker">
      <label className="form-label" id="coupon-target-product-label">
        المنتج المستهدف بالخصم <span className="form-required">*</span>
      </label>

      {hasSelected ? (
        <div className="coupon-selected-product">
          <div className="coupon-product-info">
            {selectedProduct?.main_image || selectedProduct?.images?.[0]?.url ? (
              <img
                src={selectedProduct.main_image || selectedProduct.images[0].url}
                alt=""
                className="coupon-product-thumb"
              />
            ) : (
              <div className="coupon-product-thumb-placeholder">
                <Package size={18} />
              </div>
            )}
            <div className="coupon-product-details">
              <span className="coupon-product-name">
                {selectedProduct?.name || `منتج رقم ${currentId}`}
              </span>
              <span className="coupon-product-meta" dir="ltr">
                ID: #{currentId}
                {selectedProduct?.sku ? ` · SKU: ${selectedProduct.sku}` : ""}
              </span>
            </div>
          </div>
          <Button
            size="small"
            variant="secondary"
            onClick={() => onRemove?.(currentId)}
            aria-label="تغيير المنتج"
          >
            تغيير المنتج
          </Button>
        </div>
      ) : (
        <div className="coupon-picker-search-container">
          <div className="coupon-product-search-bar">
            <TextInput
              placeholder="ابحث باسم المنتج أو رمزه (SKU)..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              prefix={<Search size={15} aria-hidden="true" />}
              suffix={
                loading ? (
                  <Loader2 size={15} className="spinner" aria-hidden="true" />
                ) : keyword ? (
                  <IconButton
                    icon={X}
                    label="مسح البحث"
                    size="small"
                    onClick={() => setKeyword("")}
                  />
                ) : null
              }
              aria-labelledby="coupon-target-product-label"
              invalid={Boolean(error)}
            />
          </div>

          {/* Search results list */}
          {keyword.trim() && !loading && (
            <div className="coupon-product-results-dropdown" role="listbox">
              {results.length > 0 ? (
                results.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="coupon-product-result-item"
                    onClick={() => {
                      onSelect?.(prod);
                      setKeyword("");
                      setResults([]);
                    }}
                  >
                    {prod.main_image || prod.images?.[0]?.url ? (
                      <img
                        src={prod.main_image || prod.images[0].url}
                        alt=""
                        className="coupon-product-thumb"
                      />
                    ) : (
                      <div className="coupon-product-thumb-placeholder">
                        <Package size={16} />
                      </div>
                    )}
                    <div className="coupon-product-meta-col">
                      <span className="coupon-product-title">{prod.name}</span>
                      <span className="coupon-product-sub" dir="ltr">
                        {prod.price?.amount || prod.price ? `${prod.price?.amount || prod.price} SAR · ` : ""}
                        ID: #{prod.id}
                      </span>
                    </div>
                    <Check size={14} className="coupon-select-check" />
                  </button>
                ))
              ) : (
                <div className="coupon-product-no-results">
                  لا توجد منتجات مطابقة لـ «{keyword}»
                </div>
              )}
            </div>
          )}

          {/* Manual ID toggle */}
          <div className="coupon-manual-id-toggle">
            {!showManual ? (
              <button
                type="button"
                className="btn-link"
                onClick={() => setShowManual(true)}
              >
                أو أدخل رقم معرّف المنتج (ID) مباشرة
              </button>
            ) : (
              <div className="coupon-manual-id-row">
                <TextInput
                  type="number"
                  placeholder="رقم المنتج في سلة مثلاً 15504447"
                  dir="ltr"
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                />
                <Button
                  size="small"
                  variant="secondary"
                  onClick={handleManualAdd}
                  disabled={!manualId.trim()}
                >
                  اختيار
                </Button>
                <Button
                  size="small"
                  variant="ghost"
                  onClick={() => setShowManual(false)}
                >
                  إلغاء
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
