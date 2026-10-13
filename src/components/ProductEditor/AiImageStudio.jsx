import { useEffect, useRef, useState } from "react";
import {
  Check,
  ImagePlus,
  Plus,
  Sparkles,
  Star,
  Upload,
  Wand2,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Field,
  FormRow,
  IconButton,
  Modal,
  SegmentedTabs,
  Select,
  Spinner,
  Textarea,
} from "../ui/index.js";
import {
  AI_IMAGE_QUALITIES,
  AI_IMAGE_STYLES,
  AI_IMAGE_TOOLS,
  AI_PROMPT_MAX,
  AI_TEXT,
  DEFAULT_QUALITY,
  DEFAULT_STYLE,
  DEFAULT_TOOL,
  findTool,
  isHttpsUrl,
} from "../../utils/aiImageStudio.js";
import { validateMediaFile } from "../../utils/productMedia.js";

const TABS = [
  { id: "generate", label: AI_TEXT.tabGenerate, icon: Sparkles },
  { id: "improve", label: AI_TEXT.tabImprove, icon: Wand2 },
];

/**
 * AI image studio dialog: create an image from a description or improve one
 * (product image, a previous result, or a file from the device), preview the
 * results and add the good ones to the product. `studio` is
 * useAiImageStudio(); form fields are local and survive closing the dialog.
 */
