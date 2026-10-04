// Reconstruct the untouched v0.2 engine and corpus from a pinned Git commit.
// Never derives baseline numbers from the implementation under test.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
export const BASELINE_REF = 'b380db84a1760e265841c2e7412a21b0a2595b9d';
export const OBSERVED_BASELINE_REF = '3cd6ceb';
export const BASELINE_TREE = '89d9c17fbe3af4040b4993979f4862bd80582a49';
export const acceptanceQueries = ['梯度','旋度','傅里叶变换','角动量','力矩','行列式','泰勒级数','线积分','面积分','多普勒效应','洛伦兹力','麦克斯韦方程组','光电效应','薛定谔方程','熵','FT','rot','angular momentum','determinant','Taylor series','line integral','Fourier transform','curl','Doppler effect','Maxwell equations','photoelectric effect','Schrodinger equation'];
export const fromGit = (path) => execFileSync('git', ['show', `${BASELINE_REF}:${path}`], { encoding:'utf8', maxBuffer:32*1024*1024 });
export async function legacy() {
  const temp = mkdtempSync(join(tmpdir(),'sve-baseline-'));
  writeFileSync(join(temp,'package.json'), '{"type":"module"}');
  for (const file of ['concepts.ts','concepts.json','searchEngine.ts']) writeFileSync(join(temp,file), fromGit(`src/lib/${file}`));
  const engine = await import(pathToFileURL(join(temp,'searchEngine.ts')));
  const concepts = JSON.parse(fromGit('src/lib/concepts.json'));
  const corpus = JSON.parse(fromGit('public/index/manifest.json')).map(p => JSON.parse(fromGit(`public/index/${p.file}`)));
  return { engine, concepts, corpus, cleanup:()=>rmSync(temp,{recursive:true,force:true}) };
}
export function search(engine, corpus, text) {
  const query = engine.parseAndExpand(text);
  const results = engine.rankResults(query, corpus.flatMap(p => engine.matchEntries(p.entries,p.source_id,p.source_name,query)));
  return {query,results};
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const old = await legacy();
  const incoming = new Set(old.concepts.flatMap(c=>[...c.related,...c.prerequisites]));
  const queries = acceptanceQueries.map(text => {
    const {query,results} = search(old.engine,old.corpus,text);
    return {query:text,recognized_concepts:query.concept_ids,expanded_variants:query.variants,result_count:results.length,top10:results.slice(0,10),provider_distribution:Object.fromEntries(old.corpus.map(p=>[p.source_id,results.filter(r=>r.source_id===p.source_id).length]))};
  });
  const probes = ['left','after','prototype','rotator','generic wave frequency'].map((title,i)=>({title,url:`https://example.test/${i}`,description:null,tags:[],thumbnail:null,result_type:'article'}));
  const false_positives = ['FT','rot','傅里叶变换','旋度'].map(text=>({query:text,titles:old.engine.matchEntries(probes,'fixture','Fixture',old.engine.parseAndExpand(text)).map(r=>r.title)}));
  mkdirSync('artifacts',{recursive:true});
  writeFileSync('artifacts/retrieval-baseline.json',JSON.stringify({revision:BASELINE_REF,observed_revision:OBSERVED_BASELINE_REF,tree:BASELINE_TREE,concepts:old.concepts.length,isolated:old.concepts.filter(c=>!c.related.length&&!c.prerequisites.length&&!incoming.has(c.id)).length,isolated_outgoing_only:old.concepts.filter(c=>!c.related.length&&!c.prerequisites.length).length,queries,false_positives},null,2)+'\n');
  old.cleanup();
  console.log(JSON.stringify({concepts:old.concepts.length,queries:queries.map(q=>[q.query,q.result_count]),false_positives},null,2));
}
