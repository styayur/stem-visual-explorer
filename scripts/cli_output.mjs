import { format } from "node:util";

/** Intentional command-line output, including machine-readable JSON modes. */
export function report(...values) {
  process.stdout.write(`${format(...values)}\n`);
}
