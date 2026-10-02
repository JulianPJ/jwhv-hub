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
const LIST_DENSITY_KEY="jwhv-hub:list-density:v1";
const LIST_PAGE_SIZE_KEY="jwhv-hub:list-page-size:v1";
const SHORTLIST_VIEW_KEY="jwhv-hub:shortlist-view:v1";
const PRIMARY_CHOICES_KEY="jwhv-hub:primary-choices:v1";
const LISTING_PROGRESS_KEY="jwhv-hub:listing-progress:v1";
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
function getPrimaryChoices(){
  const value=readLocal(PRIMARY_CHOICES_KEY,{jobs:"",housing:""});
  return {jobs:String(value.jobs||""),housing:String(value.housing||"")};
}
function togglePrimaryChoice(type,id){
  const state=getPrimaryChoices();
  state[type]=state[type]===id?"":id;
  writeLocal(PRIMARY_CHOICES_KEY,state);
  return state[type];
}
const LISTING_STAGES={
  jobs:[
    {value:"saved",label:"Saved"},
    {value:"planning",label:"Planning to apply"},
    {value:"applied",label:"Applied"},
    {value:"interview",label:"Interview"},
    {value:"offer",label:"Offer"},
    {value:"not_pursuing",label:"Not pursuing"}
  ],
  housing:[
    {value:"saved",label:"Saved"},
    {value:"planning",label:"Planning to enquire"},
    {value:"enquired",label:"Enquired"},
    {value:"applied",label:"Application sent"},
    {value:"booked",label:"Booked"},
    {value:"not_pursuing",label:"Not pursuing"}
  ]
};
function getListingProgress(){
  const state=readLocal(LISTING_PROGRESS_KEY,{jobs:{},housing:{}});
  return {
    jobs:state.jobs&&typeof state.jobs==="object"?state.jobs:{},
    housing:state.housing&&typeof state.housing==="object"?state.housing:{}
  };
}
function listingStage(type,id){
  return getListingProgress()[type]?.[id]||"saved";
}
function listingStageLabel(type,value){
  return LISTING_STAGES[type]?.find(stage=>stage.value===value)?.label||value||"Saved";
}
function setListingStage(type,id,value){
  const allowed=new Set((LISTING_STAGES[type]||[]).map(stage=>stage.value));
  const state=getListingProgress();
  if(!allowed.has(value)||value==="saved") delete state[type][id];
  else state[type][id]=value;
  writeLocal(LISTING_PROGRESS_KEY,state);
}
function listingStageSelect(type,id){
  const current=listingStage(type,id);
  return '<label class="stage-control">Stage<select data-stage-type="'+esc(type)+'" data-stage-id="'+esc(id)+'">'+(LISTING_STAGES[type]||[]).map(stage=>'<option value="'+esc(stage.value)+'" '+(stage.value===current?"selected":"")+'>'+esc(stage.label)+'</option>').join("")+'</select></label>';
}
function isSaved(type,id){return getShortlist()[type]?.includes(id)}
function toggleSaved(type,id){
  const state=getShortlist();
  const set=new Set(state[type]||[]);
  const wasSaved=set.has(id);
  if(wasSaved) set.delete(id); else set.add(id);
  state[type]=[...set];
  writeLocal(SHORTLIST_KEY,state);
  if(wasSaved){
    const primary=getPrimaryChoices();
    if(primary[type]===id){
      primary[type]="";
      writeLocal(PRIMARY_CHOICES_KEY,primary);
    }
    const progress=getListingProgress();
    delete progress[type][id];
    writeLocal(LISTING_PROGRESS_KEY,progress);
  }
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

function populateRegionSelect(select,items){
  const regions=[...new Set(items.map(item=>item.prefecture).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"en"));
  select.insertAdjacentHTML("beforeend",regions.map(region=>'<option value="'+esc(region)+'">'+esc(region)+'</option>').join(""));
}
function restoreQueryControls(controls){
  const params=new URLSearchParams(location.search);
  for(const [key,control] of Object.entries(controls)){
    if(params.has(key)) control.value=params.get(key);
  }
}
function syncQueryControls(controls,defaults={}){
  const params=new URLSearchParams();
  let active=0;
  for(const [key,control] of Object.entries(controls)){
    const value=control.value;
    const defaultValue=defaults[key]??"";
    if(value!==defaultValue){
      if(value) params.set(key,value);
      if(key!=="sort"&&value) active++;
    }
  }
  const query=params.toString();
  history.replaceState(null,"",location.pathname+(query?"?"+query:"")+location.hash);
  return active;
}
function clearQueryControls(controls,defaults={}){
  for(const [key,control] of Object.entries(controls)) control.value=defaults[key]??"";
}
function getListDensity(kind){
  const state=readLocal(LIST_DENSITY_KEY,{jobs:"dense",housing:"dense"});
  return ["dense","cards"].includes(state[kind])?state[kind]:"dense";
}
function initListDensity(kind,list){
  const buttons=[...document.querySelectorAll('[data-density-kind="'+kind+'"]')];
  const apply=value=>{
    const density=["dense","cards"].includes(value)?value:"dense";
    list.classList.toggle("dense",density==="dense");
    list.classList.toggle("cards",density==="cards");
    for(const button of buttons){
      const active=button.dataset.densityValue===density;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
    }
    const state=readLocal(LIST_DENSITY_KEY,{jobs:"dense",housing:"dense"});
    state[kind]=density;
    writeLocal(LIST_DENSITY_KEY,state);
  };
  for(const button of buttons) button.addEventListener("click",()=>apply(button.dataset.densityValue));
  apply(getListDensity(kind));
}
function getListPageSize(kind){
  const state=readLocal(LIST_PAGE_SIZE_KEY,{jobs:"25",housing:"25"});
  const value=String(state[kind]||"25");
  return ["25","50","all"].includes(value)?value:"25";
}
function setListPageSize(kind,value){
  const state=readLocal(LIST_PAGE_SIZE_KEY,{jobs:"25",housing:"25"});
  state[kind]=["25","50","all"].includes(String(value))?String(value):"25";
  writeLocal(LIST_PAGE_SIZE_KEY,state);
}
function paginateItems(items,page,pageSize){
  const size=pageSize==="all"?Math.max(items.length,1):Number(pageSize);
  const pageCount=Math.max(1,Math.ceil(items.length/size));
  const current=Math.min(Math.max(1,page),pageCount);
  const start=items.length?(current-1)*size:0;
  const end=pageSize==="all"?items.length:Math.min(start+size,items.length);
  return {items:items.slice(start,end),page:current,pageCount,start,end};
}
function renderPagination(container,{total,page,pageCount,start,end,pageSize}){
  const range=total?(start+1)+"–"+end:"0";
  container.innerHTML=
    '<span class="pagination-range">Showing '+esc(range)+' of '+esc(total)+'</span>'+
    '<div class="pagination-controls">'+
      '<button class="button secondary compact" type="button" data-page-action="prev" '+(page<=1?"disabled":"")+'>Previous</button>'+
      '<span class="pagination-page">Page '+esc(page)+' / '+esc(pageCount)+'</span>'+
      '<button class="button secondary compact" type="button" data-page-action="next" '+(page>=pageCount?"disabled":"")+'>Next</button>'+
      '<label>Per page<select data-page-size><option value="25" '+(pageSize==="25"?"selected":"")+'>25</option><option value="50" '+(pageSize==="50"?"selected":"")+'>50</option><option value="all" '+(pageSize==="all"?"selected":"")+'>All</option></select></label>'+
    '</div>';
}

async function initJobs(){
  const feed=await loadVisibleFeed("jobs"),items=feed.items;
  const search=$("#job-search"),region=$("#job-region"),status=$("#job-status"),language=$("#job-language"),wh=$("#job-wh"),housing=$("#job-housing"),sort=$("#job-sort"),clear=$("#job-clear"),filterCount=$("#job-filter-count"),list=$("#job-list"),count=$("#job-count"),pagination=$("#job-pagination");
  const controls={q:search,region,status,language,wh,housing,sort};
  const defaults={sort:"recent"};
  let page=1,pageSize=getListPageSize("jobs");
  populateRegionSelect(region,items);
  restoreQueryControls(controls);
  initListDensity("jobs",list);
  const japaneseLabel={none:"Japanese not required",basic:"Japanese: basic",conversational:"Japanese: conversational",business:"Japanese: business",native:"Japanese: native",unknown:"Japanese not stated"};
  const whLabel={explicitly_accepted:"Working Holiday explicitly accepted",likely_compatible:"Working Holiday likely compatible",unknown:"Working Holiday not stated"};
  const accommodationLabel={provided:"Staff housing provided",subsidized:"Subsidised staff housing",not_stated:"Staff housing not stated"};

  function render({resetPage=false}={}){
    if(resetPage) page=1;
    const q=search.value.trim().toLowerCase();
    let filtered=items.filter(item=>{
      const haystack=[item.title,item.employer,item.city,item.prefecture].join(" ").toLowerCase();
      const accommodation=item.accommodation_status||(item.accommodation_provided===true?"provided":"not_stated");
      return (!q||haystack.includes(q))
        &&(!region.value||item.prefecture===region.value)
        &&(!status.value||item._feedStatus===status.value)
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

    const active=syncQueryControls(controls,defaults);
    const visibleLive=filtered.filter(item=>item._feedStatus==="live").length;
    const visiblePending=filtered.length-visibleLive;
    const paged=paginateItems(filtered,page,pageSize);
    page=paged.page;
    filterCount.textContent=active?(active+" active filter"+(active===1?"":"s")):"No filters";
    clear.disabled=active===0&&sort.value===defaults.sort;
    count.textContent=filtered.length+(active?" of "+items.length:"")+" "+(filtered.length===1?"listing":"listings")+" · "+visibleLive+" verified · "+visiblePending+" pending";
    list.innerHTML=paged.items.length?paged.items.map(item=>{
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
    }).join(""):empty(items.length?"No matching jobs":"No direct-source jobs yet",items.length?"Try changing or clearing the filters.":"No current direct-employer listing is available yet.");
    renderPagination(pagination,{total:filtered.length,page:paged.page,pageCount:paged.pageCount,start:paged.start,end:paged.end,pageSize});
  }

  Object.values(controls).forEach(el=>el.addEventListener("input",()=>render({resetPage:true})));
  clear.addEventListener("click",()=>{
    clearQueryControls(controls,defaults);
    render({resetPage:true});
    search.focus();
  });
  list.addEventListener("click",event=>{
    const button=event.target.closest("[data-save-type]");
    if(!button) return;
    toggleSaved(button.dataset.saveType,button.dataset.saveId);
    render();
  });
  pagination.addEventListener("click",event=>{
    const action=event.target.closest("[data-page-action]")?.dataset.pageAction;
    if(!action) return;
    page+=action==="next"?1:-1;
    render();
    list.scrollIntoView({behavior:"smooth",block:"start"});
  });
  pagination.addEventListener("change",event=>{
    const select=event.target.closest("[data-page-size]");
    if(!select) return;
    pageSize=select.value;
    setListPageSize("jobs",pageSize);
    render({resetPage:true});
  });
  render();
}

async function initHousing(){
  const feed=await loadVisibleFeed("housing"),items=feed.items;
  const search=$("#housing-search"),region=$("#housing-region"),status=$("#housing-status"),maxRent=$("#housing-max-rent"),furnished=$("#housing-furnished"),foreigner=$("#housing-foreigner"),sort=$("#housing-sort"),clear=$("#housing-clear"),filterCount=$("#housing-filter-count"),list=$("#housing-list"),count=$("#housing-count"),pagination=$("#housing-pagination");
  const controls={q:search,region,status,max:maxRent,furnished,foreigner,sort};
  const defaults={sort:"available"};
  let page=1,pageSize=getListPageSize("housing");
  populateRegionSelect(region,items);
  restoreQueryControls(controls);
  initListDensity("housing",list);

  function render({resetPage=false}={}){
    if(resetPage) page=1;
    const q=search.value.trim().toLowerCase();
    let filtered=items.filter(item=>{
      const haystack=[item.name,item.city,item.prefecture,item.nearest_station,item.source_name].join(" ").toLowerCase();
      const withinBudget=!maxRent.value||Number(item.monthly_rent_jpy||Infinity)<=Number(maxRent.value);
      return (!q||haystack.includes(q))
        &&(!region.value||item.prefecture===region.value)
        &&(!status.value||item._feedStatus===status.value)
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

    const active=syncQueryControls(controls,defaults);
    const visibleLive=filtered.filter(item=>item._feedStatus==="live").length;
    const visiblePending=filtered.length-visibleLive;
    const paged=paginateItems(filtered,page,pageSize);
    page=paged.page;
    filterCount.textContent=active?(active+" active filter"+(active===1?"":"s")):"No filters";
    clear.disabled=active===0&&sort.value===defaults.sort;
    count.textContent=filtered.length+(active?" of "+items.length:"")+" "+(filtered.length===1?"option":"options")+" · "+visibleLive+" verified · "+visiblePending+" pending";
    list.innerHTML=paged.items.length?paged.items.map(item=>{
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
    }).join(""):empty(items.length?"No matching housing":"No direct-source housing yet",items.length?"Try changing or clearing the filters.":"No current direct-provider option is available yet.");
    renderPagination(pagination,{total:filtered.length,page:paged.page,pageCount:paged.pageCount,start:paged.start,end:paged.end,pageSize});
  }

  Object.values(controls).forEach(el=>el.addEventListener("input",()=>render({resetPage:true})));
  clear.addEventListener("click",()=>{
    clearQueryControls(controls,defaults);
    render({resetPage:true});
    search.focus();
  });
  list.addEventListener("click",event=>{
    const button=event.target.closest("[data-save-type]");
    if(!button) return;
    toggleSaved(button.dataset.saveType,button.dataset.saveId);
    render();
  });
  pagination.addEventListener("click",event=>{
    const action=event.target.closest("[data-page-action]")?.dataset.pageAction;
    if(!action) return;
    page+=action==="next"?1:-1;
    render();
    list.scrollIntoView({behavior:"smooth",block:"start"});
  });
  pagination.addEventListener("change",event=>{
    const select=event.target.closest("[data-page-size]");
    if(!select) return;
    pageSize=select.value;
    setListPageSize("housing",pageSize);
    render({resetPage:true});
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
  function fundsOptions(rule){
    if(Array.isArray(rule.ticket_options)&&rule.ticket_options.length) return rule.ticket_options;
    return [
      {value:"yes",label:"Yes — return/onward ticket evidence",minimum:rule.with_return_ticket_minimum},
      {value:"no",label:"No — no return/onward ticket evidence",minimum:rule.no_ticket_minimum,note:rule.no_ticket_note}
    ];
  }
  function syncFundsUI(){
    const rule=currentFundsRule();
    const ticket=$("#return-ticket");
    const current=ticket.value||eligibilitySaved["return-ticket"]||"";
    $("#funds-label").textContent=rule.input_label||visa.funds_rule.input_label||("Funds shown in your bank statements ("+(visa.currency_symbol||rule.currency||visa.funds_rule.currency)+")");
    $("#bank-funds").placeholder=String(rule.no_ticket_minimum||rule.with_return_ticket_minimum||"");
    $("#ticket-label").textContent=rule.ticket_label||"Flight / ticket evidence";
    ticket.innerHTML='<option value="">Choose…</option>'+fundsOptions(rule).map(option=>'<option value="'+esc(option.value)+'">'+esc(option.label)+'</option>').join("");
    if([...ticket.options].some(option=>option.value===current)) ticket.value=current;
  }
  function renderApplicationStatus(){
    const status=currentRouteOption()?.application_status||visa.application_status;
    if(status){
      const noticeClass=status.status==="open"?"route-status open":"route-status warning";
      routeNotice.innerHTML='<div class="'+noticeClass+'"><strong>'+esc(status.label)+'</strong><p>'+esc(status.detail||"")+'</p></div>';
    }else{
      routeNotice.innerHTML="";
    }
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
    const ticketOptions=fundsOptions(fundsRule);
    const selectedTicket=ticketOptions.find(option=>option.value===ticket);
    if(fundsRaw==="") pending.push("Proof-of-funds amount");
    if(ticket==="") pending.push("Flight / ticket evidence");
    if(fundsRaw!==""&&ticket!==""){
      const funds=Number(fundsRaw);
      const minimum=selectedTicket?.minimum;
      if(Number.isFinite(minimum)&&funds<minimum){
        issues.push("The entered funds are below the current baseline of "+symbol+minimum+" for the selected flight/ticket evidence.");
      }else if(!Number.isFinite(minimum)&&selectedTicket?.guidance_note){
        pending.push(selectedTicket.guidance_note);
      }else if(!Number.isFinite(minimum)&&fundsRule.guidance_note){
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
  for(const id of specialIds.filter(id=>id!=="jurisdiction-area")) $("#"+id)?.addEventListener("input",evaluateEligibility);
  area.addEventListener("input",()=>{
    syncFundsUI();
    renderApplicationStatus();
    evaluateEligibility();
  });
  syncFundsUI();
  renderApplicationStatus();
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
  const primary=getPrimaryChoices();
  const savedJobs=jobsFeed.items.filter(item=>shortlist.jobs.includes(item.id));
  const savedHousing=housingFeed.items.filter(item=>shortlist.housing.includes(item.id));
  const primaryJob=savedJobs.find(item=>item.id===primary.jobs)||null;
  const primaryHousing=savedHousing.find(item=>item.id===primary.housing)||null;
  const primaryJobMissing=Boolean(primary.jobs&&shortlist.jobs.includes(primary.jobs)&&!primaryJob);
  const primaryHousingMissing=Boolean(primary.housing&&shortlist.housing.includes(primary.housing)&&!primaryHousing);
  const primaryJobStage=primaryJob?listingStage("jobs",primaryJob.id):"";
  const primaryHousingStage=primaryHousing?listingStage("housing",primaryHousing.id):"";
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
      ["Saved jobs",savedJobs.length,primaryJob?("Primary: "+primaryJob.title+" · "+listingStageLabel("jobs",primaryJobStage)):(primaryJobMissing?"Primary choice needs attention":savedJobs.length?"Choose a primary role":"Save roles from the Jobs page")],
      ["Saved housing",savedHousing.length,primaryHousing?("Primary: "+primaryHousing.name+" · "+listingStageLabel("housing",primaryHousingStage)):(primaryHousingMissing?"Primary choice needs attention":savedHousing.length?"Choose a primary property":"Save places from the Housing page")]
    ].map(([label,value,detail])=>'<article class="status-card"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></article>').join("");

    const actions=[];
    if(!target) actions.push({title:"Set a target arrival date",body:"This unlocks your planning timeline and countdown.",href:"#target-arrival"});
    if(visa&&visaState.pct<100) actions.push({title:"Continue visa preparation",body:visaState.complete+" of "+visaState.total+" local checklist items are complete for "+marketName+".",href:"application.html"});
    if(!visa) actions.push({title:"Review your passport-market guidance",body:"JWHV Hub has status information for "+marketName+" but not a detailed country-specific checklist. Do not use another country's visa rules.",href:"application.html"});
    if(!savedJobs.length) actions.push({title:"Save some job options",body:"Use direct-employer listings to build a shortlist before comparing dates and locations.",href:"jobs.html"});
    else if(primaryJobMissing) actions.push({title:"Review your primary job",body:"Your pinned job is no longer in the active feed. Check the Shortlist before relying on it.",href:"shortlist.html"});
    else if(!primaryJob) actions.push({title:"Choose a primary job",body:"Pin the role you are most likely to pursue so My Plan can keep it visible.",href:"shortlist.html"});
    else if(["saved","planning"].includes(primaryJobStage)) actions.push({title:"Apply to your primary job",body:"Your primary role is still at "+listingStageLabel("jobs",primaryJobStage).toLowerCase()+". Re-open the employer source and move the application forward.",href:"shortlist.html"});
    else if(primaryJobStage==="applied") actions.push({title:"Track your job application",body:"Your primary role is marked Applied. Watch for an employer response and update the stage when it changes.",href:"shortlist.html"});
    else if(primaryJobStage==="interview") actions.push({title:"Prepare for your interview",body:"Your primary role is at Interview stage. Re-check the role, employer and location before the conversation.",href:"shortlist.html"});
    else if(primaryJobStage==="offer") actions.push({title:"Review your job offer carefully",body:"Your primary role is marked Offer. Confirm pay, dates, visa/work status and accommodation directly with the employer.",href:"shortlist.html"});
    else if(primaryJobStage==="not_pursuing") actions.push({title:"Choose a new primary job",body:"Your current primary role is marked Not pursuing. Pin another saved job if you still need employment.",href:"shortlist.html"});

    if(!savedHousing.length) actions.push({title:"Save some housing options",body:"Add furnished monthly options so you can compare cost and availability.",href:"housing.html"});
    else if(primaryHousingMissing) actions.push({title:"Review your primary housing",body:"Your pinned housing option is no longer in the active feed. Check the Shortlist before relying on it.",href:"shortlist.html"});
    else if(!primaryHousing) actions.push({title:"Choose primary housing",body:"Pin the property you are most likely to use so My Plan can keep it visible.",href:"shortlist.html"});
    else if(["saved","planning"].includes(primaryHousingStage)) actions.push({title:"Enquire about primary housing",body:"Your primary property is still at "+listingStageLabel("housing",primaryHousingStage).toLowerCase()+". Re-open the provider source and confirm availability/fees.",href:"shortlist.html"});
    else if(primaryHousingStage==="enquired") actions.push({title:"Follow up on your housing enquiry",body:"Your primary property is marked Enquired. Confirm availability, total fees and next steps with the provider.",href:"shortlist.html"});
    else if(primaryHousingStage==="applied") actions.push({title:"Track your housing application",body:"Your primary property is marked Application sent. Keep the provider response and payment conditions in view.",href:"shortlist.html"});
    else if(primaryHousingStage==="booked") actions.push({title:"Re-confirm your booked housing",body:"Your primary property is marked Booked. Re-check arrival instructions, payments and cancellation terms before travel.",href:"shortlist.html"});
    else if(primaryHousingStage==="not_pursuing") actions.push({title:"Choose new primary housing",body:"Your current primary property is marked Not pursuing. Pin another saved option if you still need accommodation.",href:"shortlist.html"});
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
    if(primaryJob){
      const jobDetail=[primaryJob.employer,[primaryJob.city,primaryJob.prefecture].filter(Boolean).join(", "),primaryJob.salary_display].filter(Boolean).join(" · ");
      optionCards.push('<article class="plan-option-card primary-option"><span>Primary job</span><strong>'+esc(primaryJob.title)+'</strong><p>'+esc(jobDetail)+'</p><div class="listing-meta">'+tag("Stage: "+listingStageLabel("jobs",primaryJobStage))+tag(primaryJob._feedStatus==="live"?"Verified live":"Pending review")+'</div><a class="card-link" href="'+esc(primaryJob.source_url)+'" target="_blank" rel="noopener noreferrer">Employer page ↗</a></article>');
    }else if(savedJobs.length){
      optionCards.push('<article class="plan-option-card"><span>Saved work</span><strong>'+savedJobs.length+' role'+(savedJobs.length===1?"":"s")+'</strong><p>'+(jobMin.length&&jobMax.length?esc(formatJPY(Math.min(...jobMin))+"–"+formatJPY(Math.max(...jobMax))+" / hour across saved roles"):"Pay varies by source")+'</p><a class="card-link" href="shortlist.html">Choose primary job →</a></article>');
    }
    if(primaryHousing){
      const housingDetail=[[primaryHousing.city,primaryHousing.prefecture,primaryHousing.nearest_station].filter(Boolean).join(" · "),primaryHousing.monthly_rent_display,primaryHousing.available_from?("Available "+primaryHousing.available_from):""].filter(Boolean).join(" · ");
      optionCards.push('<article class="plan-option-card primary-option"><span>Primary housing</span><strong>'+esc(primaryHousing.name)+'</strong><p>'+esc(housingDetail)+'</p><div class="listing-meta">'+tag("Stage: "+listingStageLabel("housing",primaryHousingStage))+tag(primaryHousing._feedStatus==="live"?"Verified live":"Pending review")+'</div><a class="card-link" href="'+esc(primaryHousing.source_url)+'" target="_blank" rel="noopener noreferrer">Provider page ↗</a></article>');
    }else if(savedHousing.length){
      optionCards.push('<article class="plan-option-card"><span>Saved housing</span><strong>'+savedHousing.length+' option'+(savedHousing.length===1?"":"s")+'</strong><p>'+(rents.length?esc("Lowest saved monthly total: "+formatJPY(Math.min(...rents))):"Check provider pages for current rent")+'</p><a class="card-link" href="shortlist.html">Choose primary housing →</a></article>');
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
      "Primary job: "+(primaryJob?(primaryJob.title+" — "+primaryJob.employer):(primaryJobMissing?"Saved primary is no longer in the active feed":"(not selected)")),
      "Primary job stage: "+(primaryJob?listingStageLabel("jobs",primaryJobStage):"(n/a)"),
      "Saved housing: "+savedHousing.length,
      "Primary housing: "+(primaryHousing?primaryHousing.name:(primaryHousingMissing?"Saved primary is no longer in the active feed":"(not selected)")),
      "Primary housing stage: "+(primaryHousing?listingStageLabel("housing",primaryHousingStage):"(n/a)"),
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
  const primary=getPrimaryChoices();
  const activeJobs=new Map(jobsFeed.items.map(item=>[item.id,item]));
  const activeHousing=new Map(housingFeed.items.map(item=>[item.id,item]));

  const rawRecord=(feed,id)=>{
    const live=(feed.live.items||[]).find(item=>item.id===id);
    if(live) return {...live,_rawFeed:"live"};
    const candidate=(feed.candidate.items||[]).find(item=>item.id===id);
    return candidate?{...candidate,_rawFeed:"candidate"}:null;
  };

  const jobs=state.jobs.map(id=>activeJobs.get(id)).filter(Boolean);
  const housing=state.housing.map(id=>activeHousing.get(id)).filter(Boolean);
  const missing=[
    ...state.jobs.filter(id=>!activeJobs.has(id)).map(id=>({type:"jobs",id,record:rawRecord(jobsFeed,id)})),
    ...state.housing.filter(id=>!activeHousing.has(id)).map(id=>({type:"housing",id,record:rawRecord(housingFeed,id)}))
  ];
  const verified=jobs.filter(item=>item._feedStatus==="live").length+housing.filter(item=>item._feedStatus==="live").length;

  const primaryCount=[primary.jobs,primary.housing].filter(Boolean).length;
  $("#shortlist-summary").innerHTML=[
    ["Saved jobs",state.jobs.length,jobs.length+" currently active"],
    ["Saved housing",state.housing.length,housing.length+" currently active"],
    ["Primary choices",primaryCount+" / 2",primaryCount===2?"Job and housing selected":"Choose a lead job and housing option"],
    ["Verified live",verified,"Across active saved options"],
    ["Needs attention",missing.length,missing.length?"Saved IDs outside the active feed":"No missing saved items"]
  ].map(([label,value,detail])=>'<article class="status-card"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></article>').join("");

  const jobStatus=$("#shortlist-job-status");
  const jobSort=$("#shortlist-job-sort");
  const housingStatus=$("#shortlist-housing-status");
  const housingSort=$("#shortlist-housing-sort");
  const view=readLocal(SHORTLIST_VIEW_KEY,{jobStatus:"",jobSort:"start",housingStatus:"",housingSort:"available"});
  jobStatus.value=view.jobStatus||"";
  jobSort.value=view.jobSort||"start";
  housingStatus.value=view.housingStatus||"";
  housingSort.value=view.housingSort||"available";
  const jobsList=$("#shortlist-jobs");
  const housingList=$("#shortlist-housing");

  const sortText=(a,b,key)=>String(a[key]||"").localeCompare(String(b[key]||""),"en",{sensitivity:"base"});
  const sortJobs=(items,mode)=>[...items].sort((a,b)=>{
    if(mode==="pay_desc") return (b.salary_max_jpy??b.salary_min_jpy??-1)-(a.salary_max_jpy??a.salary_min_jpy??-1);
    if(mode==="pay_asc") return (a.salary_min_jpy??a.salary_max_jpy??Number.MAX_SAFE_INTEGER)-(b.salary_min_jpy??b.salary_max_jpy??Number.MAX_SAFE_INTEGER);
    if(mode==="region") return sortText(a,b,"prefecture")||sortText(a,b,"city")||sortText(a,b,"title");
    if(mode==="title") return sortText(a,b,"title");
    return String(a.start_date||"9999-12-31").localeCompare(String(b.start_date||"9999-12-31"))||sortText(a,b,"title");
  });
  const sortHousing=(items,mode)=>[...items].sort((a,b)=>{
    if(mode==="rent_asc") return (a.monthly_rent_jpy??Number.MAX_SAFE_INTEGER)-(b.monthly_rent_jpy??Number.MAX_SAFE_INTEGER);
    if(mode==="rent_desc") return (b.monthly_rent_jpy??-1)-(a.monthly_rent_jpy??-1);
    if(mode==="region") return sortText(a,b,"prefecture")||sortText(a,b,"city")||sortText(a,b,"name");
    if(mode==="name") return sortText(a,b,"name");
    return String(a.available_from||"9999-12-31").localeCompare(String(b.available_from||"9999-12-31"))||sortText(a,b,"name");
  });

  function renderJobs(){
    const filtered=sortJobs(
      jobs.filter(item=>!jobStatus.value||item._feedStatus===jobStatus.value),
      jobSort.value
    );
    const live=filtered.filter(item=>item._feedStatus==="live").length;
    $("#shortlist-jobs-meta").innerHTML='<span>'+esc(filtered.length)+" shown · "+esc(live)+" verified · "+esc(filtered.length-live)+' pending</span><span class="muted">'+esc(state.jobs.length)+" saved job ID"+(state.jobs.length===1?"":"s")+'</span>';
    jobsList.innerHTML=filtered.length?filtered.map(item=>{
      const accommodation=item.accommodation_status||(item.accommodation_provided===true?"provided":"not_stated");
      const details=[
        tag(item._feedStatus==="live"?"Live":"Pending review"),
        item.salary_display?tag(item.salary_display):"",
        item.start_date?tag("Starts "+item.start_date):"",
        accommodation&&accommodation!=="not_stated"?tag(accommodation==="provided"?"Housing provided":"Housing "+accommodation):""
      ].join("");
      const isPrimary=primary.jobs===item.id;
      const stage=listingStage("jobs",item.id);
      return '<article class="listing-card'+(isPrimary?" primary-listing":"")+'"><div><h2>'+esc(item.title)+'</h2><div class="muted">'+esc(item.employer)+" · "+esc([item.city,item.prefecture].filter(Boolean).join(", "))+'</div><div class="listing-meta">'+(isPrimary?tag("Primary choice"):"")+tag("Stage: "+listingStageLabel("jobs",stage))+details+'</div></div><div class="listing-actions">'+listingStageSelect("jobs",item.id)+'<button class="primary-choice-button'+(isPrimary?" active":"")+'" type="button" data-primary-type="jobs" data-primary-id="'+esc(item.id)+'">'+(isPrimary?"Primary ✓":"Set primary")+'</button><button class="save-button saved" type="button" data-remove-type="jobs" data-remove-id="'+esc(item.id)+'">Remove</button><a class="source-link" href="'+esc(item.source_url)+'" target="_blank" rel="noopener noreferrer">Employer page ↗</a></div></article>';
    }).join(""):empty(jobs.length?"No saved jobs match this status":"No active saved jobs",jobs.length?"Change the status filter to see the other saved roles.":"Save jobs from the Jobs page and they will appear here.");
  }

  function renderHousing(){
    const filtered=sortHousing(
      housing.filter(item=>!housingStatus.value||item._feedStatus===housingStatus.value),
      housingSort.value
    );
    const live=filtered.filter(item=>item._feedStatus==="live").length;
    $("#shortlist-housing-meta").innerHTML='<span>'+esc(filtered.length)+" shown · "+esc(live)+" verified · "+esc(filtered.length-live)+' pending</span><span class="muted">'+esc(state.housing.length)+" saved housing ID"+(state.housing.length===1?"":"s")+'</span>';
    housingList.innerHTML=filtered.length?filtered.map(item=>{
      const details=[
        tag(item._feedStatus==="live"?"Live":"Pending review"),
        item.monthly_rent_display?tag(item.monthly_rent_display):"",
        item.available_from?tag("Available "+item.available_from):"",
        item.furnished===true?tag("Furnished"):""
      ].join("");
      const isPrimary=primary.housing===item.id;
      const stage=listingStage("housing",item.id);
      return '<article class="listing-card'+(isPrimary?" primary-listing":"")+'"><div><h2>'+esc(item.name)+'</h2><div class="muted">'+esc([item.city,item.prefecture,item.nearest_station].filter(Boolean).join(" · "))+'</div><div class="listing-meta">'+(isPrimary?tag("Primary choice"):"")+tag("Stage: "+listingStageLabel("housing",stage))+details+'</div></div><div class="listing-actions">'+listingStageSelect("housing",item.id)+'<button class="primary-choice-button'+(isPrimary?" active":"")+'" type="button" data-primary-type="housing" data-primary-id="'+esc(item.id)+'">'+(isPrimary?"Primary ✓":"Set primary")+'</button><button class="save-button saved" type="button" data-remove-type="housing" data-remove-id="'+esc(item.id)+'">Remove</button><a class="source-link" href="'+esc(item.source_url)+'" target="_blank" rel="noopener noreferrer">Provider page ↗</a></div></article>';
    }).join(""):empty(housing.length?"No saved housing matches this status":"No active saved housing",housing.length?"Change the status filter to see the other saved properties.":"Save housing from the Housing page and it will appear here.");
  }

  const missingSection=$("#shortlist-missing-section");
  const missingList=$("#shortlist-missing");
  missingSection.hidden=!missing.length;
  missingList.innerHTML=missing.map(entry=>{
    const record=entry.record;
    const name=record?(entry.type==="jobs"?record.title:record.name):entry.id;
    const status=record?.status||"not found";
    const detail=record
      ?("Repository record found in "+entry.record._rawFeed+" data · current status: "+status)
      :"Saved ID is not present in the current live or candidate feed.";
    const isPrimary=primary[entry.type]===entry.id;
    return '<article class="missing-item'+(isPrimary?" primary-listing":"")+'"><div><span class="tag">'+esc(entry.type==="jobs"?"Job":"Housing")+'</span>'+(isPrimary?tag("Primary choice"):"")+'<strong>'+esc(name||entry.id)+'</strong><p>'+esc(detail)+'</p><code>'+esc(entry.id)+'</code></div><button class="button secondary compact" type="button" data-remove-type="'+esc(entry.type)+'" data-remove-id="'+esc(entry.id)+'">Remove saved ID</button></article>';
  }).join("");

  const renderAll=()=>{
    writeLocal(SHORTLIST_VIEW_KEY,{
      jobStatus:jobStatus.value,
      jobSort:jobSort.value,
      housingStatus:housingStatus.value,
      housingSort:housingSort.value
    });
    renderJobs();
    renderHousing();
  };
  jobStatus.oninput=renderAll;
  jobSort.oninput=renderAll;
  housingStatus.oninput=renderAll;
  housingSort.oninput=renderAll;

  document.querySelector("main").onchange=event=>{
    const stageControl=event.target.closest("[data-stage-type]");
    if(!stageControl) return;
    setListingStage(stageControl.dataset.stageType,stageControl.dataset.stageId,stageControl.value);
    renderAll();
  };

  document.querySelector("main").onclick=event=>{
    const primaryButton=event.target.closest("[data-primary-type]");
    if(primaryButton){
      togglePrimaryChoice(primaryButton.dataset.primaryType,primaryButton.dataset.primaryId);
      location.reload();
      return;
    }
    const remove=event.target.closest("[data-remove-type]");
    if(remove){
      toggleSaved(remove.dataset.removeType,remove.dataset.removeId);
      location.reload();
      return;
    }
    if(event.target.closest("#shortlist-clear-missing")){
      const next=getShortlist();
      const missingJobs=new Set(missing.filter(item=>item.type==="jobs").map(item=>item.id));
      const missingHousing=new Set(missing.filter(item=>item.type==="housing").map(item=>item.id));
      next.jobs=next.jobs.filter(id=>!missingJobs.has(id));
      next.housing=next.housing.filter(id=>!missingHousing.has(id));
      writeLocal(SHORTLIST_KEY,next);
      const primaryState=getPrimaryChoices();
      if(missingJobs.has(primaryState.jobs)) primaryState.jobs="";
      if(missingHousing.has(primaryState.housing)) primaryState.housing="";
      writeLocal(PRIMARY_CHOICES_KEY,primaryState);
      const progressState=getListingProgress();
      for(const id of missingJobs) delete progressState.jobs[id];
      for(const id of missingHousing) delete progressState.housing[id];
      writeLocal(LISTING_PROGRESS_KEY,progressState);
      location.reload();
    }
  };

  renderAll();
}

async function initStatus(){
  const [state,jobsFeed,housingFeed,markets]=await Promise.all([
    loadJSON("data/worker-state.json"),
    loadVisibleFeed("jobs"),
    loadVisibleFeed("housing"),
    loadJSON("data/live/visa-markets.json")
  ]);
  const detailedEntries=Object.entries(markets.detailed_planners||{});
  const detailedRules=await Promise.all(detailedEntries.map(async([market,file])=>[market,await loadJSON("data/live/"+file)]));
  const rulesByMarket=new Map(detailedRules);
  const detailedCodes=new Set(detailedEntries.map(([market])=>market));
  const partnerCountries=markets.partner_countries||[];
  const referenceCountries=markets.reference_countries||[];
  const detailedCount=detailedCodes.size;
  const partnerCount=partnerCountries.length;
  const queue=partnerCountries.filter(item=>!detailedCodes.has(item.code)).sort((a,b)=>a.name.localeCompare(b.name));
  const coveragePct=partnerCount?Math.round(detailedCount/partnerCount*100):0;

  const summary=$("#status-summary");
  summary.innerHTML=[
    ["Jobs",jobsFeed.items.length,jobsFeed.liveCount+" live · "+jobsFeed.pendingCount+" pending"],
    ["Housing",housingFeed.items.length,housingFeed.liveCount+" live · "+housingFeed.pendingCount+" pending"],
    ["Visa coverage",detailedCount+" / "+partnerCount+" detailed",coveragePct+"% of Working Holiday partner markets · verified "+markets.verified_at]
  ].map(([label,value,detail])=>'<article class="status-card"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></article>').join("");

  $("#visa-coverage-metrics").innerHTML=[
    ["Detailed planners",detailedCount,coveragePct+"% of "+partnerCount+" partner markets"],
    ["Expansion queue",queue.length,"Eligible Working Holiday partners still status-only"],
    ["Reference markets",referenceCountries.length,"Non-partner markets tracked for safe guidance"]
  ].map(([label,value,detail])=>'<article class="status-card"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(detail)+'</small></article>').join("");

  const detailed=partnerCountries
    .filter(item=>detailedCodes.has(item.code))
    .sort((a,b)=>a.name.localeCompare(b.name));
  $("#visa-detailed-markets").innerHTML=detailed.map(item=>{
    const rules=rulesByMarket.get(item.code)||{};
    const status=rules.application_status||null;
    const statusKey=status?.status||"verified";
    const statusLabel=status?.label||"Detailed ruleset verified";
    const detail=status?.detail||"No country-level intake closure is recorded in the current ruleset; re-check the responsible mission before applying.";
    return '<article class="visa-market-card"><div class="status-card-row"><div><span class="small-label">'+esc(item.code)+'</span><h3>'+esc(item.name)+'</h3></div><span class="availability-badge '+esc(statusKey)+'">'+esc(statusKey.replaceAll("_"," "))+'</span></div><strong>'+esc(statusLabel)+'</strong><p>'+esc(detail)+'</p><a href="application.html" class="card-link" data-visa-market-link="'+esc(item.code)+'">Open planner →</a></article>';
  }).join("");

  $("#visa-expansion-queue").innerHTML=queue.length
    ?queue.map(item=>'<span class="tag">'+esc(item.name)+'</span>').join("")
    :'<span class="muted">All current partner markets have detailed planners.</span>';

  $("#visa-reference-markets").innerHTML=referenceCountries.length
    ?referenceCountries.sort((a,b)=>a.name.localeCompare(b.name)).map(item=>'<span class="tag" title="'+esc(item.reason||"No current Working Holiday arrangement")+'">'+esc(item.name)+'</span>').join("")
    :'<span class="muted">No reference markets configured.</span>';

  $("#visa-detailed-markets").addEventListener("click",event=>{
    const link=event.target.closest("[data-visa-market-link]");
    if(!link) return;
    writeLocal(VISA_MARKET_KEY,{market:link.dataset.visaMarketLink});
  });

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
    combine(["qa","site_health"],"QA & Site Audit")
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