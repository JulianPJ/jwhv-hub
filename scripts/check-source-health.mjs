import fs from "node:fs";
const health=JSON.parse(fs.readFileSync("data/source-health.json","utf8"));
const today=new Date();
let failed=false;
for(const [id,state] of Object.entries(health.sources)){
  const checked=new Date(state.last_checked+"T00:00:00Z");
  const days=Math.floor((today-checked)/86400000);
  if(["unhealthy","quarantined"].includes(state.status)){
    console.error(`✗ ${id}: ${state.status}`);
    failed=true;
  }else if(days>14){
    console.warn(`! ${id}: health record is ${days} days old`);
  }else{
    console.log(`✓ ${id}: ${state.status}`);
  }
}
if(failed) process.exitCode=2;
