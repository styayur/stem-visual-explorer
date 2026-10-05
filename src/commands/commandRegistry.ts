import { conceptById } from "../lib/concepts.ts";
import { projectGraph } from "../workbench/graph.ts";
import { workbenchText as ui } from "../workbench/uiText.ts";
import { learningText } from "../learning/uiText.ts";
import { localize } from "../learning/types.ts";
import { availableSurfaces } from "../workbench/surfaces.ts";
import type { UiLocale } from "../lib/types";
import type { WorkbenchSurface } from "../workbench/types";
import type { LessonContext } from "../visualizations/types";
export interface CommandContext {
  conceptId?: string;
  locale: UiLocale;
  lesson?: LessonContext | null;
  surface: (s: WorkbenchSurface) => void;
  navigate: (id: string) => void;
  focusSearch: () => void;
  copy: (name: string) => void;
}
export interface LocalCommand {
  id: string;
  title: string;
  run: () => void;
}
export function registeredCommands(context: CommandContext): LocalCommand[] {
  const { conceptId, locale, lesson } = context;
  const t = (key: keyof typeof ui) => localize(ui[key], locale);
  const commands: LocalCommand[] = [
    { id: "search", title: t("searchFocus"), run: context.focusSearch },
  ];
  if (!conceptId || !conceptById.has(conceptId)) return commands;
  for (const s of availableSurfaces(conceptId))
    commands.push({
      id: `surface:${s}`,
      title: `${t("openSurface")} ${t(s)}`,
      run: () => context.surface(s),
    });
  const concept = conceptById.get(conceptId)!;
  commands.push({
    id: "copy",
    title: t("copy"),
    run: () => context.copy(concept.en),
  });
  for (const node of projectGraph(conceptId).slice(1)) {
    const c = conceptById.get(node.id)!;
    const label =
      locale === "zh-CN" ? c.zh_cn : locale === "zh-TW" ? c.zh_tw : c.en;
    commands.push({
      id: `concept:${node.id}`,
      title: `${t("go")} ${label} (${t(node.relation as "prerequisites" | "related" | "next")})`,
      run: () => context.navigate(node.id),
    });
  }
  if (lesson) {
    if (lesson.stepIndex > 0)
      commands.push({
        id: "lesson:previous",
        title: localize(learningText.previous, locale),
        run: lesson.actions.previous,
      });
    if (lesson.stepIndex < lesson.definition.steps.length - 1)
      commands.push({
        id: "lesson:next",
        title: localize(learningText.next, locale),
        run: lesson.actions.next,
      });
    if (lesson.status === "playing")
      commands.push({
        id: "lesson:pause",
        title: localize(learningText.pause, locale),
        run: lesson.actions.pause,
      });
    else if (lesson.canPlay)
      commands.push({
        id: "lesson:play",
        title: localize(learningText.play, locale),
        run: lesson.actions.play,
      });
    commands.push({
      id: "lesson:restart",
      title: localize(learningText.restart, locale),
      run: lesson.actions.restart,
    });
  }
  return commands;
}
