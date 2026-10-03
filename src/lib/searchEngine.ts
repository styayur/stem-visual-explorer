// Deterministic, browser-side search: a faithful port of the Rust
// `search::{query, normalize, ranking}` modules. No AI, no network.
import type { ResultType, SearchResult } from "./types";
import { normalizeConcepts, matches, matchMode, normalizeTerm, type ConceptGroup, type QueryVariant } from "./concepts.ts";

export interface ParsedQuery {
  raw: string;
  terms: string[];
  phrases: string[];
  siteFilter: string | null;
  typeFilter: ResultType | null;
}

export interface NormalizedQuery {
  raw: string;
  groups: ConceptGroup[];
  explore: boolean;
  tokens: string[];
  variants: QueryVariant[];
  concept_ids: string[];
  phrases: string[];
  siteFilter: string | null;
  typeFilter: ResultType | null;
}

const RESULT_TYPE_VALUES: ResultType[] = [
  "article",
  "interactive",
  "simulation",
  "applet",
  "experiment",
  "visualization",
  "video",
];

function parseResultType(s: string): ResultType | null {
  const v = s as ResultType;
  return RESULT_TYPE_VALUES.includes(v) ? v : null;
}

/** Tiny command-syntax parser: site:/source:/type:/"exact phrase". */
export function parseQuery(raw: string): ParsedQuery {
  const out: ParsedQuery = {
    raw: raw.trim(),
    terms: [],
    phrases: [],
    siteFilter: null,
    typeFilter: null,
  };

  const tokens: string[] = [];
  let i = 0;
  const s = raw;

  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '"') {
      i++;
      let phrase = "";
      while (i < s.length && s[i] !== '"') {
        phrase += s[i++];
      }
      if (i < s.length) i++;
      if (phrase.trim()) out.phrases.push(whitespace(phrase).toLowerCase());
      continue;
    }
    let start = i;
    while (i < s.length && !/\s/.test(s[i])) i++;
    tokens.push(s.slice(start, i));
  }

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower.startsWith("site:") && lower.length > 5) {
      out.siteFilter = lower.slice(5);
    } else if (lower.startsWith("source:") && lower.length > 7) {
      out.siteFilter = lower.slice(7);
    } else if (lower.startsWith("type:") && lower.length > 5) {
      out.typeFilter = parseResultType(lower.slice(5));
    } else {
      out.terms.push(token);
    }
  }
  return out;
}

export function expand(parsed: ParsedQuery): NormalizedQuery {
  const explore = parsed.terms.some(t => t.toLowerCase() === "related:true");
  const normalized = normalizeConcepts(parsed.terms.filter(t => t.toLowerCase() !== "related:true"), parsed.phrases);
  // Preserve expanded_terms for old clients; matching/scoring uses full variants.
  const tokens = [...new Set(normalized.variants.flatMap((v) => [v.text, ...v.text.split(/\s+/)]))].sort();
  return { raw: parsed.raw, tokens, explore, ...normalized, phrases: parsed.phrases,
    siteFilter: parsed.siteFilter, typeFilter: parsed.typeFilter };
}

export function parseAndExpand(raw: string): NormalizedQuery {
  return expand(parseQuery(raw));
}

function whitespace(s: string): string {
  return s.split(/\s+/).filter(Boolean).join(" ");
}

export interface IndexEntryLike {
  title: string;
  description: string | null;
  url: string;
  result_type: ResultType;
  tags: string[];
  thumbnail: string | null;
  concept_ids?: string[];
  concept_evidence?: Record<string,string[]>;
  subject?: string[];
  language?: string;
}

