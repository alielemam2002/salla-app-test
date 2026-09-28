import { cx } from "./cx.js";

/** Shimmer placeholder while data loads. */
export default function Skeleton({
  width = "100%",
  height = 14,
  radius,
  className,
}) {
  return (
    <span
      className={cx("ui-skeleton", className)}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}
