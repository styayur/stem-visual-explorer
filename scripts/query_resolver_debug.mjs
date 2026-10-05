import { explainQuery } from "../src/query/explanations.ts";
const query = process.argv.slice(2).join(" ");
if (!query) throw new Error("Usage: npm run debug:query -- <query>");
console.log(JSON.stringify({ query, ...explainQuery(query) }, null, 2));
