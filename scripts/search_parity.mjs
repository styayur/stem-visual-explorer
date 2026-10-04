import { report as printReport } from "./cli_output.mjs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { goldenOutput } from "./search_golden.mjs";
const rust = JSON.parse(
  execFileSync(
    "cargo",
    [
      "run",
      "--quiet",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--no-default-features",
      "--example",
      "search_golden",
    ],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  ),
);
assert.deepEqual(rust, goldenOutput());
printReport(
  "TS/Rust golden parity: exact query groups, variants, match modes, ranking scores and explanations PASS",
);
