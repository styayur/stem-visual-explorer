import { useEffect, useMemo, useReducer, useState } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { learningText as ui } from "../learning/uiText";
import { localize } from "../learning/types";
import { getVisualization } from "./definitions";
import { initialLessonState, reduceLesson } from "./stateMachine";
import { buildScene, currentMatrix } from "./scenes";
import { clamp, determinant, ellipseState, orientation, TAU } from "./math";
import VisualizationRenderer from "./renderers/VisualizationRenderer";
import Equation from "./Equation";
import "./visualizations.css";

export default function GuidedVisualization({
  visualizationId,
  initialStepId,
}: {
  visualizationId: string;
  initialStepId?: string;
}) {
  const definition = getVisualization(visualizationId);
  const locale = useSettingsStore((s) => s.settings.ui_locale);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );
  const t = (key: keyof typeof ui) => localize(ui[key], locale);
  if (!definition)
    throw new Error(`Unknown static visualization: ${visualizationId}`);
  const [state, dispatch] = useReducer(
    (
      state: ReturnType<typeof initialLessonState>,
      action: Parameters<typeof reduceLesson>[2],
    ) => reduceLesson(definition, state, action),
    initialLessonState(
      definition,
      Math.max(
        0,
        definition.steps.findIndex((s) => s.id === initialStepId),
      ),
    ),
  );
  const step = definition.steps[state.stepIndex];
  const frame = useMemo(
    () => buildScene(definition, state),
    [definition, state],
  );

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(motion.matches);
      if (motion.matches) dispatch({ type: "pause" });
    };
    motion.addEventListener("change", update);
    const observer = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains("dark")),
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => {
      motion.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    if (state.status !== "playing" || reducedMotion) return;
    let request = 0,
      previous: number | undefined;
    const tick = (now: number) => {
      if (previous !== undefined)
        dispatch({ type: "tick", dt: (now - previous) / 1000 });
      previous = now;
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    const visibility = () => {
      if (document.hidden) dispatch({ type: "pause" });
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(request);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [state.status, reducedMotion]);

  const onDrag = (kind: "mass" | "ellipse-point", x: number, y: number) => {
    if (kind === "mass")
      dispatch({ type: "parameters", values: { A: clamp(x, 0.2, 2) } });
    else {
      const { b } = ellipseState(state.parameters.a, state.parameters.c, 0);
      const theta = (Math.atan2(y / b, x / state.parameters.a) + TAU) % TAU;
      dispatch({ type: "parameters", values: { theta } });
    }
  };
  const sign = orientation(determinant(currentMatrix(definition, state)));
  return (
    <section
      className="guided-lesson"
      data-testid="guided-lesson"
      data-lesson-id={definition.id}
      data-step-index={state.stepIndex}
      data-playback={state.status}
    >
      <div className="lesson-heading">
        <h3>{localize(definition.title, locale)}</h3>
        <span>
          {t("step")} {state.stepIndex + 1} / {definition.steps.length}
        </span>
      </div>
      <div className="lesson-layout">
        <div className="lesson-visual">
          <VisualizationRenderer
            renderer={definition.renderer}
            frame={frame}
            highlights={step.highlights}
            locale={locale}
            dark={dark}
            description={`${t("scene")} ${localize(step.title, locale)}. ${localize(step.invariant, locale)}`}
            onDrag={onDrag}
          />
          <p className="lesson-caption">
            {t(
              step.scene.family === "shm"
                ? "arrowScale"
                : step.scene.family === "ellipse"
                  ? "ellipseConstraint"
                  : "linearReadout",
            )}
          </p>
          <dl className="lesson-readouts" data-testid="lesson-readouts">
            {frame.readouts.map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd>
                  {(Math.abs(r.value) < 1e-10 ? 0 : r.value).toFixed(3)}{" "}
                  {r.unit}
                </dd>
              </div>
            ))}
          </dl>
          {step.scene.family === "linear" && (
            <p className="orientation-readout" data-testid="orientation">
              {t(
                sign === 0 ? "collapsed" : sign > 0 ? "preserved" : "reversed",
              )}
            </p>
          )}
        </div>
        <div className="lesson-reasoning">
          <div aria-live="polite" aria-atomic="true">
            <h4 data-testid="step-title">{localize(step.title, locale)}</h4>
            <p>{localize(step.explanation, locale)}</p>
          </div>
          <div className="lesson-invariant">
            <strong>{t("invariant")}</strong>
            <p>{localize(step.invariant, locale)}</p>
          </div>
          {step.equations.map((e) => (
            <Equation key={e} value={e} />
          ))}
          {step.scene.family === "linear" && (
            <Equation
              value={`A=\\begin{pmatrix}${state.parameters.a.toFixed(2)}&${state.parameters.b.toFixed(2)}\\\\${state.parameters.c.toFixed(2)}&${state.parameters.d.toFixed(2)}\\end{pmatrix}`}
            />
          )}
          {step.controls.length > 0 && (
            <fieldset>
              <legend>{t("parameters")}</legend>
              {step.controls.map((control) => {
                const parameter = definition.parameters.find(
                  (p) => p.id === control.parameterId,
                )!;
                const max =
                  step.scene.family === "ellipse" && parameter.id === "c"
                    ? Math.min(parameter.max, state.parameters.a - 0.1)
                    : parameter.max;
                return (
                  <label className="lesson-parameter" key={parameter.id}>
                    <span>
                      {localize(parameter.label, locale)}
                      <output>
                        {state.parameters[parameter.id].toFixed(2)}{" "}
                        {parameter.unit}
                      </output>
                    </span>
                    <input
                      type="range"
                      min={parameter.min}
                      max={max}
                      step={parameter.step}
                      value={state.parameters[parameter.id]}
                      aria-label={localize(parameter.label, locale)}
                      data-parameter-id={parameter.id}
                      onChange={(e) =>
                        dispatch({
                          type: "parameters",
                          values: { [parameter.id]: e.target.valueAsNumber },
                        })
                      }
                    />
                  </label>
                );
              })}
            </fieldset>
          )}
          {definition.presets.length > 0 &&
            state.stepIndex === definition.steps.length - 1 && (
              <fieldset>
                <legend>{t("presets")}</legend>
                <div className="lesson-presets">
                  {definition.presets.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      data-preset-id={p.id}
                      onClick={() =>
                        dispatch({ type: "parameters", values: p.parameters })
                      }
                    >
                      {localize(p.title, locale)}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
        </div>
      </div>
      {reducedMotion && (
        <p className="lesson-caption" role="status">
          {t("reduced")}
        </p>
      )}
      <div className="lesson-controls">
        <button
          type="button"
          disabled={state.stepIndex === 0}
          onClick={() => dispatch({ type: "seek", index: state.stepIndex - 1 })}
        >
          {t("previous")}
        </button>
        <button
          type="button"
          disabled={state.stepIndex === definition.steps.length - 1}
          onClick={() => dispatch({ type: "seek", index: state.stepIndex + 1 })}
        >
          {t("next")}
        </button>
        <button
          type="button"
          disabled={reducedMotion || step.scene.motion === "none"}
          onClick={() =>
            dispatch(
              state.status === "playing"
                ? { type: "pause" }
                : { type: "play", reducedMotion },
            )
          }
        >
          {t(state.status === "playing" ? "pause" : "play")}
        </button>
        <button type="button" onClick={() => dispatch({ type: "restart" })}>
          {t("restart")}
        </button>
      </div>
    </section>
  );
}
