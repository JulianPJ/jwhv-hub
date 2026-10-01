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
const SHORTLIST_KEY="jwhv-hub:shortlist:v1";
const MOVE_PLAN_KEY="jwhv-hub:move-plan:v1";
const VISA_PROGRESS_KEY="jwhv-hub:visa-progress:v2";
const VISA_MARKET_KEY="jwhv-hub:visa-market:v1";
function getVisaMarket(){return readLocal(VISA_MARKET_KEY,{market:"GB"}).market||"GB"}
function getMovePlan(){return readLocal(MOVE_PLAN_KEY,{targetArrival:"",timelineDone:{}})}
function formatJPY(value){return new Intl.NumberFormat("en-GB",{style:"currency",currency:"JPY",maximumFractionDigits:0}).format(value||0)}
function parseLocalDate(value){return value?new Date(value+"T12:00:00"):null}
function isoDate(date){return date.toISOString().slice(0,10)}
function shiftDays(value,days){const d=parseLocalDate(value);if(!d)return null;d.setDate(d.getDate()+days);return d}
function daysBetween(a,b){return Math.ceil((b-a)/86400000)}
function visaProgressSummary(visa,market="GB"){
  const legacy=market==="GB"?readLocal(VISA_PROGRESS_KEY,{}):{};
  const saved=readLocal(VISA_PROGRESS_KEY+":"+market,legacy);
  const ids=[
    ...(visa.document_checklist||[]).map(item=>"doc:"+item.id),
    ...(visa.preparation_checklist||[]).map(item=>"prep:"+item.id)
  ];
  const complete=ids.filter(id=>saved[id]).length;
  return {complete,total:ids.length,pct:ids.length?Math.round(complete/ids.length*100):0};
}
function getShortlist(){
  const value=readLocal(SHORTLIST_KEY,{jobs:[],housing:[]});
  return {
    jobs:Array.isArray(value.jobs)?value.jobs:[],
    housing:Array.isArray(value.housing)?value.housing:[]
  };
}
function isSaved(type,id){return getShortlist()[type]?.includes(id)}
function toggleSaved(type,id){
  const state=getShortlist();
  const set=new Set(state[type]||[]);
  if(set.has(id)) set.delete(id); else set.add(id);
  state[type]=[...set];
  writeLocal(SHORTLIST_KEY,state);
  return set.has(id);
}
function saveButton(type,id){
  const saved=isSaved(type,id);
  return '<button class="save-button'+(saved?" saved":"")+'" type="button" data-save-type="'+esc(type)+'" data-save-id="'+esc(id)+'" aria-pressed="'+saved+'">'+(saved?"Saved ✓":"Save")+'</button>';
}

async function loadVisibleFeed(kind){
  const [live,candidate]=await Promise.all([
    loadJSON("data/live/"+kind+".json"),
    loadJSON("data/candidate/"+kind+".json")
  ]);
  const liveItems=(live.items||[])
    .filter(item=>item.status==="active")
    .map(item=>({...item,_feedStatus:"live"}));
  const liveIds=new Set(liveItems.map(item=>item.id));
  const pendingItems=(candidate.items||[])
    .filter(item=>item.status==="active"&&!liveIds.has(item.id))
    .map(item=>({...item,_feedStatus:"pending"}));
  return {
    items:[...liveItems,...pendingItems],
    live,
    candidate,
    liveCount:liveItems.length,
    pendingCount:pendingItems.length
  };
}

