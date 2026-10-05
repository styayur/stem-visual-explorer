import { report as printReport } from "./cli_output.mjs";
import { explainQuery } from "../src/query/explanations.ts";
const query = process.argv.slice(2).join(" ");
if (!query) throw new Error("Usage: npm run debug:query -- <query>");
printReport(JSON.stringify({ query, ...explainQuery(query) }, null, 2));
