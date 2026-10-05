// Eager compatibility read model for offline schema/math tests only.
// Production uses registry.ts and lesson-specific imports.
import { guidedShm } from "./lessons/shm.ts";
import { guidedEllipse } from "./lessons/ellipse.ts";
import { guidedLinear } from "./lessons/linear.ts";
export { guidedShm, guidedEllipse, guidedLinear };
export const visualizationDefinitions = [guidedShm, guidedEllipse, guidedLinear] as const;
export const getVisualization = (id: string) => visualizationDefinitions.find(d => d.id === id);
