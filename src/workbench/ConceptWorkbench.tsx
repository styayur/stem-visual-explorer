import { useEffect, useRef, useState } from "react";
import { conceptById } from "../lib/concepts";
import { localize } from "../learning/types";
import { getLearningProfile } from "../learning/registry";
import { useSettingsStore } from "../stores/settingsStore";
import { useSearchStore } from "../stores/searchStore";
import { resolveConceptResources } from "../lib/webIndex";
import {
  capabilitiesForConcept,
  groupCapabilities,
} from "../capabilities/registry";
import type { ConceptCapability } from "../capabilities/types";
import type { SearchResult } from "../lib/types";
import { openExternal } from "../lib/commands";
import { httpUrl } from "../lib/urls";
import { attempt } from "../stores/noticeStore";
import LazyLesson from "../visualizations/LazyLesson";
import { useWorkbenchStore } from "./workbenchStore";
import { workbenchText as ui } from "./uiText";
import { projectGraph } from "./graph";
import { availableSurfaces } from "./surfaces";
import WorkbenchInspector from "./WorkbenchInspector";
import "./workbench.css";

export default function ConceptWorkbench({ onClose }: { onClose: () => void }) {
  const { session, open, surface, select, visit, setPalette, setLesson } =
    useWorkbenchStore();
  const locale = useSettingsStore((s) => s.settings.ui_locale);
  const [resources, setResources] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true),
    [errors, setErrors] = useState<string[]>([]);
  const [revision, setRevision] = useState(0),
    [filter, setFilter] = useState("all");
  const [navOpen, setNavOpen] = useState(false),
    [inspectorOpen, setInspectorOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const t = (key: keyof typeof ui) => localize(ui[key], locale);
  const id = session!.conceptId,
    concept = conceptById.get(id)!,
    profile = getLearningProfile(id);
  const label = (target: string) => {
    const c = conceptById.get(target)!;
    return locale === "zh-CN" ? c.zh_cn : locale === "zh-TW" ? c.zh_tw : c.en;
  };
  useEffect(() => {
    setFilter("all");
    setNavOpen(false);
    setInspectorOpen(false);
  }, [id]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setResources([]);
    setErrors([]);
    resolveConceptResources(id)
      .then((r) => {
        if (active) {
          setResources(r.resources);
          setErrors(r.errors);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setErrors(["index"]);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id, revision]);
  useEffect(() => {
    heading.current?.focus();
  }, [id, session?.activeSurface]);
  const capabilities = capabilitiesForConcept(id, resources);
  const selected = capabilities.find(
    (c) => c.id === session?.selectedCapabilityId,
  );
  const navigate = (
    target: string,
    type: "concept-link" | "graph" = "concept-link",
  ) => {
    open(target, { type, sourceConceptId: id });
    setNavOpen(false);
    setInspectorOpen(false);
  };
  const chips = (ids: readonly string[]) => (
    <div className="wb-chips">
      {ids
        .filter((target) => conceptById.has(target))
        .map((target) => (
          <button
            key={target}
            data-target-concept={target}
            onClick={() => navigate(target)}
          >
            {label(target)}
          </button>
        ))}
    </div>
  );
  const activate = (cap: ConceptCapability) => {
    if (cap.visualizationId) {
      surface("visualize");
      select(cap.id, cap.visualizationId);
    } else {
      surface("resources");
      select(cap.id);
      setInspectorOpen(true);
    }
  };
  const openLink = (cap: ConceptCapability) => {
    if (cap.url) void attempt(() => openExternal(httpUrl(cap.url!)));
  };
  const categories = [
    { id: "notes", type: "article" },
    { id: "textbooks", type: "textbook" },
    { id: "proofs", type: "proof" },
    { id: "simulations", type: "simulation" },
  ] as const;
  const external = capabilities.filter((c) => c.availability === "external");
  const list = external.filter((c) => filter === "all" || c.type === filter);
  const searchResources = () => {
    onClose();
    void useSearchStore.getState().runSearch(label(id));
  };
  return (
    <article
      className="concept-workbench"
      data-testid="learning-panel"
      data-workbench
      data-learning-concept={id}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.preventDefault();
          if (inspectorOpen) setInspectorOpen(false);
          else if (navOpen) setNavOpen(false);
          else onClose();
        }
      }}
    >
      <header className="wb-header">
        <div>
          <span className="wb-product">{t("title")}</span>
          <h1 ref={heading} tabIndex={-1}>
            {label(id)}
          </h1>
        </div>
        <div className="wb-header-actions">
          <button onClick={onClose}>{t("close")}</button>
          <button onClick={() => setPalette(true)} aria-label={t("palette")}>
            Ctrl+K
          </button>
        </div>
      </header>
      <div className="wb-mobile-controls">
        <button
          aria-expanded={navOpen}
          aria-controls="wb-navigation"
          onClick={() => setNavOpen((v) => !v)}
        >
          {t("navigation")}
        </button>
        <button
          aria-expanded={inspectorOpen}
          aria-controls="wb-inspector"
          onClick={() => setInspectorOpen((v) => !v)}
        >
          {t("inspector")}
        </button>
      </div>
      <div className="wb-layout">
        <nav
          id="wb-navigation"
          className={`wb-navigation ${navOpen ? "is-open" : ""}`}
          aria-label={t("navigation")}
        >
          {availableSurfaces(id).map((s) => (
            <button
              key={s}
              data-surface={s}
              aria-current={session?.activeSurface === s ? "page" : undefined}
              onClick={() => {
                surface(s);
                setNavOpen(false);
              }}
            >
              {t(s)}
            </button>
          ))}
          <div className="wb-trail">
            <h2>{t("trail")}</h2>
            <div className="wb-trail-controls">
              <button
                disabled={session!.cursor === 0}
                aria-label={t("back")}
                onClick={() => visit(session!.cursor - 1)}
              >
                ←
              </button>
              <button
                disabled={session!.cursor === session!.trail.length - 1}
                aria-label={t("forward")}
                onClick={() => visit(session!.cursor + 1)}
              >
                →
              </button>
            </div>
            <ol>
              {session!.trail.map((entry, i) => (
                <li key={i}>
                  <button
                    aria-current={i === session!.cursor ? "step" : undefined}
                    onClick={() => visit(i)}
                  >
                    {label(entry.conceptId)}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </nav>
        <section
          className="wb-main"
          aria-label={t(session!.activeSurface)}
          data-testid="work-surface"
          data-surface={session!.activeSurface}
        >
          <h2 className="wb-surface-title">{t(session!.activeSurface)}</h2>
          {session!.activeSurface === "overview" && (
            <>
              <p className="wb-semantic">
                {concept.en} · {concept.subject} · {concept.level.join(", ")}
              </p>
              <h3>{t("prerequisites")}</h3>
              {chips(profile?.prerequisites ?? concept.prerequisites)}
              <h3>{t("next")}</h3>
              {chips(profile?.nextConcepts ?? [])}
              <h3>{t("related")}</h3>
              {chips(concept.related)}
              <h3>{t("capabilities")}</h3>
              <div className="wb-capabilities">
                {groupCapabilities(capabilities).map((g) => (
                  <section key={g.group}>
                    <h4>{t(g.group)}</h4>
                    {g.items.slice(0, 6).map((c) => (
                      <button key={c.id} onClick={() => activate(c)}>
                        {localize(c.title, locale)}
                      </button>
                    ))}
                  </section>
                ))}
              </div>
              {profile && (
                <button
                  className="wb-primary"
                  onClick={() =>
                    activate(capabilities.find((c) => c.visualizationId)!)
                  }
                >
                  {t("open")}
                </button>
              )}
              {!profile && <p>{t("noLesson")}</p>}
            </>
          )}
          {session!.activeSurface === "learn" && (
            <>
              <h3>{t("objectives")}</h3>
              {profile ? (
                <ul>
                  {profile.learningObjectives.map((o, i) => (
                    <li key={i}>{localize(o, locale)}</li>
                  ))}
                </ul>
              ) : (
                <p>{t("noLesson")}</p>
              )}
              <h3>{t("prerequisites")}</h3>
              {chips(profile?.prerequisites ?? concept.prerequisites)}
              {profile && (
                <>
                  <h3>{t("path")}</h3>
                  <ol className="wb-path">
                    {profile.sequence.map((s, i) => (
                      <li key={s.id}>
                        <button
                          onClick={() => {
                            surface("visualize");
                            select(
                              s.visualizationId,
                              s.visualizationId,
                              s.stepId,
                            );
                          }}
                        >
                          <span>{i + 1}</span>
                          {localize(s.title, locale)}
                        </button>
                      </li>
                    ))}
                  </ol>
                  <button
                    className="wb-primary"
                    onClick={() =>
                      activate(capabilities.find((c) => c.visualizationId)!)
                    }
                  >
                    {t("open")}
                  </button>
                </>
              )}
            </>
          )}
          {session!.activeSurface === "visualize" && (
            <>
              {profile &&
                capabilities.filter((c) => c.visualizationId).length > 1 && (
                  <div className="wb-lesson-tabs">
                    {capabilities
                      .filter((c) => c.visualizationId)
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => select(c.id, c.visualizationId)}
                        >
                          {localize(c.title, locale)}
                        </button>
                      ))}
                  </div>
                )}
              <LazyLesson
                id={
                  session!.selectedVisualizationId ?? profile!.visualizations[0]
                }
                stepId={session!.selectedLearningStepId}
                onContext={setLesson}
              />
            </>
          )}
          {session!.activeSurface === "resources" && (
            <>
              <div className="wb-resource-tools">
                <button onClick={searchResources}>{t("search")}</button>
                <button onClick={() => setRevision((r) => r + 1)}>
                  {t("retry")}
                </button>
              </div>
              {loading && <p role="status">{t("loading")}</p>}
              {errors.length > 0 && (
                <p role="alert">
                  {t("partial")}: {errors.join(", ")}
                </p>
              )}
              <div className="wb-filters" aria-label={t("type")}>
                <button
                  aria-pressed={filter === "all"}
                  onClick={() => setFilter("all")}
                >
                  {t("all")}
                </button>
                {categories
                  .filter((g) => external.some((c) => c.type === g.type))
                  .map((g) => (
                    <button
                      key={g.id}
                      aria-pressed={filter === g.type}
                      onClick={() => setFilter(g.type)}
                    >
                      {t(g.id)}
                    </button>
                  ))}
              </div>
              <ul className="wb-resources" data-resource-concept={id}>
                {list.map((c) => (
                  <li key={c.id} data-capability-id={c.id}>
                    <button
                      className="wb-resource-title"
                      aria-pressed={selected?.id === c.id}
                      onClick={() => {
                        select(c.id);
                        setInspectorOpen(true);
                      }}
                    >
                      {localize(c.title, locale)}
                    </button>
                    <p>
                      {c.provenance?.source} ·{" "}
                      <span>
                        {c.type === "textbook"
                          ? t("textbook")
                          : c.resource?.result_type}
                      </span>
                    </p>
                    {c.description && <p>{localize(c.description, locale)}</p>}
                    <a
                      href={httpUrl(c.url!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        openLink(c);
                      }}
                    >
                      {t("external")}
                    </a>
                  </li>
                ))}
              </ul>
              {!loading && !external.length && <p>{t("noResources")}</p>}
            </>
          )}
          {session!.activeSurface === "graph" && (
            <div className="wb-graph" role="group" aria-label={t("graph")}>
              {(["current", "prerequisites", "next", "related"] as const).map(
                (relation) => {
                  const nodes = projectGraph(id).filter(
                    (n) => n.relation === relation,
                  );
                  return nodes.length ? (
                    <section key={relation}>
                      <h3>
                        {relation === "current" ? t("concept") : t(relation)}
                      </h3>
                      {nodes.map((n) => (
                        <button
                          key={n.id}
                          data-graph-concept={n.id}
                          aria-current={n.id === id ? "true" : undefined}
                          onClick={() => navigate(n.id, "graph")}
                        >
                          {label(n.id)}
                        </button>
                      ))}
                    </section>
                  ) : null;
                },
              )}
              <p className="wb-caption">{projectGraph(id).length} / 20</p>
            </div>
          )}
        </section>
        <WorkbenchInspector
          capability={selected}
          capabilities={capabilities}
          expanded={inspectorOpen}
          navigate={navigate}
        />
      </div>
    </article>
  );
}
