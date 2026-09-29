import { useCallback, useState } from "react";
import { promoteImage, removeImageAt } from "../../utils/productEditorForm.js";

/**
 * Local gallery state for the editor (add / remove / set main). Changes are
 * sent to Salla on save; removing a saved image deletes it right away.
 */
export function useEditorImages({ deleteImage, notify, getAltText }) {
  const [images, setImages] = useState([]);
  const [isBusy, setIsBusy] = useState(false);

  const addImage = useCallback(
    (url) => {
      setImages((prev) => [
        ...prev,
        {
          // Not in Salla yet: kept when Salla's images are refetched.
          isLocal: true,
          original: url,
          default: prev.length === 0,
          sort: prev.length + 1,
          alt: getAltText?.() || "",
        },
      ]);
      notify("تمت إضافة الصورة. اضغط حفظ لتطبيقها على سلة.", "info");
    },
    [notify, getAltText],
  );

  const removeImage = useCallback(
    async (index, imageId) => {
      if (imageId) {
        setIsBusy(true);
        try {
          await deleteImage(imageId);
          notify("تم حذف الصورة بنجاح من سلة", "success");
        } catch (err) {
          notify(err.message || "تعذر حذف الصورة", "error");
        } finally {
          setIsBusy(false);
        }
      }
      setImages((prev) => removeImageAt(prev, index));
    },
    [deleteImage, notify],
  );

  const setMainImage = useCallback(
    (index) => {
      setImages((prev) => promoteImage(prev, index));
      notify("تم تعيين الصورة كرئيسية. اضغط حفظ لتثبيت الترتيب.", "info");
    },
    [notify],
  );

  return { images, setImages, isBusy, addImage, removeImage, setMainImage };
}
