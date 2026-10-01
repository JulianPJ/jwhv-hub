const $=s=>document.querySelector(s);

async function loadJSON(path){
  const response=await fetch(path,{cache:"no-store"});
  if(!response.ok) throw new Error("Unable to load "+path);
  return response.json();
}
function esc(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
const tag=text=>'<span class="tag">'+esc(text)+'</span>';
const empty=(title,body)=>'<div class="empty-state"><strong>'+esc(title)+'</strong><p>'+esc(body)+'</p></div>';
function readLocal(key,fallback={}){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback))}catch{return fallback}}
function writeLocal(key,value){localStorage.setItem(key,JSON.stringify(value))}

async function initJobs(){
  const data=await loadJSON("data/live/jobs.json"),items=data.items||[];
  const search=$("#job-search"),language=$("#job-language"),wh=$("#job-wh"),list=$("#job-list"),count=$("#job-count");
  function render(){
    const q=search.value.trim().toLowerCase();
    const filtered=items.filter(item=>[item.title,item.employer,item.city,item.prefecture].join(" ").toLowerCase().includes(q)
      &&(!language.value||item.japanese_level===language.value)
      &&(!wh.value||item.working_holiday===wh.value));
    count.textContent=filtered.length+" "+(filtered.length===1?"listing":"listings");
    list.innerHTML=filtered.length?filtered.map(item=>'<article class="listing-card"><div><h2>'+esc(item.title)+'</h2><div class="muted">'+esc(item.employer)+" · "+esc([item.city,item.prefecture].filter(Boolean).join(", "))+'</div><div class="listing-meta">'+(item.salary_display?tag(item.salary_display):"")+(item.japanese_level?tag("Japanese: "+item.japanese_level):"")+(item.working_holiday?tag("WH: "+item.working_holiday.replaceAll("_"," ")):"")+(item.accommodation_provided===true?tag("Accommodation provided"):"")+'</div></div><a class="source-link" href="'+esc(item.source_url)+'" target="_blank" rel="noopener noreferrer">Source ↗</a></article>').join("")
      :empty(items.length?"No matching jobs":"Job feed ready",items.length?"Try changing the filters.":"Verified listings will appear once approved sources are connected.");
  }
  [search,language,wh].forEach(el=>el.addEventListener("input",render));
  render();
}

async function initHousing(){
  const data=await loadJSON("data/live/housing.json"),items=data.items||[];
  const search=$("#housing-search"),furnished=$("#housing-furnished"),foreigner=$("#housing-foreigner"),list=$("#housing-list"),count=$("#housing-count");
  function render(){
    const q=search.value.trim().toLowerCase();
    const filtered=items.filter(item=>[item.name,item.city,item.prefecture,item.nearest_station].join(" ").toLowerCase().includes(q)
      &&(!furnished.value||String(item.furnished)===furnished.value)
      &&(!foreigner.value||item.foreigner_eligibility===foreigner.value));
    count.textContent=filtered.length+" "+(filtered.length===1?"property":"properties");
    list.innerHTML=filtered.length?filtered.map(item=>'<article class="listing-card"><div><h2>'+esc(item.name)+'</h2><div class="muted">'+esc([item.city,item.prefecture].filter(Boolean).join(", "))+'</div><div class="listing-meta">'+(item.monthly_rent_display?tag(item.monthly_rent_display):"")+(item.furnished===true?tag("Furnished"):"")+(item.minimum_stay?tag("Min stay: "+item.minimum_stay):"")+(item.foreigner_eligibility?tag(item.foreigner_eligibility.replaceAll("_"," ")):"")+'</div></div><a class="source-link" href="'+esc(item.source_url)+'" target="_blank" rel="noopener noreferrer">Source ↗</a></article>').join("")
      :empty(items.length?"No matching housing":"Housing feed ready",items.length?"Try changing the filters.":"Approved housing sources can now be connected without changing the frontend.");
  }
  [search,furnished,foreigner].forEach(el=>el.addEventListener("input",render));
  render();
}