export default function AiImageStudio({
  isOpen,
  onClose,
  studio,
  images = [],
  defaultPrompt = "",
}) {
  const [tab, setTab] = useState("generate");
  // null = untouched: follow the product name.
  const [prompt, setPrompt] = useState(null);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const [tool, setTool] = useState(DEFAULT_TOOL);
  const [editText, setEditText] = useState("");
  // { kind: "product" | "result" | "file", url?, file?, previewUrl?, label }
  const [source, setSource] = useState(null);
  const [fileError, setFileError] = useState(null);
  const fileInput = useRef(null);

  const promptValue = prompt ?? defaultPrompt;
  const needsText = Boolean(findTool(tool)?.needsText);
  const busy = Boolean(studio.busy);
  const full = studio.slotsLeft === 0;

  // Free the device file's preview when it's replaced or the editor closes.
  const previewUrl = source?.previewUrl;
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const productImages = images.filter(
    (img) => img.type !== "video" && isHttpsUrl(img.original),
  );
  // A result or device file picked as source is shown before the product's.
  const extraSource = source && source.kind !== "product" ? [source] : [];

  const pickFile = (file) => {
    const problem = validateMediaFile(file);
    if (problem) {
      setFileError(problem);
      return;
    }
    setFileError(null);
    setSource({
      kind: "file",
      file,
      previewUrl: URL.createObjectURL(file),
      label: AI_TEXT.sourceDevice,
    });
  };

  const improveResult = (result) => {
    setTab("improve");
    setSource({ kind: "result", url: result.url, label: result.label });
  };

  const submitGenerate = () =>
    studio.generate({ prompt: promptValue.trim(), style, quality });

  const submitImprove = () =>
    studio.improve({
      tool,
      text: editText.trim(),
      source:
        source?.kind === "file" ? { file: source.file } : { url: source.url },
    });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={AI_TEXT.title}
      subtitle={AI_TEXT.subtitle}
      icon={Sparkles}
      size="lg"
      dir="rtl"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {AI_TEXT.close}
        </Button>
      }
    >
      <div className="ai-studio">
        <SegmentedTabs
          tabs={TABS}
          activeTab={tab}
          onTabChange={setTab}
          variant="pill"
          ariaLabel={AI_TEXT.title}
        />

        {tab === "generate" ? (
          <div className="ai-studio-panel">
            <Field label={AI_TEXT.promptLabel} hint={AI_TEXT.promptHint}>
              <Textarea
                rows={3}
                maxLength={AI_PROMPT_MAX}
                placeholder={AI_TEXT.promptPlaceholder}
                value={promptValue}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </Field>
            <FormRow>
              <Field label={AI_TEXT.styleLabel}>
                <Select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  options={AI_IMAGE_STYLES.map((s) => ({
                    value: s.id,
                    label: s.label,
                  }))}
                />
              </Field>
              <Field label={AI_TEXT.qualityLabel}>
                <Select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  options={AI_IMAGE_QUALITIES.map((q) => ({
                    value: q.id,
                    label: q.label,
                  }))}
                />
              </Field>
            </FormRow>
            <div className="ai-studio-submit">
              <Button
                variant="primary"
                icon={Sparkles}
                onClick={submitGenerate}
                loading={studio.busy === "generate"}
                disabled={busy || !promptValue.trim()}
              >
                {AI_TEXT.generate}
              </Button>
            </div>
          </div>
        ) : (
          <div className="ai-studio-panel">
            <div className="form-group">
              <span className="form-label">{AI_TEXT.sourceLabel}</span>
              {productImages.length === 0 && extraSource.length === 0 && (
                <p className="form-hint">{AI_TEXT.sourceEmpty}</p>
              )}
              <ul className="ai-studio-sources">
                {[...extraSource, ...productImages].map((img, idx) => {
                  const src = img.previewUrl || img.url || img.original;
                  const active =
                    source === img ||
                    (source?.kind === "product" && source.url === img.original);
                  return (
                    <li key={`${src}-${idx}`}>
                      <button
                        type="button"
                        className={`ai-studio-source${
                          active ? " ai-studio-source--active" : ""
                        }`}
                        aria-pressed={active}
                        aria-label={
                          img.label ||
                          `صورة المنتج ${idx + 1 - extraSource.length}`
                        }
                        onClick={() =>
                          img.kind
                            ? setSource(img)
                            : setSource({
                                kind: "product",
                                url: img.original,
                                label: img.alt,
                              })
                        }
                      >
                        <img src={src} alt="" loading="lazy" />
                        {active && (
                          <span className="ai-studio-source-check">
                            <Check size={12} aria-hidden="true" />
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="ai-studio-device">
                <Button
                  size="small"
                  variant="secondary"
                  icon={Upload}
                  onClick={() => fileInput.current?.click()}
                >
                  {AI_TEXT.sourceDevice}
                </Button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="media-dropzone-input"
                  aria-label={AI_TEXT.sourceDevice}
                  tabIndex={-1}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) pickFile(file);
                    event.target.value = "";
                  }}
                />
                {fileError && (
                  <span className="form-error-msg">{fileError}</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <span className="form-label">{AI_TEXT.toolLabel}</span>
              <div className="ai-studio-tools">
                {AI_IMAGE_TOOLS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`ai-studio-tool${
                      tool === t.id ? " ai-studio-tool--active" : ""
                    }`}
                    aria-pressed={tool === t.id}
                    onClick={() => setTool(t.id)}
                  >
                    <strong>{t.label}</strong>
                    <span>{t.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {needsText && (
              <Field label={AI_TEXT.editLabel} hint={AI_TEXT.promptHint}>
                <Textarea
                  rows={2}
                  maxLength={AI_PROMPT_MAX}
                  placeholder={AI_TEXT.editPlaceholder}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
              </Field>
            )}

            <div className="ai-studio-submit">
              <Button
                variant="primary"
                icon={Wand2}
                onClick={submitImprove}
                loading={studio.busy === "improve"}
                disabled={busy || !source || (needsText && !editText.trim())}
              >
                {AI_TEXT.improve}
              </Button>
              {!source && (
                <span className="form-hint">{AI_TEXT.pickSource}</span>
              )}
            </div>
          </div>
        )}

        {busy && <Spinner label={AI_TEXT.working} />}
        {studio.error && <Alert tone="error">{studio.error}</Alert>}

        {studio.results.length > 0 && (
          <section className="ai-studio-results">
            <div>
              <h4 className="ai-studio-results-title">
                <ImagePlus size={16} aria-hidden="true" />
                {AI_TEXT.resultsTitle}
              </h4>
              <p className="form-hint">{AI_TEXT.resultsHint}</p>
            </div>
            {full && <Alert tone="warning">{AI_TEXT.full}</Alert>}
            <ul className="ai-studio-result-grid">
              {studio.results.map((result) => (
                <li key={result.id} className="ai-studio-result">
                  <div className="ai-studio-result-thumb">
                    <img src={result.url} alt={result.label} />
                  </div>
                  <p className="ai-studio-result-label">{result.label}</p>
                  {result.status === "attached" ? (
                    <Badge tone="success" icon={Check}>
                      {result.main ? AI_TEXT.attachedMain : AI_TEXT.attached}
                    </Badge>
                  ) : (
                    <div className="ai-studio-result-actions">
                      <Button
                        size="small"
                        variant="primary"
                        icon={Plus}
                        onClick={() => studio.attach(result.id)}
                        loading={result.status === "attaching"}
                        disabled={full && result.status === "ready"}
                      >
                        {AI_TEXT.attach}
                      </Button>
                      <IconButton
                        icon={Star}
                        label={AI_TEXT.attachMain}
                        tone="primary"
                        size={14}
                        onClick={() => studio.attach(result.id, { main: true })}
                        disabled={result.status !== "ready" || full}
                      />
                    </div>
                  )}
                  <Button
                    size="small"
                    variant="ghost"
                    icon={Wand2}
                    onClick={() => improveResult(result)}
                    disabled={busy}
                  >
                    {AI_TEXT.improveThis}
                  </Button>
                  {result.error && (
                    <p className="ai-studio-result-error">{result.error}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  );
}
