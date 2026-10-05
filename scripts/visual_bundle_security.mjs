import assert from "node:assert/strict";
import ts from "typescript";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export function forbiddenExecution(source) {
  const tree = ts.createSourceFile(
    "asset.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  assert.equal(
    tree.parseDiagnostics.length,
    0,
    "production asset must parse as JavaScript",
  );
  const found = [];
  const calleeName = (n) => {
    if (ts.isParenthesizedExpression(n)) return calleeName(n.expression);
    if (
      ts.isBinaryExpression(n) &&
      n.operatorToken.kind === ts.SyntaxKind.CommaToken
    )
      return calleeName(n.right);
    if (ts.isIdentifier(n)) return n.text;
    if (
      ts.isPropertyAccessExpression(n) &&
      ["call", "apply", "bind"].includes(n.name.text)
    )
      return calleeName(n.expression);
    // JSXGraph's numeric property helper is also named .eval; it calls authored
    // callbacks or returns values. Only global-object members are JS execution.
    if (
      ts.isPropertyAccessExpression(n) &&
      ts.isIdentifier(n.expression) &&
      ["window", "globalThis", "self", "global"].includes(n.expression.text)
    )
      return n.name.text;
    if (
      ts.isElementAccessExpression(n) &&
      ts.isIdentifier(n.expression) &&
      ["window", "globalThis", "self", "global"].includes(n.expression.text) &&
      ts.isStringLiteral(n.argumentExpression)
    )
      return n.argumentExpression.text;
    return "";
  };
  const visit = (n) => {
    if (
      (ts.isCallExpression(n) || ts.isNewExpression(n)) &&
      ["eval", "Function"].includes(calleeName(n.expression))
    )
      found.push(n.getText(tree).slice(0, 120));
    ts.forEachChild(n, visit);
  };
  visit(tree);
  return found;
}
export async function checkVisualBundle(root = "dist") {
  const manifest = JSON.parse(
    await readFile(`${root}/.vite/manifest.json`, "utf8"),
  );
  const runtime = Object.values(manifest).find(
    (c) => c.src === "src/visualizations/GuidedVisualization.tsx",
  );
  assert.ok(runtime, "lazy runtime must be in build manifest");
  for (const lesson of ["shm", "ellipse", "linear"]) {
    const entry = Object.values(manifest).find(
      (c) => c.src === `src/visualizations/lessons/${lesson}.ts`,
    );
    assert.ok(
      entry?.isDynamicEntry,
      `${lesson} must be a lesson-specific dynamic entry`,
    );
    assert.notEqual(entry.file, runtime.file);
    assert.ok(
      !entry.imports?.some((k) =>
        manifest[k]?.src?.match(/lessons\/(shm|ellipse|linear)\.ts/),
      ),
      "lesson must not import siblings",
    );
  }
  const names = (await readdir(`${root}/assets`)).filter((n) =>
    n.endsWith(".js"),
  );
  for (const name of names)
    assert.deepEqual(
      forbiddenExecution(await readFile(`${root}/assets/${name}`, "utf8")),
      [],
      `forbidden executable AST in ${name}`,
    );
  // The build plugin validates source provenance, including absence of parser modules.
  const boundary = JSON.parse(
    await readFile(`${root}/visualization-boundary.json`, "utf8"),
  );
  assert.equal(boundary.jsxgraphVersion, "1.13.3");
  assert.equal(boundary.executableParserModules, 0);
  assert.ok(boundary.numericModules > 0);
  process.stdout.write(
    `VISUAL BUNDLE: ${names.length} parsed JS assets; no eval/Function call syntax; separate lesson entries and numeric-only provenance PASS\n`,
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  await checkVisualBundle();