async function initJobs(){
  const feed=await loadVisibleFeed("jobs"),items=feed.items;
  const search=$("#job-search"),language=$("#job-language"),wh=$("#job-wh"),housing=$("#job-housing"),sort=$("#job-sort"),list=$("#job-list"),count=$("#job-count");
  const japaneseLabel={none:"Japanese not required",basic:"Japanese: basic",conversational:"Japanese: conversational",business:"Japanese: business",native:"Japanese: native",unknown:"Japanese not stated"};
  const whLabel={explicitly_accepted:"Working Holiday explicitly accepted",likely_compatible:"Working Holiday likely compatible",unknown:"Working Holiday not stated"};
  const accommodationLabel={provided:"Staff housing provided",subsidized:"Subsidised staff housing",not_stated:"Staff housing not stated"};

  function render(){
    const q=search.value.trim().toLowerCase();
    let filtered=items.filter(item=>{
      const haystack=[item.title,item.employer,item.city,item.prefecture].join(" ").toLowerCase();
      const accommodation=item.accommodation_status||(item.accommodation_provided===true?"provided":"not_stated");
      return (!q||haystack.includes(q))
        &&(!language.value||item.japanese_level===language.value)
        &&(!wh.value||item.working_holiday===wh.value)
        &&(!housing.value||accommodation===housing.value);
    });

    filtered=[...filtered].sort((a,b)=>{
      if(sort.value==="pay_desc") return (b.salary_max_jpy??-1)-(a.salary_max_jpy??-1);
      if(sort.value==="pay_asc") return (a.salary_min_jpy??Number.MAX_SAFE_INTEGER)-(b.salary_min_jpy??Number.MAX_SAFE_INTEGER);
      if(sort.value==="start") return String(a.start_date||"9999-12-31").localeCompare(String(b.start_date||"9999-12-31"));
      return String(b.last_seen||"").localeCompare(String(a.last_seen||""));
    });

    count.textContent=filtered.length+" "+(filtered.length===1?"listing":"listings")+" · "+feed.liveCount+" live · "+feed.pendingCount+" pending review";
    list.innerHTML=filtered.length?filtered.map(item=>{
      const accommodation=item.accommodation_status||(item.accommodation_provided===true?"provided":"not_stated");
      const details=[
        tag(item._feedStatus==="live"?"Live":"Pending review"),
        item.salary_display?tag(item.salary_display):"",
        item.start_date?tag("Starts "+item.start_date):"",
        item.japanese_level?tag(japaneseLabel[item.japanese_level]||item.japanese_level):"",
        item.working_holiday?tag(whLabel[item.working_holiday]||item.working_holiday):"",
        tag(accommodationLabel[accommodation]||accommodation)
      ].join("");
      const provenance=item._feedStatus==="live"
        ?"Live · verified from employer source "+item.last_seen
        :"Pending review · direct employer source observed "+item.last_seen;
      return '<article class="listing-card"><div><h2>'+esc(item.title)+'</h2><div class="muted">'+esc(item.employer)+" · "+esc([item.city,item.prefecture].filter(Boolean).join(", "))+'</div><div class="listing-meta">'+details+'</div>'+(item.accommodation_note?'<p class="listing-note">'+esc(item.accommodation_note)+'</p>':"")+'<p class="listing-verified">'+esc(provenance)+'</p></div><div class="listing-actions">'+saveButton("jobs",item.id)+'<a class="source-link" href="'+esc(item.source_url)+'" target="_blank" rel="noopener noreferrer">Employer page ↗</a></div></article>';
    }).join(""):empty(items.length?"No matching jobs":"No direct-source jobs yet",items.length?"Try changing the filters.":"No current direct-employer listing is available yet.");
  }
  [search,language,wh,housing,sort].forEach(el=>el.addEventListener("input",render));
  list.addEventListener("click",event=>{
    const button=event.target.closest("[data-save-type]");
    if(!button) return;
    toggleSaved(button.dataset.saveType,button.dataset.saveId);
    render();
  });
  render();
}

async function initHousing(){
  const feed=await loadVisibleFeed("housing"),items=feed.items;
  const search=$("#housing-search"),maxRent=$("#housing-max-rent"),furnished=$("#housing-furnished"),foreigner=$("#housing-foreigner"),sort=$("#housing-sort"),list=$("#housing-list"),count=$("#housing-count");
  function render(){
    const q=search.value.trim().toLowerCase();
    let filtered=items.filter(item=>{
      const haystack=[item.name,item.city,item.prefecture,item.nearest_station,item.source_name].join(" ").toLowerCase();
      const withinBudget=!maxRent.value||Number(item.monthly_rent_jpy||Infinity)<=Number(maxRent.value);
      return (!q||haystack.includes(q))
        &&withinBudget
        &&(!furnished.value||String(item.furnished)===furnished.value)
        &&(!foreigner.value||item.foreigner_eligibility===foreigner.value);
    });

    filtered=[...filtered].sort((a,b)=>{
      if(sort.value==="rent_asc") return (a.monthly_rent_jpy??Number.MAX_SAFE_INTEGER)-(b.monthly_rent_jpy??Number.MAX_SAFE_INTEGER);
      if(sort.value==="rent_desc") return (b.monthly_rent_jpy??-1)-(a.monthly_rent_jpy??-1);
      if(sort.value==="recent") return String(b.last_seen||"").localeCompare(String(a.last_seen||""));
      return String(a.available_from||"9999-12-31").localeCompare(String(b.available_from||"9999-12-31"));
    });

    count.textContent=filtered.length+" "+(filtered.length===1?"option":"options")+" · "+feed.liveCount+" live · "+feed.pendingCount+" pending review";
    list.innerHTML=filtered.length?filtered.map(item=>{
      const details=[
        tag(item._feedStatus==="live"?"Live":"Pending review"),
        item.monthly_rent_display?tag(item.monthly_rent_display):"",
        item.available_from?tag("Available "+item.available_from):"",
        item.furnished===true?tag("Furnished"):"",
        item.minimum_stay?tag(item.minimum_stay):"",
        item.foreigner_eligibility==="explicitly_accepted"?tag("Foreign residents accepted"):tag("Eligibility not stated")
      ].join("");
      const provenance=item._feedStatus==="live"
        ?"Live · verified from "+item.source_name+" "+item.last_seen
        :"Pending review · direct provider source observed "+item.last_seen;
      return '<article class="listing-card"><div><h2>'+esc(item.name)+'</h2><div class="muted">'+esc([item.city,item.prefecture,item.nearest_station].filter(Boolean).join(" · "))+'</div><div class="listing-meta">'+details+'</div>'+(item.upfront_fee_display?'<p class="listing-note">'+esc(item.upfront_fee_display)+'</p>':"")+'<p class="listing-verified">'+esc(provenance)+'</p></div><div class="listing-actions">'+saveButton("housing",item.id)+'<a class="source-link" href="'+esc(item.source_url)+'" target="_blank" rel="noopener noreferrer">Provider page ↗</a></div></article>';
    }).join(""):empty(items.length?"No matching housing":"No direct-source housing yet",items.length?"Try changing the filters.":"No current direct-provider option is available yet.");
  }
  [search,maxRent,furnished,foreigner,sort].forEach(el=>el.addEventListener("input",render));
  list.addEventListener("click",event=>{
    const button=event.target.closest("[data-save-type]");
    if(!button) return;
    toggleSaved(button.dataset.saveType,button.dataset.saveId);
    render();
  });
  render();
}

