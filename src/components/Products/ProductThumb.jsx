import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cx } from "../ui/index.js";

/** Square product thumbnail with an icon placeholder for missing/broken images. */
export default function ProductThumb({ src, size = "md", className }) {
  const [failed, setFailed] = useState(false);
  const classes = cx("products-thumb", `products-thumb--${size}`, className);

  if (!src || failed) {
    return (
      <span className={cx(classes, "products-thumb--empty")} aria-hidden="true">
        <ImageOff size={16} />
      </span>
    );
  }
  return (
    <img
      className={classes}
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
