import fs from "node:fs";

const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const fail=m=>{throw new Error(m)};
const isDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||"");
const isHttps=v=>{try{return new URL(v).protocol==="https:"}catch{return false}};
const host=v=>{try{return new URL(v).hostname.toLowerCase().replace(/^www\./,"")}catch{return ""}};
function unique(items,key,label){
  const seen=new Set();
  for(const item of items){
    const value=item[key];
    if(!value) fail(`${label}: missing ${key}`);
    if(seen.has(value)) fail(`${label}: duplicate ${key} "${value}"`);
    seen.add(value);
  }
}

const sources=read("data/sources.json");
const sourceGroups={
  job:new Map((sources.job_sources||[]).map(s=>[s.id,s])),
  housing:new Map((sources.housing_sources||[]).map(s=>[s.id,s])),
  visa:new Map((sources.visa_sources||[]).map(s=>[s.id,s]))
};

function requireSourceIds(sourceIds,label){
  if(!Array.isArray(sourceIds)||!sourceIds.length) fail(`${label}: source_ids required`);
  for(const id of sourceIds) if(!sourceGroups.visa.has(id)) fail(`${label}: unknown visa source_id ${id}`);
}

function validateChangeControl(data,path,scope){
  const allowed=["approved","pending_review","rejected"];
  if(!data.change_control||!allowed.includes(data.change_control.status)){
    fail(`${path}: valid change_control.status required`);
  }
  if(scope==="live"&&data.change_control.status!=="approved"){
    fail(`${path}: live data must have approved change_control`);
  }
}

function validateFeed(path,kind,scope){
  const data=read(path);
  if(!isDate(data.updated_at)) fail(`${path}: updated_at must be YYYY-MM-DD`);
  validateChangeControl(data,path,scope);
  if(!Array.isArray(data.items)) fail(`${path}: items must be an array`);
  unique(data.items,"id",path);

  for(const item of data.items){
    const required=kind==="job"
      ?["id","title","employer","source_id","source_name","source_domain","source_url","first_seen","last_seen","status"]
      :["id","name","source_id","source_name","source_domain","source_url","first_seen","last_seen","status"];
    for(const field of required){
      if(item[field]===undefined||item[field]===null||item[field]===""){
        fail(`${path}: item ${item.id||"(unknown)"} missing ${field}`);
      }
    }
    if(!isHttps(item.source_url)) fail(`${path}: ${item.id} source_url must use https`);
    const actualHost=host(item.source_url);
    const declared=String(item.source_domain).toLowerCase().replace(/^www\./,"");
    if(actualHost!==declared&&!actualHost.endsWith("."+declared)){
      fail(`${path}: ${item.id} source_domain does not match source_url`);
    }
    if(!isDate(item.first_seen)||!isDate(item.last_seen)) fail(`${path}: ${item.id} has invalid seen date`);

    const registered=sourceGroups[kind].get(item.source_id);
    if(!registered) fail(`${path}: ${item.id} uses unregistered source_id ${item.source_id}`);
    if(registered.status!=="approved") fail(`${path}: ${item.id} source ${item.source_id} is not approved`);
    if(!registered.allowed_for?.includes(kind)) fail(`${path}: ${item.id} source ${item.source_id} is not allowed for ${kind}`);

    if(kind==="job"){
      if(item.working_holiday&&![ "explicitly_accepted","likely_compatible","unknown" ].includes(item.working_holiday)){
        fail(`${path}: ${item.id} invalid working_holiday`);
      }
      if(item.japanese_level&&![ "none","basic","conversational","business","native","unknown" ].includes(item.japanese_level)){
        fail(`${path}: ${item.id} invalid japanese_level`);
      }
      if(item.accommodation_status&&![ "provided","subsidized","not_stated" ].includes(item.accommodation_status)){
        fail(`${path}: ${item.id} invalid accommodation_status`);
      }
      if(item.salary_min_jpy!=null&&(!Number.isFinite(item.salary_min_jpy)||item.salary_min_jpy<0)){
        fail(`${path}: ${item.id} invalid salary_min_jpy`);
      }
      if(item.salary_max_jpy!=null&&(!Number.isFinite(item.salary_max_jpy)||item.salary_max_jpy<0)){
        fail(`${path}: ${item.id} invalid salary_max_jpy`);
      }
      if(item.salary_min_jpy!=null&&item.salary_max_jpy!=null&&item.salary_max_jpy<item.salary_min_jpy){
        fail(`${path}: ${item.id} salary range is inverted`);
      }
      for(const field of ["start_date","end_date","expires_at"]){
        if(item[field]!=null&&!isDate(item[field])) fail(`${path}: ${item.id} invalid ${field}`);
      }
    }else{
      if(item.foreigner_eligibility&&![ "explicitly_accepted","unknown" ].includes(item.foreigner_eligibility)){
        fail(`${path}: ${item.id} invalid foreigner_eligibility`);
      }
      if(item.monthly_rent_jpy!=null&&(!Number.isFinite(item.monthly_rent_jpy)||item.monthly_rent_jpy<0)){
        fail(`${path}: ${item.id} invalid monthly_rent_jpy`);
      }
      if(item.available_from!=null&&!isDate(item.available_from)){
        fail(`${path}: ${item.id} invalid available_from`);
      }
    }
  }
}

