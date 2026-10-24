"use strict";
const $=(q)=>document.querySelector(q);
let problems=[],selected=null,selectedSource="";
const sourceOf=p=>p.sourceType||"평가원";
const publisherOf=p=>p.sourceName||sourceOf(p);
const safe=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const label=p=>`${p.year}학년도 · ${p.exam==="대학수학능력시험"?"수능":p.exam} · ${p.subject||"기하"} ${p.number}번`;
const sourceLabel=p=>sourceOf(p)==="사설"&&p.sourceName?`사설 · ${p.sourceName}`:sourceOf(p)==="교육청"&&p.sourceName?`교육청 · ${p.sourceName}`:sourceOf(p);
function updateExams(){const box=$("#exam"),old=box.value,exams=[...new Set(problems.filter(p=>!selectedSource||sourceOf(p)===selectedSource).map(p=>p.exam))].sort((a,b)=>a.localeCompare(b,"ko"));box.replaceChildren(new Option("전체 시험",""),...exams.map(v=>new Option(v,v)));if(exams.includes(old))box.value=old;else box.value="";}
function diagram(type){
 const sphere=type.includes("구")||type.includes("자취")||type.includes("교원");
 const tetra=type.includes("사면체")||type.includes("접구");
 const prism=type.includes("사각뿔대")||type.includes("원기둥");
 const folding=type.includes("접기");
 if(sphere)return `<svg viewBox="0 0 320 170" role="img" aria-label="구와 교선의 개략적인 3D 그림"><defs><linearGradient id="glow" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#38bdf8" stop-opacity=".35"/><stop offset="1" stop-color="#818cf8" stop-opacity=".03"/></linearGradient></defs><circle cx="160" cy="82" r="66" fill="url(#glow)" stroke="#67b7f8"/><ellipse cx="160" cy="82" rx="66" ry="23" stroke="#52e0d3" fill="none" stroke-dasharray="4 4"/><ellipse cx="160" cy="82" rx="24" ry="66" stroke="#aaa6ff" fill="none" transform="rotate(28 160 82)"/><path d="M160 82L210 38M160 82L117 116" class="wire"/><circle cx="210" cy="38" r="4" fill="#fbbf24"/><circle cx="160" cy="82" r="4" fill="#fff"/><text x="166" y="79" class="symbol">O</text><text x="217" y="32" class="symbol">P</text></svg>`;
 if(tetra)return `<svg viewBox="0 0 320 170" role="img" aria-label="공간 사면체 개략도"><path class="face" d="M52 124L261 133L145 32Z"/><path d="M52 124L192 90L261 133M145 32L192 90" class="wire" stroke-dasharray="4 4"/><path d="M145 32L52 124L261 133Z" class="wire"/><text x="138" y="23" class="symbol">A</text><text x="36" y="139" class="symbol">B</text><text x="264" y="146" class="symbol">C</text><text x="196" y="84" class="symbol">D</text><circle cx="192" cy="90" r="4" fill="#fbbf24"/></svg>`;
 if(prism)return `<svg viewBox="0 0 320 170" role="img" aria-label="입체 도형 개략도"><path d="M75 70L194 52L259 79L137 99Z" class="face"/><path d="M75 70L60 130L135 156L137 99M194 52L195 120L135 156M259 79L245 143L195 120M60 130L245 143" class="wire"/><path d="M137 99L135 156M75 70L60 130" class="wire"/><path d="M60 130L195 120" class="wire" stroke-dasharray="4 4"/></svg>`;
 if(folding)return `<svg viewBox="0 0 320 170" role="img" aria-label="종이 접기의 개략도"><path d="M53 112L169 125L274 95L169 63Z" class="face"/><path d="M53 112L169 22L169 63L274 95M169 22L169 125" class="wire"/><path d="M53 112Q93 32 169 22M169 22Q232 12 274 95" class="wire" stroke-dasharray="4 4"/></svg>`;
 return `<svg viewBox="0 0 320 170" role="img" aria-label="두 평면의 각 개략도"><path class="face" d="M35 112L196 132L286 93L126 68Z"/><path d="M126 68L176 22L286 93L196 132Z" fill="#a78bfa33" stroke="#c4b5fd"/><path d="M126 68L196 132" class="wire" stroke-dasharray="4 4"/></svg>`;
}
function update(){
 const q=$("#search").value.trim().toLowerCase(), year=$("#year").value, exam=$("#exam").value, status=$("#status").value;
 const list=problems.filter(p=>(!selectedSource||sourceOf(p)===selectedSource)&&(!q||`${label(p)} ${p.title} ${p.description} ${sourceLabel(p)} ${p.sourceName||""}`.toLowerCase().includes(q))&&(!year||String(p.year)===year)&&(!exam||p.exam===exam)&&(!status||p.status===status));
 $("#results").textContent=`${list.length}개 문항`;
 $("#cards").innerHTML=list.length?list.map(p=>`<button class="card ${p.id===selected?"active":""}" data-id="${safe(p.id)}"><span class="id"><span class="source-tag">${safe(sourceLabel(p))}</span> ${safe(label(p))}</span><h3>${safe(p.title)}</h3><span class="desc">${safe(p.description)}</span><span class="status ${p.status==="solved"?"solved":""}">${p.status==="solved"?"✓ 3D 풀이":"◷ 풀이 준비 중"}</span></button>`).join(""):`<p class="empty">${selectedSource&& !problems.some(p=>sourceOf(p)===selectedSource)?`${selectedSource} 문항은 아직 등록되지 않았습니다.`:"검색 결과가 없습니다."}</p>`;
 $("#cards").querySelectorAll(".card").forEach(btn=>btn.addEventListener("click",()=>{selected=btn.dataset.id;history.replaceState(null,"",`?id=${encodeURIComponent(selected)}`);update();if(innerWidth<1000)$("#detail").scrollIntoView({behavior:"smooth",block:"start"});}));
 const p=problems.find(x=>x.id===selected);
 if(!p){$("#detail").innerHTML='<p class="placeholder">문항을 선택하면 상세 정보가 표시됩니다.</p>';return;}
 $("#detail").innerHTML=`<div class="eyebrow">${safe(sourceLabel(p))} · 문항 정보</div><h2>${safe(label(p))}</h2><p>${safe(p.description)}</p><div class="question-view">${diagram(p.title)}</div><h3>주요 개념</h3><p>${safe(p.title)}</p>${p.status==="solved"?`<div class="answer">정답 ${safe(p.answer)}</div><a class="button" href="viewer.html?id=${encodeURIComponent(p.id)}">3D 풀이 보기 ↗</a>`:'<div class="disabled-note">풀이를 준비하고 있습니다.</div>'}<p style="font-size:11px">출처: ${safe(p.sourceName|| (sourceOf(p)==="평가원"?"한국교육과정평가원":sourceOf(p)))}. 위 그림은 주요 도형을 단순화한 예시입니다.</p>`;
}
async function boot(){
 try{const res=await fetch("data/problems.json");if(!res.ok)throw Error("문항 목록을 불러오지 못했습니다.");problems=await res.json();
 $("#totalCount").textContent=String(problems.length);$("#solvedCount").textContent=String(problems.filter(p=>p.status==="solved").length);$("#yearCount").textContent=String(new Set(problems.map(p=>p.year)).size);
 const years=[...new Set(problems.map(p=>p.year))].sort((a,b)=>b-a);for(const y of years){const opt=document.createElement("option");opt.value=y;opt.textContent=y+"학년도";$("#year").append(opt);}
 selected=new URLSearchParams(location.search).get("id");if(!problems.some(p=>p.id===selected))selected="2027-09-28";
 document.querySelectorAll(".source-tab").forEach(btn=>btn.addEventListener("click",()=>{selectedSource=btn.dataset.source||"";document.querySelectorAll(".source-tab").forEach(b=>{const active=b===btn;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});updateExams();update();}));
 updateExams();for(const id of ["search","year","exam","status"])$("#"+id).addEventListener(id==="search"?"input":"change",update);update();
 }catch(e){$("#cards").innerHTML=`<p class="error">${safe(e.message)}</p>`;}
}
boot();