import fs from "node:fs";

const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const fail=m=>{throw new Error(m)};
const isDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||"");
const isHttps=v=>{try{return new URL(v).protocol==="https:"}catch{return false}};
function unique(items,key,label){const seen=new Set();for(const item of items){const value=item[key];if(seen.has(value))fail(`${label}: duplicate ${key} "${value}"`);seen.add(value)}}
function validateFeed(path,kind){
 const data=read(path);
 if(!isDate(data.updated_at))fail(`${path}: updated_at must be YYYY-MM-DD`);
 if(!Array.isArray(data.items))fail(`${path}: items must be an array`);
 unique(data.items,"id",path);
 for(const item of data.items){
  const required=kind==="job"?["id","title","employer","source_name","source_url","first_seen","last_seen","status"]:["id","name","source_name","source_url","first_seen","last_seen","status"];
  for(const field of required){if(item[field]===undefined||item[field]===null||item[field]==="")fail(`${path}: item ${item.id||"(unknown)"} missing ${field}`)}
  if(!isHttps(item.source_url))fail(`${path}: ${item.id} source_url must use https`);
  if(!isDate(item.first_seen)||!isDate(item.last_seen))fail(`${path}: ${item.id} has invalid seen date`);
  if(kind==="job"){
   if(item.working_holiday&&!["explicitly_accepted","likely_compatible","unknown"].includes(item.working_holiday))fail(`${path}: ${item.id} invalid working_holiday`);
   if(item.japanese_level&&!["none","basic","conversational","business","native","unknown"].includes(item.japanese_level))fail(`${path}: ${item.id} invalid japanese_level`);
  }else if(item.foreigner_eligibility&&!["explicitly_accepted","unknown"].includes(item.foreigner_eligibility))fail(`${path}: ${item.id} invalid foreigner_eligibility`);
 }
}
function validateVisa(path){
 const data=read(path);
 if(data.market!=="GB"||data.destination!=="JP"||data.visa_type!=="working_holiday")fail(`${path}: unexpected market/destination/type`);
 if(!isDate(data.verified_at))fail(`${path}: invalid verified_at`);
 if(!Array.isArray(data.summary_facts))fail(`${path}: summary_facts must be an array`);
 if(!Array.isArray(data.preparation_checklist))fail(`${path}: preparation_checklist must be an array`);
 if(!Array.isArray(data.official_sources)||!data.official_sources.length)fail(`${path}: official_sources required`);
 unique(data.preparation_checklist,"id",path);unique(data.official_sources,"id",path);
 for(const source of data.official_sources)if(!isHttps(source.url))fail(`${path}: official source must use https`);
}
function validateSources(){
 const data=read("data/sources.json");
 for(const group of ["visa_sources","job_sources","housing_sources"]){
  if(!Array.isArray(data[group]))fail(`data/sources.json: ${group} must be an array`);
  unique(data[group],"id",group);
  for(const source of data[group])if(!isHttps(source.url))fail(`data/sources.json: ${source.id} must use https`);
 }
 if(data.visa_sources.some(s=>s.type!=="official"))fail("data/sources.json: visa_sources must be official");
}
for(const scope of ["live","candidate"]){validateFeed(`data/${scope}/jobs.json`,"job");validateFeed(`data/${scope}/housing.json`,"housing");validateVisa(`data/${scope}/visa-uk.json`)}
validateSources();console.log("✓ JWHV datasets validated");