function validateVisa(path,scope,expectedMarket){
  const data=read(path);
  if(data.market!==expectedMarket||data.destination!=="JP"||data.visa_type!=="working_holiday") fail(`${path}: unexpected market/destination/type`);
  if(!isDate(data.verified_at)) fail(`${path}: invalid verified_at`);
  validateChangeControl(data,path,scope);
  for(const key of ["summary_facts","eligibility_rules","document_checklist","preparation_checklist","official_sources"]){
    if(!Array.isArray(data[key])) fail(`${path}: ${key} must be an array`);
  }
  if(!data.official_sources.length) fail(`${path}: official_sources required`);
  unique(data.eligibility_rules,"id",path+" eligibility_rules");
  unique(data.document_checklist,"id",path+" document_checklist");
  unique(data.preparation_checklist,"id",path+" preparation_checklist");
  unique(data.official_sources,"id",path+" official_sources");

  for(const source of data.official_sources){
    if(!isHttps(source.url)) fail(`${path}: official source must use https`);
    if(!sourceGroups.visa.has(source.id)) fail(`${path}: official source ${source.id} missing from registry`);
  }
  for(const fact of data.summary_facts) requireSourceIds(fact.source_ids,`${path} summary fact ${fact.label}`);
  for(const rule of data.eligibility_rules) requireSourceIds(rule.source_ids,`${path} eligibility rule ${rule.id}`);
  for(const item of data.document_checklist) requireSourceIds(item.source_ids,`${path} document item ${item.id}`);
  requireSourceIds(data.funds_rule?.source_ids,`${path} funds rule`);
  requireSourceIds(data.participation_rule?.source_ids,`${path} participation rule`);
  requireSourceIds(data.jurisdiction?.source_ids,`${path} jurisdiction`);
  if(!data.funds_rule?.input_label) fail(`${path}: funds_rule.input_label required`);
  if(!Array.isArray(data.jurisdiction?.options)||!data.jurisdiction.options.length) fail(`${path}: jurisdiction.options required`);
  unique(data.jurisdiction.options,"value",path+" jurisdiction options");
  for(const option of data.jurisdiction.options){
    if(!option.label) fail(`${path}: jurisdiction option ${option.value} missing label`);
    if(!option.mission_label||!option.mission_detail) fail(`${path}: jurisdiction option ${option.value} missing mission copy`);
  }
}


