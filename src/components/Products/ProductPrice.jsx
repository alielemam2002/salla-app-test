import { formatPrice, getPriceDisplay } from "../../utils/productFormat.js";

/** Price cell: plain price, or struck-through regular price plus sale price. */
export default function ProductPrice({ product }) {
  const { hasSale, regular, sale, price } = getPriceDisplay(product);

  if (hasSale) {
    return (
      <div className="products-price-block">
        <div className="products-price-original">{formatPrice(regular)}</div>
        <div className="products-sale-badge">
          سعر التخفيض: {formatPrice(sale)}
        </div>
      </div>
    );
  }
  return <div className="products-price">{formatPrice(price)}</div>;
}
