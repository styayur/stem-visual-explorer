import runtime from "@jsxgraph-source/jxg.js";
const disabled = () => {
  throw new Error("Geonext expression conversion is disabled");
};
const parser = { geonext2JS: disabled, findDependencies: disabled };
(runtime as { GeonextParser: typeof parser }).GeonextParser = parser;
export default parser;