function validateVisaMarkets(path,scope){
  const data=read(path);
  if(data.destination!=="JP") fail(`${path}: unexpected destination`);
  validateChangeControl(data,path,scope);
  if(!isDate(data.verified_at)) fail(`${path}: invalid verified_at`);
  requireSourceIds(data.source_ids,`${path} market registry`);
  if(!Array.isArray(data.partner_countries)||!data.partner_countries.length) fail(`${path}: partner_countries required`);
  unique(data.partner_countries,"code",path+" partner_countries");
  if(!data.detailed_planners||typeof data.detailed_planners!=="object") fail(`${path}: detailed_planners required`);
  for(const [market,file] of Object.entries(data.detailed_planners)){
    if(!market||!file||typeof file!=="string") fail(`${path}: invalid detailed planner mapping`);
    const plannerPath=`data/${scope}/${file}`;
    if(!fs.existsSync(plannerPath)) fail(`${path}: missing ${scope} planner ${file}`);
  }
  if(!Array.isArray(data.coverage_groups)) fail(`${path}: coverage_groups must be an array`);
}

function validateSources(){
  for(const group of ["visa_sources","job_sources","housing_sources","context_sources"]){
    if(!Array.isArray(sources[group])) fail(`data/sources.json: ${group} must be an array`);
    unique(sources[group],"id",`data/sources.json ${group}`);
    for(const source of sources[group]){
      if(!isHttps(source.url)) fail(`data/sources.json: ${source.id} must use https`);
      if(!source.status) fail(`data/sources.json: ${source.id} missing status`);
      if(!Array.isArray(source.allowed_for)||!source.allowed_for.length) fail(`data/sources.json: ${source.id} missing allowed_for`);
    }
  }
  if(sources.visa_sources.some(source=>source.type!=="official"||source.status!=="approved")){
    fail("data/sources.json: visa sources must be approved official sources");
  }
}

function validateHealth(){
  const health=read("data/source-health.json");
  if(!isDate(health.updated_at)) fail("data/source-health.json: invalid updated_at");
  if(!health.sources||typeof health.sources!=="object") fail("data/source-health.json: sources object required");
  const known=new Set(Object.values(sources).filter(Array.isArray).flat().map(s=>s.id));
  for(const [id,state] of Object.entries(health.sources)){
    if(!known.has(id)) fail(`data/source-health.json: unknown source ${id}`);
    if(!["healthy","degraded","unhealthy","quarantined"].includes(state.status)) fail(`data/source-health.json: ${id} invalid status`);
    if(!isDate(state.last_checked)) fail(`data/source-health.json: ${id} invalid last_checked`);
  }
}

function validateCandidates(){
  const data=read("data/source-candidates.json");
  if(!isDate(data.reviewed_at)) fail("data/source-candidates.json: invalid reviewed_at");
  if(!Array.isArray(data.candidates)) fail("data/source-candidates.json: candidates must be an array");
  unique(data.candidates,"id","data/source-candidates.json");
}

function validateWorkerState(){
  const state=read("data/worker-state.json");
  if(!isDate(state.updated_at)) fail("data/worker-state.json: invalid updated_at");
  const required=["jobs","housing","visa","qa","site_health"];
  for(const worker of required){
    if(!state.workers?.[worker]) fail(`data/worker-state.json: missing worker ${worker}`);
    if(!["not_started","healthy","warning","failed"].includes(state.workers[worker].status)){
      fail(`data/worker-state.json: invalid status for ${worker}`);
    }
  }
}

for(const scope of ["live","candidate"]){
  validateFeed(`data/${scope}/jobs.json`,"job",scope);
  validateFeed(`data/${scope}/housing.json`,"housing",scope);
  const registryPath=`data/${scope}/visa-markets.json`;
  validateVisaMarkets(registryPath,scope);
  const registry=read(registryPath);
  for(const [market,file] of Object.entries(registry.detailed_planners||{})){
    validateVisa(`data/${scope}/${file}`,scope,market);
  }
}
validateSources();
validateHealth();
validateCandidates();
validateWorkerState();
console.log("✓ JWHV datasets, multi-market visa registry, source policy, worker state and health state validated");
