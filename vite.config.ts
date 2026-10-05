import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const source = fileURLToPath(
  new URL("./node_modules/jsxgraph/src", import.meta.url),
);
const disabledParser = fileURLToPath(
  new URL(
    "./src/visualizations/renderers/DisabledJessieCode.ts",
    import.meta.url,
  ),
);

// mode === "web" builds the static GitHub Pages site (served from a repo
// sub-path); the default mode builds the frontend for the Tauri desktop app.
export default defineConfig(({ mode }) => ({
  base: mode === "web" ? "/stem-visual-explorer/" : "/",
  plugins: [
    {
      name: "jsxgraph-numeric-only",
      enforce: "pre",
      resolveId(id, importer) {
        if (
          id.endsWith("/parser/jessiecode.js") &&
          importer?.replaceAll("\\", "/").includes("/jsxgraph/src/")
        )
          return disabledParser;
        if (
          id.endsWith("/parser/geonext.js") &&
          importer?.replaceAll("\\", "/").includes("/jsxgraph/src/")
        )
          return fileURLToPath(
            new URL(
              "./src/visualizations/renderers/DisabledGeonextParser.ts",
              import.meta.url,
            ),
          );
      },
      transform(code, id) {
        if (id.replaceAll("\\", "/").endsWith("/jsxgraph/src/utils/env.js")) {
          // ES2021 is this app's minimum target. No runtime compilation is needed
          // to detect ES6. Fail on upstream changes so upgrades get reviewed.
          const probe = 'new Function("(a = 0) => a");';
          if (!code.includes(probe))
            throw new Error("Review JSXGraph's ES6 probe before upgrading");
          return { code: code.replace(probe, "void 0;"), map: null };
        }
      },
      generateBundle(_options, bundle) {
        const modules = Object.values(bundle)
          .flatMap((item) => (item.type === "chunk" ? item.moduleIds : []))
          .map((id) => id.replaceAll("\\", "/"));
        const numeric = modules.filter((id) => id.includes("/jsxgraph/src/"));
        const parsers = numeric.filter((id) => id.includes("/parser/"));
        if (parsers.length)
          throw new Error(
            "Executable JSXGraph parser entered the production bundle",
          );
        const version = JSON.parse(
          readFileSync(
            new URL("./node_modules/jsxgraph/package.json", import.meta.url),
            "utf8",
          ),
        ).version;
        if (version !== "1.13.3")
          throw new Error("JSXGraph upgrades require explicit security review");
        this.emitFile({
          type: "asset",
          fileName: "visualization-boundary.json",
          source: JSON.stringify({
            jsxgraphVersion: version,
            executableParserModules: parsers.length,
            numericModules: numeric.length,
          }),
        });
      },
    },
    react(),
  ],
  resolve: { alias: { "@jsxgraph-source": source } },
  optimizeDeps: { exclude: ["@jsxgraph-source", "jsxgraph"] },
  build: { manifest: true },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // Exclude Rust output and local artifacts, including locked WebView2 profiles.
      ignored: ["**/src-tauri/**", "**/dist-release/**"],
    },
  },
}));
