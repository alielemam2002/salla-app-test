/** Jump links to each form section. items: [{ id, label, icon, onClick }] */
export default function ProductFormNav({ items }) {
  return (
    <nav className="modal-tabs product-form-nav" aria-label="أقسام النموذج">
      {items.map(({ id, label, icon: Icon, onClick }) => (
        <button
          key={id}
          type="button"
          className="modal-tab-btn"
          onClick={onClick}
        >
          <Icon size={14} aria-hidden="true" /> {label}
        </button>
      ))}
    </nav>
  );
}
