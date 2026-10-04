import runtime from "@jsxgraph-source/jxg.js";

// Board lifecycle expects this interface even when all geometry is numeric.
// Every expression entry point fails closed instead of interpreting source.
class DisabledJessieCode {
  creator = { clearCache() {} };
  use() {}
  snippet(): never {
    throw new Error("Executable visualization expressions are disabled");
  }
  parse(): never {
    throw new Error("Executable visualization expressions are disabled");
  }
}
(runtime as { JessieCode: typeof DisabledJessieCode }).JessieCode =
  DisabledJessieCode;
export default DisabledJessieCode;
