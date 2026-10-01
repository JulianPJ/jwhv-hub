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
let promoted=0;

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
  if(candidate.change_control?.status!=="approved"){
    console.log(`- skipped ${name}: candidate status is ${candidate.change_control?.status||"missing"}`);
    return;
  }
  const liveCount=live.items.length,candidateCount=candidate.items.length;
  if(liveCount>=10&&candidateCount<Math.ceil(liveCount*0.7)){
    throw new Error(`${name}: candidate count ${candidateCount} is a >30% drop from live count ${liveCount}; quarantine instead of promoting`);
  }
  ensureHealthy(candidate.items,name);
  write(`data/live/${name}.json`,candidate);
  promoted++;
  console.log(`✓ promoted ${name}: ${candidateCount} records`);
}

function promoteVisaFile(file){
  const candidate=read(`data/candidate/${file}`);
  if(candidate.change_control?.status!=="approved"){
    console.log(`- skipped ${file}: candidate status is ${candidate.change_control?.status||"missing"}`);
    return;
  }
  for(const source of candidate.official_sources||[]){
    const state=health.sources[source.id];
    if(state&&["unhealthy","quarantined"].includes(state.status)){
      throw new Error(`${file}: source ${source.id} is ${state.status}; promotion blocked`);
    }
  }
  write(`data/live/${file}`,candidate);
  promoted++;
  console.log(`✓ promoted ${file}`);
}

function promoteVisaMarkets(){
  const candidate=read("data/candidate/visa-markets.json");
  if(candidate.change_control?.status!=="approved"){
    console.log(`- skipped visa-markets.json: candidate status is ${candidate.change_control?.status||"missing"}`);
    return;
  }
  for(const id of candidate.source_ids||[]){
    const state=health.sources[id];
    if(state&&["unhealthy","quarantined"].includes(state.status)){
      throw new Error(`visa-markets.json: source ${id} is ${state.status}; promotion blocked`);
    }
  }
  write("data/live/visa-markets.json",candidate);
  promoted++;
  console.log("✓ promoted visa-markets.json");
}

function promoteVisa(){
  for(const file of ["visa-uk.json","visa-au.json","visa-de.json"]) promoteVisaFile(file);
  promoteVisaMarkets();
}

for(const scope of requested){
  if(scope==="visa") promoteVisa(); else promoteFeed(scope);
}
console.log(promoted?`✓ ${promoted} scope(s) promoted`:"- no approved candidate changes to promote");
