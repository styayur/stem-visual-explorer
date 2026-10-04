import { execFileSync } from "node:child_process";

const git = (args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }).trim();
/** Local Git only: explicit CI base, otherwise merge-base with main. On main compare its parent. */
export function indexBaselineRef() {
  const explicit = process.env.SVE_INDEX_BASE_REF;
  if (explicit && !/^0+$/.test(explicit)) return git(["rev-parse", "--verify", `${explicit}^{commit}`]);
  const head = git(["rev-parse", "HEAD"]);
  const base = git(["merge-base", "HEAD", "refs/remotes/origin/main"]);
  return base === head ? git(["rev-parse", "HEAD^"]) : base;
}
export function indexFromGit(ref, path) {
  return JSON.parse(execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
}
