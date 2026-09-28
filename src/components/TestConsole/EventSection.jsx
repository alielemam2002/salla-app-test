import Button from "../ui/Button.jsx";

/** One titled group of SDK event buttons. Presentational only. */
export default function EventSection({ title, icon: Icon, buttons, onPress }) {
  const headingId = `event-section-${title.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <section className="event-section" aria-labelledby={headingId}>
      <h3 id={headingId} className="event-section-title">
        {Icon && <Icon size={14} aria-hidden="true" />}
        {title}
      </h3>
      <div className="event-grid">
        {buttons.map((button) => (
          <Button
            key={button.label}
            event
            variant={button.variant}
            label={button.label}
            hint={button.hint}
            onClick={() => onPress(button)}
          />
        ))}
      </div>
    </section>
  );
}
