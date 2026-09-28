import { forwardRef } from "react";
import { SectionHeader } from "../../ui/index.js";

/** Titled group inside the product form; the ref is the scroll target. */
const FormSection = forwardRef(function FormSection(
  { icon, title, description, children },
  ref,
) {
  return (
    <section ref={ref} className="form-section product-form-section">
      <SectionHeader icon={icon} title={title} description={description} />
      {children}
    </section>
  );
});

export default FormSection;
