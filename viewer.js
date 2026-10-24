"use strict";
const $=(id)=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const V={sub:(a,b)=>a.map((x,i)=>x-b[i]),add:(a,b)=>a.map((x,i)=>x+b[i]),mul:(a,s)=>a.map(x=>x*s),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>Math.hypot(...a),unit:a=>{const n=Math.hypot(...a);return n?a.map(x=>x/n):[0,0,1]}};
let lesson=null, step=0, axes=true, playing=false, playTimer=null,recorder=null,recTimer=null,recorded=[],recording=false,recFormat="video/webm";
// z축을 수직으로 사용하는 오비트 카메라. 입력 목표값과 렌더링 값을 분리하여 지연·관성을 제어한다.
const INITIAL_CAMERA={yaw:-.65,pitch:.58,zoom:1};
let yaw=INITIAL_CAMERA.yaw,pitch=INITIAL_CAMERA.pitch,zoom=1,panX=0,panY=0;
let targetYaw=yaw,targetPitch=pitch,targetZoom=zoom,targetPanX=0,targetPanY=0;
let sceneCenter=[0,0,0],lastFrameTime=0,velocityYaw=0,velocityPitch=0,inertia=false;
let pointers=new Map(),gestureMode="none",lastGestureMove=0,velocityTime=0;
const CAMERA={minPitch:-1.48,maxPitch:1.48,minZoom:.28,maxZoom:4.5,friction:7.5,smoothTime:.060};
const canvas=$("canvas"),ctx=canvas.getContext("2d");
let W=700,H=520,DPR=1;
function resize(){DPR=Math.min(devicePixelRatio||1,2);const box=canvas.getBoundingClientRect();W=Math.max(200,box.width);H=Math.max(200,box.height);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function rot(v){
 const dx=v[0]-sceneCenter[0],dy=v[1]-sceneCenter[1],dz=v[2]-sceneCenter[2];
 const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
 const x=dx*cy-dy*sy,depth=dx*sy+dy*cy;
 return [x,dz*cp-depth*sp,dz*sp+depth*cp];
}
function project(v){const r=rot(v),scale=Math.min(W,H)*.39/(lesson?.scale||10)*zoom;return [W/2+panX+r[0]*scale,H/2+panY-r[1]*scale,r[2]]}
function updateSceneCenter(objects){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 const include=(v,r=0)=>{if(!Array.isArray(v)||v.length!==3)return;for(let i=0;i<3;i++){min[i]=Math.min(min[i],v[i]-r);max[i]=Math.max(max[i],v[i]+r);}};
 for(const o of objects||[]){
  if(o.type==="point")include(o.p);
  else if(o.type==="line"){include(o.a);include(o.b);}
  else if(o.type==="polygon"){for(const pt of o.pts||[])include(pt);}
  else if(o.type==="sphere"||o.type==="circle")include(o.c,o.r);
  else if(o.type==="plane")include(o.c);
 }
 sceneCenter=min.every(Number.isFinite)?min.map((v,i)=>(v+max[i])/2):[0,0,0];
}
function resetCamera(){
 inertia=false;velocityYaw=velocityPitch=0;
 targetYaw=INITIAL_CAMERA.yaw;targetPitch=INITIAL_CAMERA.pitch;
 targetZoom=INITIAL_CAMERA.zoom;targetPanX=targetPanY=0;
}
function zoomAt(factor,clientX,clientY){
 const prev=targetZoom;targetZoom=clamp(targetZoom*factor,CAMERA.minZoom,CAMERA.maxZoom);
 const ratio=targetZoom/prev;if(Math.abs(ratio-1)<1e-6)return;
 const rect=canvas.getBoundingClientRect(),x=clientX-rect.left-W/2,y=clientY-rect.top-H/2;
 targetPanX=x-ratio*(x-targetPanX);targetPanY=y-ratio*(y-targetPanY);
}
function updateCamera(dt){
 if(inertia&&pointers.size===0){
  targetYaw+=velocityYaw*dt;
  targetPitch=clamp(targetPitch+velocityPitch*dt,CAMERA.minPitch,CAMERA.maxPitch);
  if(targetPitch===CAMERA.minPitch||targetPitch===CAMERA.maxPitch)velocityPitch=0;
  const decay=Math.exp(-CAMERA.friction*dt);
  velocityYaw*=decay;velocityPitch*=decay;
  if(Math.abs(velocityYaw)+Math.abs(velocityPitch)<.008)inertia=false;
 }
 const smooth=1-Math.exp(-dt/CAMERA.smoothTime);
 yaw+=(targetYaw-yaw)*smooth;pitch+=(targetPitch-pitch)*smooth;
 zoom+=(targetZoom-zoom)*smooth;
 panX+=(targetPanX-panX)*smooth;panY+=(targetPanY-panY)*smooth;
}
function path3(points,close=false){if(!points?.length)return;ctx.beginPath();for(let i=0;i<points.length;i++){const p=project(points[i]);i===0?ctx.moveTo(p[0],p[1]):ctx.lineTo(p[0],p[1]);}if(close)ctx.closePath()}
function mix(hex,alpha){if(typeof hex!=="string")hex="#7dd3fc";if(hex.length===7){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgba(${r},${g},${b},${alpha})`;}return hex}
function line(a,b,color="#7dd3fc",w=2,dash=[]){const aa=project(a),bb=project(b);ctx.save();ctx.strokeStyle=color;ctx.lineWidth=w;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(aa[0],aa[1]);ctx.lineTo(bb[0],bb[1]);ctx.stroke();ctx.restore()}
function planePoints(center,normal,size){const n=V.unit(normal),guide=Math.abs(n[2])<.8?[0,0,1]:[0,1,0],u=V.unit(V.cross(n,guide)),v=V.unit(V.cross(n,u));return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>V.add(center,V.add(V.mul(u,x*size/2),V.mul(v,y*size/2))))}
function circlePoints(c,n,r){const norm=V.unit(n),guide=Math.abs(norm[2])<.8?[0,0,1]:[0,1,0],u=V.unit(V.cross(norm,guide)),v=V.unit(V.cross(norm,u));return Array.from({length:120},(_,i)=>{const a=i/120*Math.PI*2;return V.add(c,V.add(V.mul(u,r*Math.cos(a)),V.mul(v,r*Math.sin(a))))})}
function background(){
 ctx.fillStyle="#081124";ctx.fillRect(0,0,W,H);
 const grad=ctx.createRadialGradient(W*.5,H*.45,10,W*.5,H*.45,Math.max(W,H)*.62);grad.addColorStop(0,"#102542");grad.addColorStop(1,"#081124");ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
 if(axes&&lesson){const b=lesson.scale*.64;line([-b,0,0],[b,0,0],"#fb71855e",1,[5,6]);line([0,-b,0],[0,b,0],"#4ade805e",1,[5,6]);line([0,0,-b],[0,0,b],"#60a5fa5e",1,[5,6]);}
}
function drawObject(obj){
 const c=obj.color||"#7dd3fc";
 if(obj.type==="polygon"){path3(obj.pts,true);ctx.fillStyle=mix(c,.17);ctx.fill();ctx.strokeStyle=mix(c,.85);ctx.lineWidth=1.5;ctx.stroke();}
 if(obj.type==="plane"){path3(planePoints(obj.c,obj.n,obj.size),true);ctx.fillStyle=mix(c,.12);ctx.fill();ctx.strokeStyle=mix(c,.5);ctx.lineWidth=1;ctx.stroke();}
 if(obj.type==="sphere"){
 const center=project(obj.c),rr=Math.min(W,H)*.39/(lesson.scale||10)*zoom*obj.r;
 const grad=ctx.createRadialGradient(center[0]-rr*.3,center[1]-rr*.4,rr*.03,center[0],center[1],rr);grad.addColorStop(0,mix(c,.19));grad.addColorStop(.55,mix(c,.11));grad.addColorStop(1,mix(c,.02));
 ctx.beginPath();ctx.ellipse(center[0],center[1],rr,rr,0,0,2*Math.PI);ctx.fillStyle=grad;ctx.fill();ctx.strokeStyle=mix(c,.54);ctx.lineWidth=1.5;ctx.stroke();
 ctx.beginPath();ctx.ellipse(center[0],center[1],rr*.33,rr,0,0,2*Math.PI);ctx.strokeStyle=mix(c,.16);ctx.stroke();
 }
 if(obj.type==="circle"){path3(circlePoints(obj.c,obj.n,obj.r),true);ctx.strokeStyle=c;ctx.lineWidth=2.2;ctx.stroke();}
 if(obj.type==="line"){line(obj.a,obj.b,c,2.5);}
 if(obj.type==="point"){const p=project(obj.p);ctx.shadowColor=c;ctx.shadowBlur=11;ctx.fillStyle=c;ctx.beginPath();ctx.arc(p[0],p[1],4.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.font="600 13px -apple-system, sans-serif";ctx.fillStyle="#eaf5ff";ctx.fillText(obj.id,p[0]+8,p[1]-8);}
}
function frame(time){
 const dt=lastFrameTime?clamp((time-lastFrameTime)/1000,0,.05):1/60;lastFrameTime=time;updateCamera(dt);
 if(lesson){background();const visible=lesson.objects.filter(o=>(o.step||0)<=step);const order={sphere:0,plane:1,polygon:2,circle:3,line:4,point:5};visible.sort((a,b)=>(order[a.type]??6)-(order[b.type]??6));for(const o of visible)drawObject(o);}
 else{ctx.fillStyle="#081124";ctx.fillRect(0,0,W,H);ctx.fillStyle="#a8bad4";ctx.font="16px sans-serif";ctx.fillText("3D 장면을 불러오는 중...",26,H/2)}
 requestAnimationFrame(frame);
}
function setStep(n){if(!lesson)return;step=Math.max(0,Math.min(lesson.steps.length-1,n));const s=lesson.steps[step];$("step").innerHTML=`<div class="index">STEP ${step+1} / ${lesson.steps.length}</div><h2>${esc(s[0])}</h2><p>${esc(s[1])}</p><div class="formula">${esc(s[2])}</div>`;$("stepCount").textContent=`${step+1} / ${lesson.steps.length}`;$("prev").disabled=step===0;$("next").disabled=step===lesson.steps.length-1;}
function endPlay(){playing=false;clearInterval(playTimer);playTimer=null;$("play").textContent="▶ 자동 재생"}
function autoplay(){if(!lesson||recording)return;if(playing){endPlay();return;}playing=true;$("play").textContent="⏸ 일시정지";playTimer=setInterval(()=>{if(step>=lesson.steps.length-1){endPlay();return;}setStep(step+1);},2500);}
async function startRecord(){
 if(!lesson||recording)return;
 if(!canvas.captureStream||typeof MediaRecorder==="undefined"){$("recordStatus").textContent="현재 브라우저에서는 화면 녹화를 지원하지 않습니다.";return;}
 const options=["video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm","video/mp4"].find(t=>MediaRecorder.isTypeSupported(t));
 if(!options){$("recordStatus").textContent="녹화할 수 있는 영상 형식이 없습니다.";return;}
 endPlay();setStep(0);recorded=[];recFormat=options;
 try{
  const stream=canvas.captureStream(30);recorder=new MediaRecorder(stream,{mimeType:recFormat,videoBitsPerSecond:2500000});
  recorder.ondataavailable=e=>{if(e.data&&e.data.size)recorded.push(e.data)};
  recorder.onerror=e=>{$("recordStatus").textContent="녹화 중 오류가 발생했습니다.";};
  recorder.onstop=()=>{clearInterval(recTimer);recTimer=null;recording=false;$("record").disabled=false;$("record").textContent="● 화면 녹화";stream.getTracks().forEach(t=>t.stop());if(!recorded.length)return;const ext=recFormat.includes("mp4")?"mp4":"webm",blob=new Blob(recorded,{type:recFormat}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`geometry-motion-${new URLSearchParams(location.search).get("id")||"lesson"}.${ext}`;document.body.append(a);a.click();a.remove();$("recordStatus").textContent="영상이 저장되었습니다.";setTimeout(()=>URL.revokeObjectURL(url),15000);};
  recorder.start(200);recording=true;$("record").disabled=true;$("record").textContent="● 녹화 중…";$("recordStatus").textContent="단계별 영상 녹화 중";let count=0;
  recTimer=setInterval(()=>{count++;if(count<lesson.steps.length)setStep(count);else{clearInterval(recTimer);recTimer=null;setTimeout(()=>{if(recorder?.state!=="inactive")recorder.stop();},1300);}},2200);
 }catch(e){recording=false;$("recordStatus").textContent="녹화를 시작할 수 없습니다: "+e.message;}
}
// 한 손가락은 회전, 두 손가락은 확대/축소 및 화면 이동. 포인터 수가 바뀌면 제스처 기준을 새로 잡는다.
function gestureCenter(){
 const pts=[...pointers.values()];if(pts.length!==2)return null;
 return {x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2,distance:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)};
}
function resetGestureMode(){
 gestureMode=pointers.size>=2?"multi":pointers.size===1?"orbit":"none";
 inertia=false;velocityYaw=velocityPitch=0;velocityTime=lastGestureMove=performance.now();
}
canvas.addEventListener("contextmenu",e=>e.preventDefault());
canvas.addEventListener("pointerdown",e=>{
 if(e.pointerType==="mouse"&&e.button!==0&&e.button!==2)return;
 if(e.cancelable)e.preventDefault();
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 try{canvas.setPointerCapture(e.pointerId)}catch(_){}
 resetGestureMode();
});
canvas.addEventListener("pointermove",e=>{
 if(!pointers.has(e.pointerId))return;
 if(e.cancelable)e.preventDefault();
 const now=performance.now(),previous=pointers.get(e.pointerId),before=gestureCenter();
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 const dx=e.clientX-previous.x,dy=e.clientY-previous.y;
 if(gestureMode==="orbit"&&pointers.size===1){
  // 화면 크기에 맞춘 회전 감도. z축은 수직으로 유지하고 위·아래 방향은 제한한다.
  const sensitivity=2.6/Math.max(250,Math.min(W,H));
  targetYaw+=dx*sensitivity;
  targetPitch=clamp(targetPitch+dy*sensitivity,CAMERA.minPitch,CAMERA.maxPitch);
  const elapsed=clamp((now-velocityTime)/1000,.008,.12);
  if(Math.abs(dx)+Math.abs(dy)>.1){
   const instantaneousYaw=clamp(dx*sensitivity/elapsed,-3.5,3.5);
   const instantaneousPitch=clamp(dy*sensitivity/elapsed,-3,3);
   velocityYaw=.55*velocityYaw+.45*instantaneousYaw;
   velocityPitch=.55*velocityPitch+.45*instantaneousPitch;
   lastGestureMove=now;
  }
  velocityTime=now;
 }else if(gestureMode==="multi"&&pointers.size===2&&before){
  const after=gestureCenter(),rect=canvas.getBoundingClientRect();
  const nextZoom=clamp(targetZoom*(after.distance/Math.max(1,before.distance)),CAMERA.minZoom,CAMERA.maxZoom);
  const ratio=nextZoom/targetZoom;targetZoom=nextZoom;
  // 중간 지점에 놓인 도형이 손가락 중심에서 밀려나지 않도록 이동량을 보정한다.
  const prevX=before.x-rect.left-W/2,prevY=before.y-rect.top-H/2;
  const nextX=after.x-rect.left-W/2,nextY=after.y-rect.top-H/2;
  targetPanX=nextX-ratio*(prevX-targetPanX);
  targetPanY=nextY-ratio*(prevY-targetPanY);
 }
});
function releasePointer(e){
 if(!pointers.has(e.pointerId))return;
 const wasOrbit=gestureMode==="orbit"&&pointers.size===1;
 pointers.delete(e.pointerId);
 if(wasOrbit&&performance.now()-lastGestureMove<75){
  inertia=Math.abs(velocityYaw)+Math.abs(velocityPitch)>.12;
 }else{inertia=false;velocityYaw=velocityPitch=0;}
 if(pointers.size>0)resetGestureMode();else gestureMode="none";
}
canvas.addEventListener("pointerup",releasePointer);
canvas.addEventListener("pointercancel",releasePointer);
canvas.addEventListener("lostpointercapture",releasePointer);
canvas.addEventListener("wheel",e=>{if(e.cancelable)e.preventDefault();zoomAt(Math.exp(-e.deltaY*.0012),e.clientX,e.clientY);},{passive:false});
canvas.addEventListener("dblclick",e=>{e.preventDefault();resetCamera();});
$("reset").onclick=resetCamera;
$("grid").onclick=()=>{axes=!axes;$("grid").textContent=axes?"⌗ 좌표축 숨기기":"⌗ 좌표축 표시"};
$("prev").onclick=()=>{endPlay();setStep(step-1)};
$("next").onclick=()=>{endPlay();setStep(step+1)};
$("start").onclick=()=>{endPlay();setStep(0)};
$("play").onclick=autoplay;$("record").onclick=startRecord;
window.addEventListener("resize",resize);resize();requestAnimationFrame(frame);
(async()=>{try{
 const requestedId=new URLSearchParams(location.search).get("id")||"2027-09-28";const id=requestedId==="private-speedrunner-26-30"?"private-speedrunner-25-30":requestedId;const [l,p,x1,x2,x3,x4]=await Promise.all([fetch("data/lessons.json"),fetch("data/problems.json"),fetch("data/lessons-extra-1.json"),fetch("data/lessons-extra-2.json"),fetch("data/lessons-extra-3.json"),fetch("data/lessons-private.json")]);if(!l.ok||!p.ok||!x1.ok||!x2.ok||!x3.ok||!x4.ok)throw Error("풀이 데이터를 불러오지 못했습니다.");
 const lessons={...(await l.json()),...(await x1.json()),...(await x2.json()),...(await x3.json()),...(await x4.json())},problems=await p.json();lesson=lessons[id];if(lesson)updateSceneCenter(lesson.objects);const current=problems.find(v=>v.id===id);
 if(!lesson)throw Error("선택한 문항의 3D 풀이가 아직 등록되지 않았습니다. 풀이가 있는 다른 문항을 선택해 주세요.");
 $("heading").textContent=current?`${current.year?current.year+"학년도 · ":""}${current.sourceType==="사설"?(current.sourceName+" · "):""}${current.exam==="대학수학능력시험"?"수능":current.exam} · ${current.subject||"기하"} ${current.number}번`:"3D 단계별 풀이";
 const experimentLink=document.getElementById("experimentLink");if(experimentLink&&current){const text=(current.title+" "+current.description).toLowerCase();const mode=/정사영|투영/.test(text)?"projection":/최솟값|최댓값|움직이는 점|최단거리/.test(text)?"point":/구|교원|단면|접구/.test(text)?"cut":"highlight";experimentLink.href="experiment.html?mode="+mode+"&from="+encodeURIComponent(id);}
 const sourceEl=document.getElementById("sourceInfo");if(sourceEl&&current){const category=current.sourceType||"평가원";sourceEl.textContent=category+(current.sourceName&&current.sourceName!==category?` · ${current.sourceName}`:"");}
 $("question").textContent=lesson.prompt;$("answer").textContent="정답 · "+lesson.answer;setStep(0);
 }catch(e){lesson=null;$("heading").textContent="풀이 준비 중";$("question").innerHTML=`<div class="error">${esc(e.message)}</div>`;$("step").hidden=true;$("answer").hidden=true;}})();