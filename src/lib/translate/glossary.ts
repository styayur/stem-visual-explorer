// Terminology translation is a view of the canonical ontology, never a second dictionary.
import { concepts, conceptNames, normalizeTerm } from "../concepts.ts";
export function glossaryLookup(text:string,target:string):string|null {
  const key=normalizeTerm(text);
  const c=concepts.find(c=>conceptNames(c).some(n=>normalizeTerm(n)===key) || c.aliases.some(a=>a.match!=="exact" && normalizeTerm(a.text)===key));
  if(!c) return null;
  return target==="en"?c.en:target==="zh-TW"?c.zh_tw:target.startsWith("zh")?c.zh_cn:null;
}
export const glossarySize=()=>concepts.length;
