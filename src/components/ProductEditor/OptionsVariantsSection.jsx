import { Layers, Plus } from "lucide-react";
import { Button } from "../ui/index.js";
import EditorSection from "./EditorSection.jsx";
import OptionsList from "./OptionsList.jsx";
import VariantsTable from "./VariantsTable.jsx";
import AddOptionModal from "./AddOptionModal.jsx";
import EditVariantModal from "./EditVariantModal.jsx";
import { useOptionsVariants } from "../../hooks/productEditor/useOptionsVariants.js";

export default function OptionsVariantsSection({
  options = [],
  variants = [],
  sectionScore,
  onCreateOption,
  onDeleteOption,
  onUpdateVariant,
  isOptionsLoading,
  isVariantsLoading,
}) {
  const { addOption, editVariant } = useOptionsVariants({
    onCreateOption,
    onUpdateVariant,
  });

  return (
    <EditorSection
      id="section-variants"
      bodyId="field-options-variants"
      icon={Layers}
      title="الخيارات والمتغيرات (Options & Variants)"
      description="إدارة خصائص المنتج (المقاسات، الألوان) وأسعار ومخزون كل خيار على حدة."
      score={sectionScore}
      fallbackWeight={5}
      actions={
        <Button
          size="small"
          variant="secondary"
          icon={Plus}
          onClick={addOption.open}
        >
          إضافة خيار جديد
        </Button>
      }
    >
      <div className="options-block">
        <h5 className="editor-subheading">
          خيارات المنتج الحالية (Attributes)
        </h5>
        <OptionsList
          options={options}
          isLoading={isOptionsLoading}
          onDelete={onDeleteOption}
        />
      </div>

      <div className="variants-block">
        <h5 className="editor-subheading">
          قائمة المتغيرات والمخزون لكل نوع ({variants.length})
        </h5>
        <VariantsTable
          variants={variants}
          isLoading={isVariantsLoading}
          onEdit={editVariant.open}
        />
      </div>

      <AddOptionModal
        isOpen={addOption.isOpen}
        form={addOption.form}
        isSubmitting={addOption.isSubmitting}
        onChange={addOption.change}
        onSubmit={addOption.submit}
        onClose={addOption.close}
      />
      <EditVariantModal
        variant={editVariant.variant}
        form={editVariant.form}
        isSubmitting={editVariant.isSubmitting}
        onChange={editVariant.change}
        onSubmit={editVariant.submit}
        onClose={editVariant.close}
      />
    </EditorSection>
  );
}