async function initApplication(){
  const visa=await loadJSON("data/live/visa-uk.json");
  $("#visa-verified").textContent="Verified "+visa.verified_at;
  $("#visa-summary").innerHTML=(visa.summary_facts||[]).map(fact=>'<div class="fact"><span>'+esc(fact.label)+'</span><strong>'+esc(fact.value)+'</strong></div>').join("");
  $("#official-source-links").innerHTML=(visa.official_sources||[]).map(source=>'<a class="tag" href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.name)+" ↗</a>").join("");

  const eligibilityKey="jwhv-hub:eligibility:v1";
  const eligibilitySaved=readLocal(eligibilityKey,{});
  const eligibilityForm=$("#eligibility-form");

  function booleanQuestion(rule,value){
    return '<label>'+esc(rule.label)+'<select data-rule-id="'+esc(rule.id)+'"><option value="">Choose…</option><option value="yes" '+(value==="yes"?"selected":"")+'>Yes</option><option value="no" '+(value==="no"?"selected":"")+'>No</option></select></label>';
  }
  function numberQuestion(rule,value){
    return '<label>'+esc(rule.label)+'<input data-rule-id="'+esc(rule.id)+'" type="number" min="0" step="1" value="'+esc(value??"")+'" placeholder="'+esc(rule.min??"")+'"></label>';
  }
  eligibilityForm.innerHTML=(visa.eligibility_rules||[]).map(rule=>{
    const value=eligibilitySaved[rule.id]??"";
    return rule.type==="boolean"?booleanQuestion(rule,value):numberQuestion(rule,value);
  }).join("");

  const specialIds=["bank-funds","return-ticket","prior-visas","previous-extension","jurisdiction-area"];
  for(const id of specialIds){
    const el=$("#"+id);
    if(el&&eligibilitySaved[id]!==undefined) el.value=eligibilitySaved[id];
  }

  function collectEligibility(){
    const state={};
    eligibilityForm.querySelectorAll("[data-rule-id]").forEach(el=>state[el.dataset.ruleId]=el.value);
    for(const id of specialIds){const el=$("#"+id);if(el)state[id]=el.value}
    return state;
  }
  function saveEligibility(){writeLocal(eligibilityKey,collectEligibility())}

  function missionForArea(area){
    if(area==="scotland"||area==="edinburgh_north") return visa.jurisdiction.edinburgh_label;
    if(area==="other_uk") return visa.jurisdiction.london_label;
    if(area==="outside_uk") return "UK application route may not apply";
    return "Answer the location question";
  }

  function renderMission(){
    const area=$("#jurisdiction-area").value;
    let detail="We will route you to London or Edinburgh using the current jurisdiction guidance.";
    if(area==="scotland"||area==="edinburgh_north"){
      detail="Edinburgh currently covers Scotland and these listed northern areas: "+visa.jurisdiction.edinburgh_regions.filter(v=>v!=="Scotland").join(", ")+".";
    }else if(area==="other_uk"){
      detail="Based on the current jurisdiction split, applicants outside Edinburgh's listed area use the Embassy in London.";
    }else if(area==="outside_uk"){
      detail="The UK route requires UK residence. Check the Japanese mission responsible for your country of residence.";
    }
    $("#mission-card").innerHTML='<span class="small-label">YOUR MISSION</span><strong>'+esc(missionForArea(area))+'</strong><p class="muted">'+esc(detail)+'</p>';
  }

  function evaluateEligibility(){
    const issues=[],pending=[];
    for(const rule of visa.eligibility_rules||[]){
      const el=eligibilityForm.querySelector('[data-rule-id="'+rule.id+'"]');
      const value=el?.value??"";
      if(value===""){pending.push(rule.label);continue}
      if(rule.type==="boolean"){
        if((value==="yes")!==rule.expected) issues.push(rule.fail_message);
      }else{
        const actual=Number(value);
        if(!Number.isFinite(actual)||actual<rule.min||actual>rule.max) issues.push(rule.fail_message);
      }
    }

    const fundsRaw=$("#bank-funds").value;
    const ticket=$("#return-ticket").value;
    if(fundsRaw==="") pending.push("Proof-of-funds amount");
    else{
      const funds=Number(fundsRaw);
      const enoughWithout=funds>=visa.funds_rule.no_ticket_minimum;
      const enoughWith=funds>=visa.funds_rule.with_return_ticket_minimum&&ticket==="yes";
      if(!enoughWithout&&!enoughWith){
        if(ticket==="") pending.push("Return/onward ticket evidence");
        else issues.push("The entered funds are below the current baseline: £"+visa.funds_rule.no_ticket_minimum+", or £"+visa.funds_rule.with_return_ticket_minimum+" with return/onward-ticket evidence.");
      }
    }

    const prior=$("#prior-visas").value;
    const extension=$("#previous-extension").value;
    if(prior==="") pending.push("Previous Working Holiday participation");
    else if(Number(prior)>=visa.participation_rule.max_total_participations) issues.push("The current UK programme permits a maximum of two participations / two years in total.");
    else if(prior==="1"){
      if(extension==="") pending.push("Previous extension history");
      else if(extension==="yes") issues.push("A second year obtained by extending a first Working Holiday stay counts toward the current two-year participation limit.");
    }

    const area=$("#jurisdiction-area").value;
    if(area==="") pending.push("UK residence area");
    if(area==="outside_uk") issues.push("This UK route is intended for applicants resident in the United Kingdom.");

    const result=$("#eligibility-result");
    if(issues.length){
      result.className="eligibility-result fail";
      result.innerHTML="<strong>This pre-check found "+issues.length+" issue"+(issues.length===1?"":"s")+".</strong><ul>"+issues.map(issue=>"<li>"+esc(issue)+"</li>").join("")+"</ul><p>Check the official source before deciding whether or how to apply.</p>";
    }else if(pending.length){
      result.className="eligibility-result neutral";
      result.innerHTML="<strong>No conflict found in the answers provided so far.</strong><p>Complete "+pending.length+" remaining field"+(pending.length===1?"":"s")+" for a fuller pre-check.</p>";
    }else{
      result.className="eligibility-result pass";
      result.innerHTML="<strong>Your answers match the baseline rules in the currently verified ruleset.</strong><p>This is not an approval or guarantee. Re-check the official guidance before applying.</p>";
    }
    renderMission();
    saveEligibility();
  }

  eligibilityForm.addEventListener("input",evaluateEligibility);
  for(const id of specialIds) $("#"+id)?.addEventListener("input",evaluateEligibility);
  evaluateEligibility();

  const progressKey="jwhv-hub:visa-progress:v2";
  const savedProgress=readLocal(progressKey,{});
  function checklistMarkup(items,prefix){
    return items.map(item=>'<label class="check-item"><input type="checkbox" data-check-id="'+esc(prefix+item.id)+'" '+(savedProgress[prefix+item.id]?"checked":"")+'><span><strong>'+esc(item.title)+'</strong><p>'+esc(item.description)+'</p></span></label>').join("");
  }
  $("#document-checklist").innerHTML=checklistMarkup(visa.document_checklist||[],"doc:");
  $("#visa-checklist").innerHTML=checklistMarkup(visa.preparation_checklist||[],"prep:");

  function updateProgress(){
    const boxes=[...document.querySelectorAll("[data-check-id]")];
    const state=Object.fromEntries(boxes.map(box=>[box.dataset.checkId,box.checked]));
    writeLocal(progressKey,state);
    const complete=boxes.filter(box=>box.checked).length;
    const pct=boxes.length?Math.round(complete/boxes.length*100):0;
    $("#progress-number").textContent=pct;
    $("#progress-bar").style.width=pct+"%";
    $("#progress-copy").textContent=pct===100?"Preparation checklist complete. Re-check official requirements before applying.":complete+" of "+boxes.length+" preparation steps complete.";
  }
  document.querySelectorAll("[data-check-id]").forEach(box=>box.addEventListener("change",updateProgress));
  $("#reset-progress").addEventListener("click",()=>{
    localStorage.removeItem(progressKey);
    document.querySelectorAll("[data-check-id]").forEach(box=>box.checked=false);
    updateProgress();
  });
  updateProgress();

  const workspaceKey="jwhv-hub:workspace:v1";
  const workspace=readLocal(workspaceKey,{statement:"",months:{}});
  $("#statement-notes").value=workspace.statement||"";
  $("#itinerary-months").innerHTML=Array.from({length:12},(_,index)=>{
    const month=index+1;
    return '<label>Month '+month+'<textarea data-month="'+month+'" rows="4" placeholder="Location, activities, travel plans…">'+esc(workspace.months?.[month]||"")+'</textarea></label>';
  }).join("");

  function saveWorkspace(){
    const months={};
    document.querySelectorAll("[data-month]").forEach(el=>months[el.dataset.month]=el.value);
    writeLocal(workspaceKey,{statement:$("#statement-notes").value,months});
  }
  $("#statement-notes").addEventListener("input",saveWorkspace);
  $("#itinerary-months").addEventListener("input",saveWorkspace);

  $("#download-plan").addEventListener("click",()=>{
    saveWorkspace();
    const data=readLocal(workspaceKey,{statement:"",months:{}});
    const lines=["Japan Working Holiday planning notes","","Statement of Purpose notes","--------------------------",data.statement||"(blank)","","12-month itinerary notes","------------------------"];
    for(let month=1;month<=12;month++) lines.push("Month "+month+": "+(data.months?.[month]||"(blank)"));
    lines.push("","","Generated locally by JWHV Hub. Reformat these notes into the current official documents/forms before applying.");
    const blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="japan-working-holiday-planning-notes.txt";a.click();
    URL.revokeObjectURL(url);
  });
}


async function initStatus(){
  const [state,jobs,housing,visa]=await Promise.all([
    loadJSON("data/worker-state.json"),
    loadJSON("data/live/jobs.json"),
    loadJSON("data/live/housing.json"),
    loadJSON("data/live/visa-uk.json")
  ]);
  const summary=$("#status-summary");
  summary.innerHTML=[
    ["Live jobs",(jobs.items||[]).length,jobs.updated_at],
    ["Live housing",(housing.items||[]).length,housing.updated_at],
    ["Visa ruleset","UK → Japan",visa.verified_at]
  ].map(([label,value,date])=>'<article class="status-card"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>Updated '+esc(date)+'</small></article>').join("");

  const workers=state.workers||{};
  const severity={failed:3,warning:2,not_started:1,healthy:0};
  const combine=(keys,label)=>{
    const entries=keys.map(key=>workers[key]||{status:"not_started"});
    const status=entries.reduce((worst,item)=>severity[item.status]>severity[worst]?item.status:worst,"healthy");
    const dates=entries.map(item=>item.last_success||item.last_run).filter(Boolean).sort();
    const last=dates.length?dates[dates.length-1]:"Not run yet";
    const summary=entries.map(item=>item.summary).filter(Boolean).join(" ");
    return {label,status,last,summary};
  };
  const taskCards=[
    combine(["jobs","housing"],"Listings Research"),
    combine(["qa","site_health"],"QA & Publish")
  ];
  $("#worker-status").innerHTML=taskCards.map(task=>
    '<article class="status-card worker-card"><div class="status-card-row"><span>'+esc(task.label)+'</span><span class="health '+esc(task.status)+'">'+esc(task.status.replaceAll("_"," "))+'</span></div><strong>'+esc(task.last)+'</strong><small>'+esc(task.summary||"No status reported.")+'</small></article>'
  ).join("");
}

document.addEventListener("DOMContentLoaded",async()=>{
  try{
    const page=document.body.dataset.page;
    if(page==="jobs") await initJobs();
    if(page==="housing") await initHousing();
    if(page==="application") await initApplication();
    if(page==="status") await initStatus();
  }catch(error){
    console.error(error);
    const message=document.createElement("div");
    message.className="notice";
    message.innerHTML="<strong>Data unavailable</strong><p>The dashboard could not load its live data. Please try again later.</p>";
    document.querySelector("main")?.prepend(message);
  }
});