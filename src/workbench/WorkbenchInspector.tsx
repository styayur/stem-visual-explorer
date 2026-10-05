import { useWorkbenchStore } from "./workbenchStore";
import { useSettingsStore } from "../stores/settingsStore";
import { conceptById } from "../lib/concepts";
import { getLearningProfile } from "../learning/registry";
import { localize } from "../learning/types";
import { workbenchText as ui } from "./uiText";
import type { ConceptCapability } from "../capabilities/types";
import { openExternal } from "../lib/commands";
import { httpUrl } from "../lib/urls";
import { attempt } from "../stores/noticeStore";
import { lazy, Suspense } from "react";
const Equation = lazy(() => import("../visualizations/Equation"));
export default function WorkbenchInspector({
  capability,
  capabilities,
  expanded,
  navigate,
}: {
  capability?: ConceptCapability;
  capabilities: ConceptCapability[];
  expanded: boolean;
  navigate: (id: string) => void;
}) {
  const { session, lesson } = useWorkbenchStore();
  const locale = useSettingsStore((s) => s.settings.ui_locale);
  const c = conceptById.get(session!.conceptId)!,
    p = getLearningProfile(c.id);
  const t = (key: keyof typeof ui) => localize(ui[key], locale);
  const name = (id: string) => {
    const target = conceptById.get(id)!;
    return locale === "zh-CN"
      ? target.zh_cn
      : locale === "zh-TW"
        ? target.zh_tw
        : target.en;
  };
  const links = (ids: readonly string[]) =>
    ids.slice(0, 5).map((id) => (
      <button key={id} onClick={() => navigate(id)}>
        {name(id)}
      </button>
    ));
  return (
    <aside
      id="wb-inspector"
      className={`wb-inspector ${expanded ? "is-open" : ""}`}
      aria-label={t("inspector")}
    >
      <h2>{t("inspector")}</h2>
      {lesson && session!.activeSurface === "visualize" ? (
        <>
          <h3>{localize(lesson.definition.title, locale)}</h3>
          <p>
            {t("step")} {lesson.stepIndex + 1} /{" "}
            {lesson.definition.steps.length}
          </p>
          <h3>{t("invariant")}</h3>
          <p>{localize(lesson.step.invariant, locale)}</p>
          {(
            ["observation", "cause", "consequence", "misconception"] as const
          ).map((field) =>
            lesson.step[field] ? (
              <section key={field}>
                <h3>{t(field)}</h3>
                <p>{localize(lesson.step[field]!, locale)}</p>
              </section>
            ) : null,
          )}
          <h3>{t("parameters")}</h3>
          <dl>
            {Object.entries(lesson.parameters).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value.toFixed(2)}</dd>
              </div>
            ))}
          </dl>
          <h3>{t("equation")}</h3>
          <Suspense fallback={null}>
            {lesson.step.equations.map((eq) => (
              <Equation key={eq} value={eq} />
            ))}
          </Suspense>
          <h3>{t("prerequisites")}</h3>
          {links(p?.prerequisites ?? c.prerequisites)}
          {lesson.stepIndex + 1 < lesson.definition.steps.length && (
            <>
              <h3>{t("next")}</h3>
              <button onClick={lesson.actions.next}>
                {localize(
                  lesson.definition.steps[lesson.stepIndex + 1].title,
                  locale,
                )}
              </button>
            </>
          )}
        </>
      ) : capability ? (
        <>
          <h3>{localize(capability.title, locale)}</h3>
          <dl>
            {[
              ["provider", capability.provenance?.source],
              ["type", capability.type],
              ["language", capability.provenance?.language],
              [
                "rights",
                capability.provenance?.rightsStatus === "unknown"
                  ? t("unknown")
                  : capability.provenance?.rightsStatus,
              ],
            ].map(([key, value]) => (
              <div key={key}>
                <dt>{t(key as keyof typeof ui)}</dt>
                <dd>{value ?? t("unknown")}</dd>
              </div>
            ))}
          </dl>
          <h3>{t("concept")}</h3>
          {links(capability.conceptIds)}
          {capability.url && (
            <button
              onClick={() =>
                void attempt(() => openExternal(httpUrl(capability.url!)))
              }
            >
              {t("external")}
            </button>
          )}
        </>
      ) : (
        <>
          <h3>{t("concept")}</h3>
          <p>{name(c.id)}</p>
          <code>{c.id}</code>
          <h3>{t("subject")}</h3>
          <p>{c.subject}</p>
          <h3>{t("prerequisites")}</h3>
          {links(p?.prerequisites ?? c.prerequisites)}
          <h3>{t("next")}</h3>
          {links(p?.nextConcepts ?? [])}
          <h3>{t("related")}</h3>
          {links(c.related)}
          <h3>{t("capabilities")}</h3>
          <p>{capabilities.length}</p>
        </>
      )}
    </aside>
  );
}
