import {
  Component,
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { conceptById } from "../lib/concepts";
import type { Concept } from "../lib/concepts";
import type { UiLocale } from "../lib/types";
import { useSettingsStore } from "../stores/settingsStore";
import { useSearchStore } from "../stores/searchStore";
import { openExternal } from "../lib/commands";
import { httpUrl } from "../lib/urls";
import { attempt } from "../stores/noticeStore";
import { getLearningProfile } from "./registry";
import { localize } from "./types";
import { learningText as ui } from "./uiText";

// No JSXGraph, KaTeX or full lesson definitions enter the search bundle.
const GuidedVisualization = lazy(
  () => import("../visualizations/GuidedVisualization"),
);
export const conceptLabel = (c: Concept, locale: UiLocale) =>
  locale === "zh-CN" ? c.zh_cn : locale === "zh-TW" ? c.zh_tw : c.en;

class LessonBoundary extends Component<
  { children: ReactNode; message: string; retryLabel: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert">
        <p>{this.props.message}</p>
        <button type="button" onClick={() => this.setState({ failed: false })}>
          {this.props.retryLabel}
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

export default function ConceptLearningPanel({
  conceptId,
  onClose,
  onConcept,
}: {
  conceptId: string;
  onClose: () => void;
  onConcept: (id: string) => void;
}) {
  const locale = useSettingsStore((s) => s.settings.ui_locale);
  const response = useSearchStore((s) => s.response);
  const runSearch = useSearchStore((s) => s.runSearch);
  const concept = conceptById.get(conceptId);
  const profile = getLearningProfile(conceptId);
  const heading = useRef<HTMLHeadingElement>(null);
  const [lesson, setLesson] = useState<{ id: string; stepId?: string } | null>(
    null,
  );
  const t = (key: keyof typeof ui) => localize(ui[key], locale);
  useEffect(() => {
    heading.current?.focus();
  }, [conceptId]);
  if (!concept) return null;
  const chips = (ids: string[]) => (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => {
        const c = conceptById.get(id);
        return c ? (
          <button
            type="button"
            className="learning-chip"
            key={id}
            onClick={() => onConcept(id)}
          >
            {conceptLabel(c, locale)}
          </button>
        ) : null;
      })}
    </div>
  );
  const resources = (response?.results ?? []).filter(
    (r) =>
      r.concept_ids?.includes(conceptId) ||
      r.explanation?.matched.some(
        (m) => m.concept_id === conceptId && m.tier !== "exploratory",
      ),
  );
  const openLesson = (id: string, stepId?: string) => setLesson({ id, stepId });
  return (
    <article
      className="concept-learning-panel overflow-y-auto p-4 sm:p-6"
      data-testid="learning-panel"
      data-learning-concept={conceptId}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <button
            className="learning-link mb-3"
            type="button"
            onClick={onClose}
          >
            {t("back")}
          </button>
          <h1 ref={heading} tabIndex={-1} className="text-xl font-semibold">
            {conceptLabel(concept, locale)}
            {locale !== "en" && (
              <span className="ml-3 text-base font-normal text-zinc-500 dark:text-zinc-400">
                {concept.en}
              </span>
            )}
          </h1>
        </div>
        <section aria-label={t("overview")}>
          <h2 className="learning-section-title">{t("overview")}</h2>
          {profile ? (
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {profile.learningObjectives.map((o, i) => (
                <li key={i}>{localize(o, locale)}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm">{t("unsupported")}</p>
          )}
        </section>
        <section>
          <h2 className="learning-section-title">{t("prerequisites")}</h2>
          {chips(profile?.prerequisites ?? concept.prerequisites)}
        </section>
        {profile && (
          <>
            <section>
              <h2 className="learning-section-title">{t("path")}</h2>
              <ol className="learning-path">
                {profile.sequence.map((stage, i) => (
                  <li key={stage.id}>
                    <button
                      type="button"
                      onClick={() =>
                        openLesson(stage.visualizationId, stage.stepId)
                      }
                    >
                      <span className="learning-stage-index">{i + 1}</span>
                      {localize(stage.title, locale)}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
            <section aria-label={t("guided")}>
              <h2 className="learning-section-title">{t("guided")}</h2>
              {lesson ? (
                <LessonBoundary
                  key={`${lesson.id}-${lesson.stepId}`}
                  message={t("loadError")}
                  retryLabel={t("retry")}
                >
                  <Suspense fallback={<p role="status">{t("loading")}</p>}>
                    <GuidedVisualization
                      visualizationId={lesson.id}
                      initialStepId={lesson.stepId}
                    />
                  </Suspense>
                </LessonBoundary>
              ) : (
                profile.visualizations.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="learning-open"
                    onClick={() => openLesson(id)}
                  >
                    {t("open")}
                  </button>
                ))
              )}
            </section>
          </>
        )}
        <section>
          <h2 className="learning-section-title">{t("resources")}</h2>
          <button
            type="button"
            className="learning-link mb-3 text-sm"
            onClick={() => {
              onClose();
              void runSearch(conceptLabel(concept, locale));
            }}
          >
            {t("searchResources")}
          </button>
          {resources.length ? (
            <ul className="space-y-2">
              {resources.map((r) => (
                <li key={r.id}>
                  <a
                    className="learning-link"
                    href={httpUrl(r.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      void attempt(() => openExternal(httpUrl(r.url)));
                    }}
                  >
                    {r.title}
                  </a>
                  <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {r.source_name}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              {t("noResources")}
            </p>
          )}
        </section>
        {profile?.textbookReferences?.length ? (
          <section>
            <h2 className="learning-section-title">{t("textbooks")}</h2>
            <ul className="space-y-3 text-sm">
              {profile.textbookReferences.map((reference) => (
                <li key={reference.section}>
                  <a
                    className="learning-link"
                    href={httpUrl(reference.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    lang={reference.language}
                    onClick={(e) => {
                      e.preventDefault();
                      void attempt(() => openExternal(httpUrl(reference.url)));
                    }}
                  >
                    {reference.collection} · {reference.book} ·{" "}
                    {reference.section}
                  </a>
                  <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {t("externalTextbook")}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section>
          <h2 className="learning-section-title">{t("related")}</h2>
          {chips([
            ...new Set([...(profile?.nextConcepts ?? []), ...concept.related]),
          ])}
        </section>
      </div>
    </article>
  );
}
