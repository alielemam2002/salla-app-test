import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import { Badge, Button, Card, SectionHeader } from "../ui/index.js";

/** "12/20%" completion pill for a section. */
export function SectionScore({ score, fallbackWeight }) {
  const done = Boolean(score?.isComplete);
  return (
    <Badge
      tone={done ? "success" : "warning"}
      icon={done ? CheckCircle2 : AlertCircle}
      className="editor-score-pill"
      title={done ? "القسم مكتمل" : "القسم غير مكتمل"}
    >
      {score?.currentScore || 0}/{score?.targetWeight || fallbackWeight}%
    </Badge>
  );
}

/**
 * Card shell shared by every editor section: icon, title, description,
 * completion pill and a "save section" button (or custom `actions`).
 */
export default function EditorSection({
  id,
  icon,
  title,
  description,
  score,
  fallbackWeight,
  saveLabel,
  onSave,
  isSaving,
  actions,
  bodyId,
  children,
}) {
  return (
    <Card className="editor-section-card" id={id} aria-label={title}>
      <div className="editor-section-header">
        <SectionHeader
          icon={icon}
          title={title}
          description={description}
          actions={
            <>
              <SectionScore score={score} fallbackWeight={fallbackWeight} />
              {actions}
              {onSave && (
                <Button
                  size="small"
                  variant="secondary"
                  icon={Save}
                  onClick={onSave}
                  loading={isSaving}
                >
                  {saveLabel}
                </Button>
              )}
            </>
          }
        />
      </div>
      <div className="editor-section-body" id={bodyId}>
        {children}
      </div>
    </Card>
  );
}