async function initApplication(){
  const markets=await loadJSON("data/live/visa-markets.json");
  const countryNames=new Map([
    ...(markets.partner_countries||[]).map(item=>[item.code,item.name]),
    ...(markets.reference_countries||[]).map(item=>[item.code,item.name])
  ]);
  const marketSelect=$("#visa-market");
  const detailedCodes=Object.keys(markets.detailed_planners||{});
  const partnerByCode=new Map((markets.partner_countries||[]).map(item=>[item.code,item]));
  const referenceByCode=new Map((markets.reference_countries||[]).map(item=>[item.code,item]));
  const allMarkets=[
    ...(markets.partner_countries||[]).map(item=>({...item,working_holiday_available:true})),
    ...(markets.reference_countries||[]).map(item=>({...item,working_holiday_available:false}))
  ].sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  marketSelect.innerHTML=allMarkets.map(item=>{
    const suffix=detailedCodes.includes(item.code)?"detailed planner":(item.working_holiday_available?"WH partner":"no current WH arrangement");
    return '<option value="'+esc(item.code)+'">'+esc(item.name+" — "+suffix)+'</option>';
  }).join("");
  let selected=getVisaMarket();
  if(!allMarkets.some(item=>item.code===selected)) selected="GB";
  marketSelect.value=selected;
  marketSelect.addEventListener("change",()=>{
    writeLocal(VISA_MARKET_KEY,{market:marketSelect.value});
    location.reload();
  });

  $("#market-verified").textContent="MOFA list verified "+markets.verified_at;
  $("#visa-market-note").textContent=detailedCodes.length+" detailed country planners are available. Every partner and reference market in the registry can now be selected; unsupported countries receive a status-only view instead of guessed application rules.";

  const names=codes=>codes.map(code=>countryNames.get(code)||code).join(", ");
  $("#market-coverage").innerHTML=(markets.coverage_groups||[]).map(group=>{
    const eligible=group.eligible_codes||[];
    const unavailable=group.unavailable_codes||[];
    const detailed=eligible.filter(code=>detailedCodes.includes(code)).length;
    const status=eligible.length+" eligible · "+detailed+" detailed planner"+(detailed===1?"":"s");
    const body=(group.summary?group.summary+" ":"")+"Eligible: "+names(eligible)+(unavailable.length?" · No current arrangement: "+names(unavailable):"");
    return '<article class="market-card"><span>'+esc(status)+'</span><strong>'+esc(group.label)+'</strong><p>'+esc(body)+'</p></article>';
  }).join("");

  const ruleset=markets.detailed_planners[selected];
  const marketStatus=$("#market-status-detail");
  const detailedPlanner=$("#detailed-planner");
  if(!ruleset){
    detailedPlanner.hidden=true;
    marketStatus.hidden=false;
    const partner=partnerByCode.get(selected);
    const reference=referenceByCode.get(selected);
    const marketName=countryNames.get(selected)||selected;
    if(partner){
      marketStatus.innerHTML=
        '<p class="eyebrow">Working Holiday status</p>'+
        '<h2>'+esc(marketName+" → Japan")+'</h2>'+
        '<div class="route-status open"><strong>Current Working Holiday partner</strong><p>Japan currently lists '+esc(marketName)+' as a Working Holiday partner, but JWHV Hub does not yet have a country-specific application ruleset for this passport market. Use the official MOFA programme page and your local Japanese mission rather than applying another country\'s rules.</p></div>'+
        '<div class="listing-meta"><a class="tag" href="https://www.mofa.go.jp/j_info/visit/w_holiday/" target="_blank" rel="noopener noreferrer">MOFA Working Holiday Programmes ↗</a></div>';
    }else if(reference?.guide){
      const guide=reference.guide;
      marketStatus.innerHTML=
        '<p class="eyebrow">Working Holiday status</p>'+
        '<h2>'+esc(guide.title||marketName+" → Japan")+'</h2>'+
        '<div class="route-status warning"><strong>'+esc(guide.label)+'</strong><p>'+esc(guide.detail||reference.reason||"")+'</p></div>'+
        '<div class="visa-summary">'+(guide.facts||[]).map(fact=>'<div class="fact"><span>'+esc(fact.label)+'</span><strong>'+esc(fact.value)+'</strong></div>').join("")+'</div>'+
        ((guide.next_steps||[]).length?'<div class="market-next-steps"><h3>What to do instead</h3><ol>'+(guide.next_steps||[]).map(step=>'<li>'+esc(step)+'</li>').join("")+'</ol></div>':"")+
        '<div class="listing-meta">'+(guide.official_sources||[]).map(source=>'<a class="tag" href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.name)+" ↗</a>").join("")+'</div>';
    }else{
      marketStatus.innerHTML=
        '<p class="eyebrow">Working Holiday status</p>'+
        '<h2>'+esc(marketName+" → Japan")+'</h2>'+
        '<div class="route-status warning"><strong>No current Japan Working Holiday arrangement</strong><p>'+esc(reference?.reason||"This passport market is not in Japan's current Working Holiday partner list.")+'</p></div>'+
        '<div class="listing-meta"><a class="tag" href="https://www.mofa.go.jp/j_info/visit/w_holiday/" target="_blank" rel="noopener noreferrer">MOFA Working Holiday Programmes ↗</a></div>';
    }
    return;
  }
  detailedPlanner.hidden=false;
  marketStatus.hidden=true;
  const visa=await loadJSON("data/live/"+ruleset);
  const marketName=countryNames.get(selected)||selected;
  $("#visa-route-title").textContent=(visa.market_label||marketName+" → Japan");
  $("#visa-verified").textContent="Verified "+visa.verified_at;
  const routeNotice=$("#visa-route-notice");
  if(visa.application_status){
    const noticeClass=visa.application_status.status==="open"?"route-status open":"route-status warning";
    routeNotice.innerHTML='<div class="'+noticeClass+'"><strong>'+esc(visa.application_status.label)+'</strong><p>'+esc(visa.application_status.detail||"")+'</p></div>';
  }else{
    routeNotice.innerHTML="";
  }
  $("#visa-summary").innerHTML=(visa.summary_facts||[]).map(fact=>'<div class="fact"><span>'+esc(fact.label)+'</span><strong>'+esc(fact.value)+'</strong></div>').join("");
  $("#official-source-links").innerHTML=(visa.official_sources||[]).map(source=>'<a class="tag" href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.name)+" ↗</a>").join("");

  const eligibilityKey="jwhv-hub:eligibility:v2:"+selected;
  const legacyEligibility=selected==="GB"?readLocal("jwhv-hub:eligibility:v1",{}):{};
  const eligibilitySaved=readLocal(eligibilityKey,legacyEligibility);
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
  const area=$("#jurisdiction-area");
  $("#funds-label").textContent=visa.funds_rule.input_label||("Funds shown in your bank statements ("+(visa.currency_symbol||visa.funds_rule.currency)+")");
  $("#bank-funds").placeholder=String(visa.funds_rule.no_ticket_minimum||visa.funds_rule.with_return_ticket_minimum||"");
  $("#residence-label").textContent=visa.jurisdiction.ui_label||"Application route";
  $("#residence-help").textContent=visa.jurisdiction.ui_help||visa.jurisdiction.description||"Follow the current official mission instructions.";
  area.innerHTML='<option value="">Choose…</option>'+(visa.jurisdiction.options||[]).map(option=>'<option value="'+esc(option.value)+'">'+esc(option.label)+'</option>').join("");
  $("#previous-extension-wrap").hidden=!visa.participation_rule.extension_counts_toward_total_years;

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

  function currentRouteOption(){
    return (visa.jurisdiction.options||[]).find(item=>item.value===area.value);
  }
  function currentFundsRule(){
    const route=currentRouteOption();
    return route?.funds_rule?{...visa.funds_rule,...route.funds_rule}:visa.funds_rule;
  }
  function syncFundsUI(){
    const rule=currentFundsRule();
    $("#funds-label").textContent=rule.input_label||visa.funds_rule.input_label||("Funds shown in your bank statements ("+(visa.currency_symbol||rule.currency||visa.funds_rule.currency)+")");
    $("#bank-funds").placeholder=String(rule.no_ticket_minimum||rule.with_return_ticket_minimum||"");
  }

  function renderMission(){
    const option=currentRouteOption();
    const label=option?.mission_label||"Answer the application-route question";
    const detail=option?.mission_detail||"Use the selected country ruleset to identify the correct application route.";
    $("#mission-card").innerHTML='<span class="small-label">YOUR MISSION</span><strong>'+esc(label)+'</strong><p class="muted">'+esc(detail)+'</p>';
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
    const fundsRule=currentFundsRule();
    const symbol=fundsRule.currency_symbol||(fundsRule.currency==="GBP"?"£":(fundsRule.currency||visa.funds_rule.currency)+" ");
    if(fundsRaw==="") pending.push("Proof-of-funds amount");
    else{
      const funds=Number(fundsRaw);
      const withTicket=fundsRule.with_return_ticket_minimum;
      const withoutTicket=fundsRule.no_ticket_minimum;
      if(ticket==="") pending.push("Return/onward ticket evidence");
      else if(ticket==="yes"&&Number.isFinite(withTicket)&&funds<withTicket){
        issues.push("The entered funds are below the current baseline of "+symbol+withTicket+" when return/onward-ticket evidence is provided.");
      }else if(ticket==="no"){
        if(Number.isFinite(withoutTicket)&&funds<withoutTicket){
          issues.push("The entered funds are below the current baseline of "+symbol+withoutTicket+" without return/onward-ticket evidence.");
        }else if(!Number.isFinite(withoutTicket)){
          if(Number.isFinite(withTicket)&&funds<withTicket) issues.push("The entered funds are below the current baseline of "+symbol+withTicket+".");
        }
        if(fundsRule.no_ticket_note) pending.push(fundsRule.no_ticket_note);
      }
      if(!Number.isFinite(withTicket)&&!Number.isFinite(withoutTicket)&&fundsRule.guidance_note){
        pending.push(fundsRule.guidance_note);
      }
    }

    const prior=$("#prior-visas").value;
    const extension=$("#previous-extension").value;
    if(prior==="") pending.push("Previous Working Holiday participation");
    else if(Number(prior)>=visa.participation_rule.max_total_participations){
      issues.push("The selected programme's current participation limit would be exceeded by the previous visas entered.");
    }else if(visa.participation_rule.extension_counts_toward_total_years&&prior==="1"){
      if(extension==="") pending.push("Previous extension history");
      else if(extension==="yes") issues.push("A second year obtained by extending a first Working Holiday stay counts toward the current participation limit.");
    }

    if(area.value==="") pending.push(visa.jurisdiction.ui_label||"Application route");
    const routeOption=currentRouteOption();
    if(routeOption?.issue) issues.push(routeOption.issue);

    const result=$("#eligibility-result");
    if(issues.length){
      result.className="eligibility-result fail";
      result.innerHTML="<strong>This pre-check found "+issues.length+" issue"+(issues.length===1?"":"s")+".</strong><ul>"+issues.map(issue=>"<li>"+esc(issue)+"</li>").join("")+"</ul><p>Check the official source before deciding whether or how to apply.</p>";
    }else if(pending.length){
      result.className="eligibility-result neutral";
      result.innerHTML="<strong>No conflict found in the answers provided so far.</strong><p>Complete or independently verify "+pending.length+" remaining item"+(pending.length===1?"":"s")+" for a fuller pre-check.</p>";
    }else{
      result.className="eligibility-result pass";
      result.innerHTML="<strong>Your answers match the baseline rules in the currently verified ruleset.</strong><p>This is not an approval or guarantee. Re-check the official guidance before applying.</p>";
    }
    renderMission();
    saveEligibility();
  }

  eligibilityForm.addEventListener("input",evaluateEligibility);
  for(const id of specialIds) $("#"+id)?.addEventListener("input",evaluateEligibility);
  area.addEventListener("input",syncFundsUI);
  syncFundsUI();
  evaluateEligibility();

  const progressKey=VISA_PROGRESS_KEY+":"+selected;
  const legacyProgress=selected==="GB"?readLocal(VISA_PROGRESS_KEY,{}):{};
  const savedProgress=readLocal(progressKey,legacyProgress);
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

  const workspaceKey="jwhv-hub:workspace:v2:"+selected;
  const legacyWorkspace=selected==="GB"?readLocal("jwhv-hub:workspace:v1",{statement:"",months:{}}):{statement:"",months:{}};
  const workspace=readLocal(workspaceKey,legacyWorkspace);
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
    const lines=["Japan Working Holiday planning notes — "+marketName,"","Statement of Purpose notes","--------------------------",data.statement||"(blank)","","12-month itinerary notes","------------------------"];
    for(let month=1;month<=12;month++) lines.push("Month "+month+": "+(data.months?.[month]||"(blank)"));
    lines.push("","","Generated locally by JWHV Hub. Reformat these notes into the current official documents/forms before applying.");
    const blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="japan-working-holiday-planning-notes-"+selected.toLowerCase()+".txt";a.click();
    URL.revokeObjectURL(url);
  });
}

