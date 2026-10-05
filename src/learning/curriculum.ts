import { shmReferences, ellipseReferences } from "./textbooks.ts";
import type { TextbookReference } from "./types";
export interface CurriculumSource {
  id: string;
  title: string;
  language: string;
  resolveConcept: (conceptId: string) => TextbookReference[];
}
export const curriculumSources: readonly CurriculumSource[] = [
  {
    id: "shulihua",
    title: "数理化自学丛书",
    language: "zh-CN",
    resolveConcept: (id) =>
      [...shmReferences, ...ellipseReferences].filter((r) =>
        r.conceptIds.includes(id),
      ),
  },
];
export const curriculumReferences = (id: string) =>
  curriculumSources.flatMap((s) => s.resolveConcept(id));
