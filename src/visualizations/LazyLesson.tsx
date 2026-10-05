import {
  useEffect,
  useState,
  Suspense,
  lazy,
  Component,
  type ReactNode,
} from "react";
import { loadVisualization } from "./registry";
import type { GuidedVisualizationDefinition, LessonContext } from "./types";
import { useSettingsStore } from "../stores/settingsStore";
import { workbenchText as ui } from "../workbench/uiText";
import { localize } from "../learning/types";
const Runtime = lazy(() => import("./GuidedVisualization"));
class RuntimeBoundary extends Component<
  { children: ReactNode; message: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">{this.props.message}</p>
    ) : (
      this.props.children
    );
  }
}
export default function LazyLesson({
  id,
  stepId,
  onContext,
}: {
  id: string;
  stepId?: string;
  onContext: (c: LessonContext | null) => void;
}) {
  const locale = useSettingsStore((s) => s.settings.ui_locale);
  const [definition, setDefinition] = useState<GuidedVisualizationDefinition>();
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    setDefinition(undefined);
    loadVisualization(id)
      .then((d) => {
        if (active) setDefinition(d);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [id, revision]);
  if (failed)
    return (
      <div role="alert">
        <p>{localize(ui.error, locale)}</p>
        <button onClick={() => setRevision((r) => r + 1)}>
          {localize(ui.retry, locale)}
        </button>
      </div>
    );
  return (
    <RuntimeBoundary
      key={`${id}:${revision}`}
      message={localize(ui.error, locale)}
    >
      <Suspense fallback={<p role="status">{localize(ui.loading, locale)}</p>}>
        {definition ? (
          <Runtime
            key={`${id}:${stepId}`}
            definition={definition}
            initialStepId={stepId}
            onContext={onContext}
          />
        ) : (
          <p role="status">{localize(ui.loading, locale)}</p>
        )}
      </Suspense>
    </RuntimeBoundary>
  );
}