function planMilestones(targetArrival){
  if(!targetArrival) return [];
  const definitions=[
    {id:"official-check",offset:-112,title:"Confirm current visa route and official requirements",body:"Open the current Japanese mission guidance and confirm the application route that applies to you."},
    {id:"application-pack",offset:-84,title:"Build your application pack",body:"Work through the visa planner, statement notes and proposed itinerary while leaving time to correct missing items."},
    {id:"job-search",offset:-70,title:"Build a job shortlist",body:"Save direct-employer roles that fit your likely arrival window, language level and housing needs."},
    {id:"housing-search",offset:-56,title:"Build a housing shortlist",body:"Compare furnished monthly options and check availability against your expected arrival."},
    {id:"appointment-check",offset:-42,title:"Check appointment instructions and availability",body:"Use the responsible Japanese mission's current official instructions. This milestone is a planning reminder, not an official deadline."},
    {id:"budget-review",offset:-28,title:"Review your arrival budget",body:"Re-check saved housing costs, upfront fees, transport and initial living expenses before committing."},
    {id:"source-recheck",offset:-14,title:"Re-check every saved source",body:"Confirm jobs remain open and housing is still available directly with the employer or provider."},
    {id:"arrival-week",offset:-3,title:"Prepare arrival-week essentials",body:"Keep the documents and booking details you need accessible and verify your first accommodation and onward plan."}
  ];
  return definitions.map(item=>({...item,date:isoDate(shiftDays(targetArrival,item.offset))}));
}

