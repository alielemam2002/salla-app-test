/** Join truthy class names. */
export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}