export interface MatchEvidence {
  concept_id: string | null; group: string; field: "title" | "concepts" | "tags" | "description";
  tier: "direct" | "equivalent" | "exploratory"; text: string;
}
export interface SearchExplanation {
  matched: MatchEvidence[]; matched_concept_ids: string[];
  match_tier: "all-groups" | "partial" | "exploratory" | "browse" | "none";
  groups_matched: number; groups_total: number; score_components: Record<string,number>;
}
function fieldEvidence(entry: IndexEntryLike, variants: QueryVariant[], group:string):MatchEvidence[] {
  const out:MatchEvidence[]=[];
  for(const [field,values] of [["title",[entry.title]],["tags",entry.tags],["description",[entry.description??""]]] as const) {
    const v=variants.find(v=>values.some(value=>matches(value,v)));
    if(v) out.push({concept_id:v.concept_id,group,field,tier:v.tier,text:v.text});
  }
  const v=variants.find(v=>v.concept_id && entry.concept_ids?.includes(v.concept_id));
  if(v) out.push({concept_id:v.concept_id,group,field:"concepts",tier:v.tier,text:v.text});
  return out;
}
export function explainMatch(query:NormalizedQuery,entry:IndexEntryLike):SearchExplanation {
  const matched=query.groups.flatMap(g=>fieldEvidence(entry,g.variants,g.id));
  const groupsMatched=new Set(matched.map(m=>m.group)).size;
  const all=groupsMatched===query.groups.length;
  if(query.explore && !all) matched.push(...fieldEvidence(entry,query.variants.filter(v=>v.tier==="exploratory"),"exploratory"));
  const exploratory=matched.some(m=>m.tier==="exploratory");
  const match_tier = !query.groups.length ? "browse" : all ? "all-groups" : groupsMatched ? "partial" : exploratory ? "exploratory" : "none";
  const titleAll=query.groups.length>0 && query.groups.every(g=>matched.some(m=>m.group===g.id&&m.field==="title"));
  const exact=query.groups.length===1 && query.groups[0].variants.some(v=>v.kind!=="alternate" && normalizeTerm(entry.title)===v.text);
  const components:Record<string,number>={
    coverage:match_tier==="all-groups"?1000:match_tier==="partial"?500*groupsMatched/query.groups.length:0,
    title:exact?100:titleAll?75:matched.some(m=>m.field==="title")?55:0,
    concepts:matched.some(m=>m.field==="concepts")?65:0,
    tags:matched.some(m=>m.field==="tags")?30:0,
    description:matched.some(m=>m.field==="description")?15:0,
    interactive:["interactive","simulation","applet","visualization"].includes(entry.result_type)?5:0
  };
  if(match_tier==="exploratory") for(const key of Object.keys(components)) components[key]*=.1;
  if(match_tier==="none") for(const key of Object.keys(components)) components[key]=0;
  return {matched,matched_concept_ids:[...new Set(matched.flatMap(m=>m.concept_id?[m.concept_id]:[]))].sort(),match_tier,groups_matched:groupsMatched,groups_total:query.groups.length,score_components:components};
}
/** Strict AND across groups; OR across safe equivalents within each group. */
export function matchEntries(entries:IndexEntryLike[],sourceId:string,sourceName:string,query:NormalizedQuery):SearchResult[] {
  if(!query.groups.length && !query.siteFilter && !query.typeFilter) return [];
  if(query.siteFilter && query.siteFilter!==sourceId) return [];
  return entries.flatMap(e=> {
    try {if(!["http:","https:"].includes(new URL(e.url).protocol)) return [];}catch{return [];}
    if(query.typeFilter && query.typeFilter!==e.result_type) return [];
    if(!query.phrases.every(text=>[e.title,...e.tags,e.description??""].some(value=>matches(value,{text,match:matchMode(text)})))) return [];
    const explanation=explainMatch(query,e);
    if(!["all-groups","browse"].includes(explanation.match_tier) && !(query.explore && explanation.matched.some(m=>m.tier==="exploratory"))) return [];
    return [{...e,id:`${sourceId}::${e.url}`,source_id:sourceId,source_name:sourceName,score:0,explanation}];
  });
}
export function scoreResult(query:NormalizedQuery,r:SearchResult):number {
  r.explanation=explainMatch(query,r);
  return Math.round(Object.values(r.explanation.score_components).reduce((a,b)=>a+b,0)*1000)/1000;
}
export function rankResults(query:NormalizedQuery,results:SearchResult[]):SearchResult[] {
  for(const r of results) r.score=scoreResult(query,r);
  return results.sort((a,b)=>b.score-a.score || compare(a.source_name,b.source_name) || compare(a.title.toLowerCase(),b.title.toLowerCase()) || compare(a.id,b.id));
}
function compare(a:string,b:string) {return a<b?-1:a>b?1:0;}
