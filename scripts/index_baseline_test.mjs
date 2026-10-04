import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { report } from "./cli_output.mjs";

const root = mkdtempSync(join(tmpdir(), "sve-index-baseline-"));
const moduleUrl = pathToFileURL(join(process.cwd(), "scripts/index_baseline.mjs")).href;
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const commit = (value) => {
  writeFileSync(join(root, "snapshot.json"), JSON.stringify({ value }));
  git("add", "snapshot.json");
  git("-c", "user.name=Baseline Test", "-c", "user.email=test@example.invalid", "commit", "-m", value);
  return git("rev-parse", "HEAD");
};
const resolve = (explicit) => execFileSync(process.execPath, ["--input-type=module", "-e", `import {indexBaselineRef,indexFromGit} from ${JSON.stringify(moduleUrl)}; const ref=indexBaselineRef(); process.stdout.write(JSON.stringify({ref,data:indexFromGit(ref,"snapshot.json")}));`], {
  cwd: root, env: { ...process.env, SVE_INDEX_BASE_REF: explicit ?? "" }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
});
try {
  git("init", "-b", "main");
  const initial = commit("initial");
  const main = commit("current-main");
  git("update-ref", "refs/remotes/origin/main", main);
  git("switch", "-c", "feature");
  const feature = commit("candidate");
  assert.deepEqual(JSON.parse(resolve()), { ref: main, data: { value: "current-main" } });
  assert.equal(JSON.parse(resolve(feature)).ref, feature);
  assert.equal(JSON.parse(resolve("0000000000000000000000000000000000000000")).ref, main);
  assert.throws(() => resolve("unavailable-ref"), "Explicit missing base must fail, never silently weaken comparison");
  git("switch", "main");
  assert.equal(JSON.parse(resolve()).ref, initial, "Main HEAD compares against its prior snapshot");
  report("Index baseline: local merge-base, explicit CI ref, main parent and invalid-ref gates PASS");
} finally {
  rmSync(root, { recursive: true, force: true });
}
