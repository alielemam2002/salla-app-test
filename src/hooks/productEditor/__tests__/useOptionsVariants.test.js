import { describe, it, expect, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useOptionsVariants } from "../useOptionsVariants.js";
import { useEditorImages } from "../useEditorImages.js";

describe("useOptionsVariants", () => {
  it("submits a new option with parsed values and closes", async () => {
    const onCreateOption = vi.fn().mockResolvedValue();
    const { result } = renderHook(() => useOptionsVariants({ onCreateOption }));

    act(() => {
      result.current.addOption.open();
      result.current.addOption.change("name", " Size ");
      result.current.addOption.change("valuesInput", "S, M");
    });
    await act(() => result.current.addOption.submit());

    expect(onCreateOption).toHaveBeenCalledWith({
      name: "Size",
      type: "text",
      values: [{ name: "S" }, { name: "M" }],
    });
    expect(result.current.addOption.isOpen).toBe(false);
    expect(result.current.addOption.form.name).toBe("");
  });

  it("prefills and submits a variant edit", async () => {
    const onUpdateVariant = vi.fn().mockResolvedValue();
    const { result } = renderHook(() =>
      useOptionsVariants({ onUpdateVariant }),
    );

    act(() => result.current.editVariant.open({ id: 7, sku: "A", price: 5 }));
    expect(result.current.editVariant.form).toMatchObject({
      sku: "A",
      price: 5,
    });

    act(() => result.current.editVariant.change("sku", "B"));
    await act(() => result.current.editVariant.submit());

    expect(onUpdateVariant).toHaveBeenCalledWith({
      variantId: 7,
      variantData: expect.objectContaining({ sku: "B" }),
    });
    expect(result.current.editVariant.variant).toBeNull();
  });
});

describe("useEditorImages", () => {
  it("adds, promotes and removes images", async () => {
    const notify = vi.fn();
    const deleteImage = vi.fn().mockResolvedValue();
    const { result } = renderHook(() =>
      useEditorImages({ deleteImage, notify, getAltText: () => "Tee" }),
    );

    act(() => {
      result.current.addImage("a");
      result.current.addImage("b");
    });
    expect(result.current.images.map((i) => i.default)).toEqual([true, false]);
    expect(result.current.images[0].alt).toBe("Tee");

    act(() => result.current.setMainImage(1));
    expect(result.current.images[0].original).toBe("b");

    await act(() => result.current.removeImage(0, 42));
    expect(deleteImage).toHaveBeenCalledWith(42);
    expect(result.current.images).toHaveLength(1);
    expect(result.current.images[0].default).toBe(true);
  });
});
