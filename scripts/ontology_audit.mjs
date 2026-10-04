import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { concepts, conceptNames, normalizeTerm } from "../src/lib/concepts.ts";
const read = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const manifest = read("public/index/manifest.json");
const known = new Set(
  concepts
    .flatMap((c) => [...conceptNames(c), ...c.aliases.map((a) => a.text)])
    .map(normalizeTerm),
);
const stop = new Set(
  "explore watch simulator definition change examples between through graphics time drag different live your miscellaneous build calculating find linear theorem discrete model simple discover rule systems numbers understanding changing surface variables where calculate intuition number product then length objects plane properties variable volume when compare calculator essays formula free light field line equation system curve a an the of to in for with and or by on how what why is are this that introduction interactive simulation applet using from about html physics math mathematics page home click here lab www com org".split(
    " ",
  ),
);
const phrases = new Map();
for (const p of manifest)
  for (const e of read(`public/index/${p.file}`).entries) {
    const seen = new Set();
    for (const [field, text] of [
      ["title", e.title],
      ["category", e.category ?? ""],
      ...e.tags.map((t) => ["tags", t]),
      ["description", e.description ?? ""],
    ]) {
      const words = normalizeTerm(text).match(/[a-z][a-z'-]+/g) ?? [];
      for (let n = 1; n <= 4; n++)
        for (let i = 0; i + n <= words.length; i++) {
          const part = words.slice(i, i + n);
          if (stop.has(part[0]) || stop.has(part.at(-1))) continue;
          const phrase = part.join(" ");
          if (known.has(phrase) || phrase.length < 4) continue;
          const key = `${phrase}\0${e.url}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const item = phrases.get(phrase) ?? {
            phrase,
            resource_count: 0,
            providers: new Set(),
            fields: new Set(),
            examples: [],
          };
          item.resource_count++;
          item.providers.add(p.id);
          item.fields.add(field);
          if (item.examples.length < 3)
            item.examples.push({ title: e.title, url: e.url });
          phrases.set(phrase, item);
        }
    }
  }
const rows = [...phrases.values()]
  .filter(
    (x) =>
      x.resource_count >= 2 && (x.fields.has("title") || x.fields.has("tags")),
  )
  .sort(
    (a, b) =>
      b.resource_count - a.resource_count || a.phrase.localeCompare(b.phrase),
  )
  .map((x) => ({
    ...x,
    providers: [...x.providers].sort(),
    fields: [...x.fields].sort(),
  }));
mkdirSync("artifacts", { recursive: true });
writeFileSync(
  "artifacts/unmapped-resource-terms.json",
  JSON.stringify(
    {
      method:
        "Unmapped 1–4 word phrases occurring in >=2 resources; review suggestions, never automatic concepts.",
      candidates: rows,
    },
    null,
    2,
  ) + "\n",
);
console.log(`${rows.length} candidate phrases for human review`);