async function initPlan(){
  const markets=await loadJSON("data/live/visa-markets.json");
  const market=getVisaMarket();
  const ruleset=markets.detailed_planners?.[market]||null;
  const [jobsFeed,housingFeed]=await Promise.all([
    loadVisibleFeed("jobs"),
    loadVisibleFeed("housing")
  ]);
  const visa=ruleset?await loadJSON("data/live/"+ruleset):null;
  const marketEntry=[...(markets.partner_countries||[]),...(markets.reference_countries||[])].find(item=>item.code===market);
  const marketName=marketEntry?.name||market;
  const plan=getMovePlan();
  const shortlist=getShortlist();
  const savedJobs=jobsFeed.items.filter(item=>shortlist.jobs.includes(item.id));
  const savedHousing=housingFeed.items.filter(item=>shortlist.housing.includes(item.id));
  const visaState=visa?visaProgressSummary(visa,market):{complete:0,total:0,pct:0};
  const arrival=$("#target-arrival");
  arrival.value=plan.targetArrival||"";

  function render(){
    const current=getMovePlan();
    const target=current.targetArrival;
    const targetDate=parseLocalDate(target);
    const today=new Date();
    today.setHours(12,0,0,0);

    if(targetDate){
      const days=daysBetween(today,targetDate);
      $("#plan-countdown").textContent=days>=0?(days+" days to Japan"):(Math.abs(days)+" days past target");
      $("#plan-countdown-copy").textContent="Target arrival: "+target+". Adjust it any time; milestones recalculate automatically.";
    }else{
      $("#plan-countdown").textContent="Choose a date";
      $("#plan-countdown-copy").textContent="Your planning milestones will be calculated relative to the date you choose.";
    }

    const visaMetric=visa
      ?["Visa preparation",visaState.pct+"%",visaState.complete+" of "+visaState.total+" local checklist items · "+marketName]
      :["Visa route","Status only",marketName+" does not currently have a detailed JWHV Hub planner"];
    $("#plan-metrics").innerHTML=[
      visaMetric,
      ["Saved jobs",savedJobs.length,savedJobs.length?"Options worth revisiting":"Save roles from the Jobs page"],
      ["Saved housing",savedHousing.length,savedHousing.length?"Options worth revisiting":"Save places from the Housing page"]
    ].map(([label,value,detail])=>'<article class="status-card"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></article>').join("");

    const actions=[];
    if(!target) actions.push({title:"Set a target arrival date",body:"This unlocks your planning timeline and countdown.",href:"#target-arrival"});
    if(visa&&visaState.pct<100) actions.push({title:"Continue visa preparation",body:visaState.complete+" of "+visaState.total+" local checklist items are complete for "+marketName+".",href:"application.html"});
    if(!visa) actions.push({title:"Review your passport-market guidance",body:"JWHV Hub has status information for "+marketName+" but not a detailed country-specific checklist. Do not use another country's visa rules.",href:"application.html"});
    if(!savedJobs.length) actions.push({title:"Save some job options",body:"Use direct-employer listings to build a shortlist before comparing dates and locations.",href:"jobs.html"});
    if(!savedHousing.length) actions.push({title:"Save some housing options",body:"Add furnished monthly options so you can compare cost and availability.",href:"housing.html"});
    if(savedJobs.length&&savedHousing.length) actions.push({title:"Review your shortlist together",body:"Compare start dates, locations, rent and staff-housing options before narrowing down.",href:"shortlist.html"});
    if(visa&&targetDate&&daysBetween(today,targetDate)<=45&&visaState.pct<100) actions.unshift({title:"Prioritise unfinished application preparation",body:"Your target arrival is relatively close and your local checklist is not complete. Check the official application instructions before relying on this date.",href:"application.html"});
    if(!actions.length) actions.push({title:"Re-check your sources",body:"Your local plan is well populated. Re-open the official visa guidance and each saved employer/provider page before committing.",href:"shortlist.html"});

    $("#next-actions").innerHTML=actions.slice(0,4).map((item,index)=>
      '<a class="action-card" href="'+esc(item.href)+'"><span class="feature-number">0'+(index+1)+'</span><div><h3>'+esc(item.title)+'</h3><p>'+esc(item.body)+'</p></div><span aria-hidden="true">→</span></a>'
    ).join("");

    const milestones=planMilestones(target);
    const timeline=$("#move-timeline");
    if(!milestones.length){
      timeline.innerHTML=empty("Set your arrival date","Choose a target arrival above to generate a private planning timeline.");
    }else{
      timeline.innerHTML=milestones.map(item=>{
        const done=Boolean(current.timelineDone?.[item.id]);
        const due=parseLocalDate(item.date);
        const relative=daysBetween(today,due);
        const timing=relative<0?Math.abs(relative)+" days ago":relative===0?"Today":relative+" days away";
        return '<label class="timeline-item'+(done?" complete":"")+'"><input type="checkbox" data-milestone-id="'+esc(item.id)+'" '+(done?"checked":"")+'><span class="timeline-date"><strong>'+esc(item.date)+'</strong><small>'+esc(timing)+'</small></span><span><strong>'+esc(item.title)+'</strong><p>'+esc(item.body)+'</p></span></label>';
      }).join("");
    }

    const jobMin=savedJobs.map(item=>item.salary_min_jpy).filter(Number.isFinite);
    const jobMax=savedJobs.map(item=>item.salary_max_jpy).filter(Number.isFinite);
    const rents=savedHousing.map(item=>item.monthly_rent_jpy).filter(Number.isFinite);
    const optionCards=[];
    if(savedJobs.length){
      optionCards.push('<article class="plan-option-card"><span>Saved work</span><strong>'+savedJobs.length+' role'+(savedJobs.length===1?"":"s")+'</strong><p>'+(jobMin.length&&jobMax.length?esc(formatJPY(Math.min(...jobMin))+"–"+formatJPY(Math.max(...jobMax))+" / hour across saved roles"):"Pay varies by source")+'</p></article>');
    }
    if(savedHousing.length){
      optionCards.push('<article class="plan-option-card"><span>Saved housing</span><strong>'+savedHousing.length+' option'+(savedHousing.length===1?"":"s")+'</strong><p>'+(rents.length?esc("Lowest saved monthly total: "+formatJPY(Math.min(...rents))):"Check provider pages for current rent")+'</p></article>');
    }
    $("#plan-options").innerHTML=optionCards.length?optionCards.join(""):empty("No saved options yet","Save jobs and housing to build a snapshot here.");
  }

  arrival.addEventListener("change",()=>{
    const state=getMovePlan();
    state.targetArrival=arrival.value;
    writeLocal(MOVE_PLAN_KEY,state);
    render();
  });

  $("#move-timeline").addEventListener("change",event=>{
    const box=event.target.closest("[data-milestone-id]");
    if(!box) return;
    const state=getMovePlan();
    state.timelineDone=state.timelineDone||{};
    state.timelineDone[box.dataset.milestoneId]=box.checked;
    writeLocal(MOVE_PLAN_KEY,state);
    render();
  });

  $("#download-move-plan").addEventListener("click",()=>{
    const state=getMovePlan();
    const milestones=planMilestones(state.targetArrival);
    const lines=[
      "Japan Working Holiday move plan",
      "",
      "Target arrival: "+(state.targetArrival||"(not set)"),
      "Passport market: "+marketName,
      "Visa preparation: "+(visa?(visaState.pct+"% ("+visaState.complete+"/"+visaState.total+")"):"No detailed planner available"),
      "Saved jobs: "+savedJobs.length,
      "Saved housing: "+savedHousing.length,
      "",
      "Planning milestones",
      "-------------------"
    ];
    for(const item of milestones){
      lines.push((state.timelineDone?.[item.id]?"[x] ":"[ ] ")+item.date+" — "+item.title);
    }
    lines.push("","This file contains planning suggestions, not official visa deadlines. Re-check current Japanese mission guidance and original listing sources.");
    const blob=new Blob([lines.join("\n")],{type:"text/plain;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download="japan-working-holiday-move-plan.txt";a.click();
    URL.revokeObjectURL(url);
  });

  render();
}

async function initHome(){
  const plan=getMovePlan();
  const shortlist=getShortlist();
  const card=$("#home-plan-summary");
  if(!card) return;
  const targetDate=parseLocalDate(plan.targetArrival);
  const today=new Date();today.setHours(12,0,0,0);
  const countdown=targetDate?daysBetween(today,targetDate):null;
  card.innerHTML='<p class="small-label">YOUR LOCAL PLAN</p>'+
    '<strong>'+(countdown===null?"Start your move plan":(countdown>=0?esc(countdown+" days to Japan"):esc(Math.abs(countdown)+" days past target")))+'</strong>'+
    '<p>'+esc(shortlist.jobs.length+" saved jobs · "+shortlist.housing.length+" saved housing")+'</p>'+
    '<p><a class="card-link" href="plan.html">'+(countdown===null?"Set target arrival":"Open my plan")+' →</a></p>';
}

async function initShortlist(){
  const [jobsFeed,housingFeed]=await Promise.all([
    loadVisibleFeed("jobs"),
    loadVisibleFeed("housing")
  ]);
  const state=getShortlist();
  const jobs=jobsFeed.items.filter(item=>state.jobs.includes(item.id));
  const housing=housingFeed.items.filter(item=>state.housing.includes(item.id));

  $("#shortlist-summary").innerHTML=
    '<article class="status-card"><span>Saved jobs</span><strong>'+jobs.length+'</strong><small>Stored in this browser</small></article>'+
    '<article class="status-card"><span>Saved housing</span><strong>'+housing.length+'</strong><small>Stored in this browser</small></article>';

  const jobsList=$("#shortlist-jobs");
  jobsList.innerHTML=jobs.length?jobs.map(item=>
    '<article class="listing-card"><div><h2>'+esc(item.title)+'</h2><div class="muted">'+esc(item.employer)+" · "+esc([item.city,item.prefecture].filter(Boolean).join(", "))+'</div><div class="listing-meta">'+tag(item._feedStatus==="live"?"Live":"Pending review")+(item.salary_display?tag(item.salary_display):"")+(item.start_date?tag("Starts "+item.start_date):"")+'</div></div><div class="listing-actions"><button class="save-button saved" type="button" data-remove-type="jobs" data-remove-id="'+esc(item.id)+'">Remove</button><a class="source-link" href="'+esc(item.source_url)+'" target="_blank" rel="noopener noreferrer">Employer page ↗</a></div></article>'
  ).join(""):empty("No saved jobs","Save jobs from the Jobs page and they will appear here.");

  const housingList=$("#shortlist-housing");
  housingList.innerHTML=housing.length?housing.map(item=>
    '<article class="listing-card"><div><h2>'+esc(item.name)+'</h2><div class="muted">'+esc([item.city,item.prefecture,item.nearest_station].filter(Boolean).join(" · "))+'</div><div class="listing-meta">'+tag(item._feedStatus==="live"?"Live":"Pending review")+(item.monthly_rent_display?tag(item.monthly_rent_display):"")+(item.available_from?tag("Available "+item.available_from):"")+'</div></div><div class="listing-actions"><button class="save-button saved" type="button" data-remove-type="housing" data-remove-id="'+esc(item.id)+'">Remove</button><a class="source-link" href="'+esc(item.source_url)+'" target="_blank" rel="noopener noreferrer">Provider page ↗</a></div></article>'
  ).join(""):empty("No saved housing","Save housing from the Housing page and it will appear here.");

  document.querySelector("main").addEventListener("click",event=>{
    const button=event.target.closest("[data-remove-type]");
    if(!button) return;
    toggleSaved(button.dataset.removeType,button.dataset.removeId);
    initShortlist();
  },{once:true});
}

async function initStatus(){
  const [state,jobsFeed,housingFeed,markets]=await Promise.all([
    loadJSON("data/worker-state.json"),
    loadVisibleFeed("jobs"),
    loadVisibleFeed("housing"),
    loadJSON("data/live/visa-markets.json")
  ]);
  const summary=$("#status-summary");
  summary.innerHTML=[
    ["Jobs",jobsFeed.items.length,jobsFeed.liveCount+" live · "+jobsFeed.pendingCount+" pending"],
    ["Housing",housingFeed.items.length,housingFeed.liveCount+" live · "+housingFeed.pendingCount+" pending"],
    ["Visa coverage",(markets.partner_countries||[]).length+" partner markets",Object.keys(markets.detailed_planners||{}).length+" detailed planners · verified "+markets.verified_at]
  ].map(([label,value,detail])=>'<article class="status-card"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></article>').join("");

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
    if(page==="home") await initHome();
    if(page==="jobs") await initJobs();
    if(page==="housing") await initHousing();
    if(page==="application") await initApplication();
    if(page==="status") await initStatus();
    if(page==="shortlist") await initShortlist();
    if(page==="plan") await initPlan();
  }catch(error){
    console.error(error);
    const message=document.createElement("div");
    message.className="notice";
    message.innerHTML="<strong>Data unavailable</strong><p>The dashboard could not load its live data. Please try again later.</p>";
    document.querySelector("main")?.prepend(message);
  }
});