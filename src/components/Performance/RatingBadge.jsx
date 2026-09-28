import { Badge } from "../ui/index.js";
import { getRatingLabel } from "../../utils/performance/thresholds.js";
import { ratingToTone } from "../../utils/performance/formatters.js";

/** Web Vitals rating pill (good / needs improvement / poor). */
export default function RatingBadge({ rating, children, ...props }) {
  return (
    <Badge tone={ratingToTone(rating)} {...props}>
      {children ?? getRatingLabel(rating)}
    </Badge>
  );
}
