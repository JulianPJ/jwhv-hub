import fs from "node:fs";
import {execFileSync} from "node:child_process";

const scopes=process.argv.slice(2);
const requested=scopes.length?scopes:["jobs","housing","visa"];
const valid=new Set(["jobs","housing","visa"]);
for(const scope of requested) if(!valid.has(scope)) throw new Error("Unknown scope: "+scope);

execFileSync(process.execPath,["scripts/validate.mjs"],{stdio:"inherit"});
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+"\n");
const health=read("data/source-health.json");

function ensureHealthy(items,label){
  for(const item of items){
    const state=health.sources[item.source_id];
    if(state&&["unhealthy","quarantined"].includes(state.status)){
      throw new Error(`${label}: source ${item.source_id} is ${state.status}; promotion blocked`);
    }
  }
}
function promoteFeed(name){
  const live=read(`data/live/${name}.json`);
  const candidate=read(`data/candidate/${name}.json`);
  const liveCount=live.items.length,candidateCount=candidate.items.length;
  if(liveCount>=10&&candidateCount<Math.ceil(liveCount*0.7)){
    throw new Error(`${name}: candidate count ${candidateCount} is a >30% drop from live count ${liveCount}; quarantine instead of promoting`);
  }
  ensureHealthy(candidate.items,name);
  write(`data/live/${name}.json`,candidate);
  console.log(`✓ promoted ${name}: ${candidateCount} records`);
}
function promoteVisa(){
  const candidate=read("data/candidate/visa-uk.json");
  if(candidate.change_control?.status!=="approved") throw new Error("visa: candidate change_control.status must be approved");
  write("data/live/visa-uk.json",candidate);
  console.log("✓ promoted visa ruleset");
}
for(const scope of requested){
  if(scope==="visa") promoteVisa(); else promoteFeed(scope);
}
