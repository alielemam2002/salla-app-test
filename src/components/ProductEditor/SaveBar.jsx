import { Save } from "lucide-react";
import { Button } from "../ui/index.js";
import { scoreTone } from "../../utils/productEditorForm.js";

/** Sticky bottom bar with the live score and the master save (submit). */
export default function SaveBar({ score, isSaving, onCancel }) {
  return (
    <div className="editor-save-bar">
      <div className={`editor-save-bar-score completion--${scoreTone(score)}`}>
        <span className="editor-save-bar-num">{score}%</span>
        <span>نسبة اكتمال بيانات المنتج</span>
      </div>
      <div className="editor-save-bar-actions">
        <Button variant="secondary" size="small" onClick={onCancel}>
          إلغاء والعودة
        </Button>
        <Button type="submit" variant="primary" icon={Save} loading={isSaving}>
          حفظ جميع البيانات
        </Button>
      </div>
    </div>
  );
}
