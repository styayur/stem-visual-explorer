import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolveQuery } from "../src/query/resolve.ts";
import { concepts } from "../src/lib/concepts.ts";
const fixture = JSON.parse(
  readFileSync("tests/query-resolver-v2.json", "utf8"),
);
const queries = [
  ...fixture.cases.map((c) => c.query),
  ...concepts.flatMap((c) => [c.en, c.zh_cn, c.zh_tw]),
  ...Array.from({ length: 30 }, (_, i) => "(".repeat(i * 10) + "∇×"),
  ...JSON.parse(
    readFileSync("scripts/fixtures/adversarial/queries.json", "utf8"),
  ).map((c) => c.query),
];
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
      "query_resolver",
    ],
    {
      input: JSON.stringify(queries),
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    },
  ),
);
for (let i = 0; i < queries.length; i++)
  assert.deepEqual(rust[i], resolveQuery(queries[i]), queries[i]);
console.log(
  `Resolver v2 TS/Rust parity: ${queries.length} full contracts (normalization, groups, ranking, integer scores, evidence, status, confidence and residuals) PASS`,
);
