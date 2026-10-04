import { report as printReport } from "./cli_output.mjs";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { annotateResource } from "../src/lib/concepts.ts";
const read = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const root = process.env.SVE_INDEX_OUT ?? "public/index";
const manifest = read(`${root}/manifest.json`);
for (const provider of manifest) {
  const path = `${root}/${provider.file}`;
  const index = read(path);
  for (const e of index.entries)
    Object.assign(e, annotateResource(e.title, e.tags, e.description, e.url));
  index.schema_version = 2;
  provider.schema_version = 2;
  // Annotation migration does not change the source fetch timestamp.
  const encoded = JSON.stringify(index) + "\n";
  writeFileSync(path, encoded);
  provider.content_hash = createHash("sha256").update(encoded).digest("hex");
}
writeFileSync(
  `${root}/manifest.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
printReport(
  "Deterministic schema v2 annotation complete; source dates preserved",
);
