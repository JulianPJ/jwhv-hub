import fs from "node:fs";
const out="_site";
fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});
for(const file of ["index.html","jobs.html","housing.html","application.html","status.html","shortlist.html","plan.html","styles.css","app.js",".nojekyll"]){
  fs.copyFileSync(file,`${out}/${file}`);
}

const visaMarkets=JSON.parse(fs.readFileSync("data/live/visa-markets.json","utf8"));
const liveDataFiles=["jobs.json","housing.json","visa-markets.json",...new Set(Object.values(visaMarkets.detailed_planners||{}))];
fs.mkdirSync(`${out}/data/live`,{recursive:true});
for(const file of liveDataFiles){
  fs.copyFileSync(`data/live/${file}`,`${out}/data/live/${file}`);
}

fs.mkdirSync(`${out}/data/candidate`,{recursive:true});
for(const file of ["jobs.json","housing.json"]){
  fs.copyFileSync(`data/candidate/${file}`,`${out}/data/candidate/${file}`);
}
fs.mkdirSync(`${out}/data`,{recursive:true});
fs.copyFileSync("data/worker-state.json",`${out}/data/worker-state.json`);
console.log(`✓ Static site built in _site/ with ${Object.keys(visaMarkets.detailed_planners||{}).length} detailed visa planner(s)`);
