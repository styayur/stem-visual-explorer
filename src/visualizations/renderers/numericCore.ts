import runtime from "@jsxgraph-source/jxg.js";
import "@jsxgraph-source/jsxgraph.js";
import "@jsxgraph-source/base/point.js";
import "@jsxgraph-source/base/line.js";
import "@jsxgraph-source/base/polygon.js";
import "@jsxgraph-source/base/curve.js";
import "@jsxgraph-source/base/text.js";
import "@jsxgraph-source/base/transformation.js";
import type JXG from "jsxgraph";

// Register only the 2D primitives used by the adapter. Vite removes the parser
// at the module boundary; no third-party source is copied or modified on disk.
const core = runtime as typeof JXG;
core.Options.text.parse = false;
core.Options.infobox.parse = false;
export default core;
