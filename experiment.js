"use strict";
(function(){
const byId=id=>document.getElementById(id);
const canvas=byId("labCanvas"),ctx=canvas.getContext("2d");
const modes=["cut","projection","point","highlight"];
const titles={cut:["EXPERIMENT 01","구의 평면 절단","평면의 위치와 기울기를 바꾸면서 단면의 크기를 비교합니다.","구 S · 반지름 3"],projection:["EXPERIMENT 02","정사영","두 평면 사이의 각이 정사영 넓이에 미치는 영향을 확인합니다.","삼각형 · 다른 평면에 정사영"],point:["EXPERIMENT 03","움직이는 점","선분 위의 점을 움직이면서 길이의 합이 어떻게 변하는지 확인합니다.","사면체 · 점 P의 이동"],highlight:["EXPERIMENT 04","면·선분 선택","면 또는 모서리를 선택하여 입체의 구성 요소를 살펴봅니다.","사면체 · 구성 요소 선택"]};
const v={
 add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],
 sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],
 mul:(a,k)=>[a[0]*k,a[1]*k,a[2]*k],
 dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 len:a=>Math.hypot(a[0],a[1],a[2]),
 mix:(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]
};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const deg=x=>x*Math.PI/180;
const fixed=(n,d=2)=>Number(n).toFixed(d);
const TAU=Math.PI*2;
const tetra={A:[0,0,3.2],B:[-2.4,-2,0],C:[2.4,-1.9,0],D:[0,2.4,0]};
const movement={A:[-2.2,-1.9,0],B:[2.6,-1.5,0],C:[0,2.6,0],D:[0,0,3.1]};
const faces=["ABC","ABD","ACD","BCD"],edges=["AB","AC","AD","BC","BD","CD"];
const elements=[
 {mode:"cut",panels:["cutHeight","cutTilt"]},
 {mode:"projection",panels:["projectTilt"]},
 {mode:"point",panels:["pointT"]},
 {mode:"highlight",panels:[]}
];
const params=new URLSearchParams(location.search);
const fromProblem=params.get("from")||params.get("problem");
let problemLab=null;
let mode=modes.includes(params.get("mode"))?params.get("mode"):"cut";
let W=700,H=580,dpr=1,axes=false;
let cam={yaw:-.64,pitch:.58,zoom:1,x:0,y:0};
let goal={...cam},velocity={yaw:0,pitch:0},momentum=false,lastFrame=0;
let gestures=new Map(),gestureMode="none",pointerStart=null,lastMoveTime=0,lastVelocityTime=0;
let model={cutHeight:0,cutTilt:24,projectTilt:30,t:.4,selected:"ABC",dimOthers:true};
const sceneCenter={cut:[0,0,0],projection:[0,0,1],point:[0,0,1.3],highlight:[0,0,1.2]};
const renderScale=()=>Math.min(W,H)*.38/(problemLab?.ready?problemLab.sceneScale():3.5)*cam.zoom;
const sceneC=()=>problemLab?.ready?problemLab.sceneCenter():sceneCenter[mode]||[0,0,0];
function project(world){
 const center=sceneC(),dx=world[0]-center[0],dy=world[1]-center[1],dz=world[2]-center[2];
 const cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),cp=Math.cos(cam.pitch),sp=Math.sin(cam.pitch);
 const x=dx*cy-dy*sy,depth=dx*sy+dy*cy;
 const up=dz*cp-depth*sp;
 return {x:W/2+cam.x+x*renderScale(),y:H/2+cam.y-up*renderScale(),depth:dz*sp+depth*cp};
}
function rescale(){
 const rect=canvas.getBoundingClientRect();
 W=Math.max(230,rect.width);H=Math.max(300,rect.height);dpr=Math.min(2,window.devicePixelRatio||1);
 canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
 ctx.setTransform(dpr,0,0,dpr,0,0);
}
function rgb(hex,a=1){
 const c=hex.replace("#","");
 return "rgba("+parseInt(c.slice(0,2),16)+","+parseInt(c.slice(2,4),16)+","+parseInt(c.slice(4,6),16)+","+a+")";
}
function polygon(points,color="#5eead4",alpha=.18,weight=1.2){
 if(points.length<3)return;
 ctx.beginPath();points.forEach((q,i)=>{const p=project(q);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);});ctx.closePath();
 ctx.fillStyle=rgb(color,alpha);ctx.fill();ctx.lineWidth=weight;ctx.strokeStyle=rgb(color,Math.min(1,alpha+.32));ctx.stroke();
}
function line(a,b,color="#7dd3fc",width=1.8,dashed=false,alpha=1){
 const p=project(a),q=project(b);
 ctx.save();ctx.strokeStyle=rgb(color,alpha);ctx.lineWidth=width;
 if(dashed)ctx.setLineDash([5,6]);
 ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();ctx.restore();
}
function dot(name,pos,color="#dbeafe",radius=4.1){
 const p=project(pos);ctx.save();ctx.shadowColor=color;ctx.shadowBlur=9;ctx.fillStyle=color;
 ctx.beginPath();ctx.arc(p.x,p.y,radius,0,TAU);ctx.fill();ctx.shadowBlur=0;
 ctx.font="600 12px -apple-system, BlinkMacSystemFont, sans-serif";
 ctx.fillStyle="#f2f7ff";ctx.fillText(name,p.x+8,p.y-9);ctx.restore();
}
function ring(c,u,w,r,color="#fbbf24",width=3,alpha=1){
 if(r<.0001){dot("접점",c,color);return;}
 ctx.save();ctx.lineWidth=width;ctx.strokeStyle=rgb(color,alpha);ctx.beginPath();
 for(let i=0;i<=110;i++){const t=i/110*TAU,p=project(v.add(c,v.add(v.mul(u,r*Math.cos(t)),v.mul(w,r*Math.sin(t)))));
 if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}
 ctx.stroke();ctx.restore();
}
function drawSphere(c,r){
 const p=project(c),radius=r*renderScale();
 const g=ctx.createRadialGradient(p.x-radius*.28,p.y-radius*.3,2,p.x,p.y,radius);
 g.addColorStop(0,"rgba(126,197,255,.33)");g.addColorStop(.65,"rgba(55,122,224,.17)");g.addColorStop(1,"rgba(55,122,224,.035)");
 ctx.fillStyle=g;ctx.strokeStyle="rgba(111,184,255,.65)";ctx.lineWidth=1.7;
 ctx.beginPath();ctx.arc(p.x,p.y,radius,0,TAU);ctx.fill();ctx.stroke();
 ctx.strokeStyle="rgba(111,184,255,.12)";ctx.lineWidth=1;
 ctx.beginPath();ctx.ellipse(p.x,p.y,radius*.34,radius,0,0,TAU);ctx.stroke();
}
function background(){
 ctx.fillStyle="#071226";ctx.fillRect(0,0,W,H);
 const g=ctx.createRadialGradient(W*.5,H*.46,4,W*.5,H*.46,Math.max(W,H)*.65);
 g.addColorStop(0,"rgba(29,58,91,.64)");g.addColorStop(1,"rgba(7,18,38,0)");
 ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 if(axes){
  const o=[0,0,0];line([-3.8,0,0],[3.8,0,0],"#fb7185",1,true,.55);
  line([0,-3.8,0],[0,3.8,0],"#4ade80",1,true,.55);
  line([0,0,-3.8],[0,0,3.8],"#60a5fa",1,true,.55);
  dot("O",o,"#a8b8ca",2.5);
 }
}
function surface(points,alpha=.18,color="#5eead4",priority=0){
 const avg=points.reduce((sum,p)=>sum+project(p).depth,0)/points.length;
 return {points,alpha,color,priority,avg};
}
function planeCorners(c,u,w,size){
 return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>v.add(c,v.add(v.mul(u,size*x/2),v.mul(w,size*y/2))));
}
function drawSurfaces(items){
 items.sort((a,b)=>a.priority-b.priority||a.avg-b.avg);
 for(const item of items)polygon(item.points,item.color,item.alpha,item.alpha>.3?2:1.2);
}
function drawCut(){
 const tilt=deg(model.cutTilt),n=[0,-Math.sin(tilt),Math.cos(tilt)],u=[1,0,0],w=[0,Math.cos(tilt),Math.sin(tilt)];
 const c=v.mul(n,model.cutHeight),r=Math.sqrt(Math.max(0,9-model.cutHeight*model.cutHeight));
 drawSphere([0,0,0],3);
 drawSurfaces([surface(planeCorners(c,u,w,8.4),.16,"#5eead4")]);
 ring(c,u,w,r,"#fbbf24",3.2);
 line([0,0,0],c,"#fbbf24",2.2,true);
 dot("O",[0,0,0],"#dbeafe");if(Math.abs(model.cutHeight)>.02)dot("H",c,"#fbbf24");
}
function drawProjection(){
 const theta=deg(model.projectTilt),n=[0,-Math.sin(theta),Math.cos(theta)],u=[1,0,0],w=[0,Math.cos(theta),Math.sin(theta)];
 const src={A:[-2,-1,2],B:[2,-1,2],C:[0,2,2]};
 const image={};
 Object.keys(src).forEach(k=>{const p=src[k];image[k]=v.sub(p,v.mul(n,v.dot(p,n)));});
 const base=planeCorners([0,0,0],u,w,8.7);
 drawSurfaces([surface(base,.13,"#5eead4"),surface(Object.values(src),.22,"#60a5fa",1),surface(Object.values(image),.35,"#34d399",2)]);
 ["A","B","C"].forEach(k=>{
  const prime=k+"'";line(src[k],image[k],"#fbbf24",1.55,true,.78);
  dot(k,src[k],"#93c5fd");
  dot(prime,image[k],"#5eead4");
 });
 ["A","B","C"].forEach((k,i)=>{const next=["B","C","A"][i];line(src[k],src[next],"#93c5fd",2.2);line(image[k],image[next],"#5eead4",2.25);});
}
function pointPosition(t=model.t){return v.mix(movement.B,movement.C,t);}
function distanceSum(t){const p=pointPosition(t);return v.len(v.sub(p,movement.A))+v.len(v.sub(p,movement.D));}
function goldenMin(){
 let a=0,b=1;for(let i=0;i<75;i++){const x=a+(b-a)*.3819660112501051,y=a+(b-a)*.6180339887498949;if(distanceSum(x)<distanceSum(y))b=y;else a=x;}return(a+b)/2;
}
const minT=goldenMin(),minLength=distanceSum(minT);
function drawPoint(){
 const m=movement;
 const tris=["ABC","ABD","ACD","BCD"].map(key=>surface([...key].map(c=>m[c]),key==="ABC"?.15:.08,key==="ABC"?"#5eead4":"#60a5fa"));
 drawSurfaces(tris);
 ["AB","AC","AD","BC","BD","CD"].forEach(key=>line(m[key[0]],m[key[1]],key==="BC"?"#fbbf24":"#85b9e9",key==="BC"?2.7:1.6));
 const P=pointPosition(),min=pointPosition(minT);
 line(m.A,P,"#f472b6",2.5);line(m.D,P,"#fbbf24",2.5);
 dot("P",P,"#fbbf24",6.5);
 const circle=project(min);ctx.strokeStyle="#5eead4";ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(circle.x,circle.y,8.5,0,TAU);ctx.stroke();
 ["A","B","C","D"].forEach(id=>dot(id,m[id]));
}
function areaTriangle(a,b,c){return v.len(v.cross(v.sub(b,a),v.sub(c,a)))/2;}
function drawHighlight(){
 const selected=model.selected,m=tetra,selectedFace=selected.length===3;
 const candidates=faces.map(key=>surface([...key].map(c=>m[c]),key===selected?.45:(model.dimOthers?.065:.15),key===selected?"#5eead4":"#60a5fa",key===selected?2:0));
 drawSurfaces(candidates);
 for(const key of edges){
  const focus=selected===key||selectedFace&&selected.includes(key[0])&&selected.includes(key[1]);
  line(m[key[0]],m[key[1]],focus?"#fbbf24":"#8aa6c2",focus?3.5:1.5,false,focus?1:(model.dimOthers?.4:.85));
 }
 for(const id of ["A","B","C","D"])dot(id,m[id],selected.includes(id)?"#fbbf24":"#dbeafe");
}
function draw(){
 background();
 if(problemLab?.ready){problemLab.draw();return;}
 if(mode==="cut")drawCut();
 else if(mode==="projection")drawProjection();
 else if(mode==="point")drawPoint();
 else drawHighlight();
}
function step(time){
 const dt=lastFrame?clamp((time-lastFrame)/1000,0,.06):1/60;lastFrame=time;
 if(momentum&&gestures.size===0){
  goal.yaw+=velocity.yaw*dt;goal.pitch=clamp(goal.pitch+velocity.pitch*dt,-1.48,1.48);
  const decay=Math.exp(-8*dt);velocity.yaw*=decay;velocity.pitch*=decay;
  if(Math.abs(velocity.yaw)+Math.abs(velocity.pitch)<.009)momentum=false;
 }
 const blend=1-Math.exp(-dt/.075);
 for(const k of ["yaw","pitch","zoom","x","y"])cam[k]+=(goal[k]-cam[k])*blend;
 draw();requestAnimationFrame(step);
}
function showValue(id,str){byId(id).textContent=str;}
function updateUI(){
 showValue("cutHeightLabel",fixed(model.cutHeight,2));
 showValue("cutTiltLabel",model.cutTilt+"°");
 showValue("cutRadius",fixed(Math.sqrt(Math.max(0,9-model.cutHeight*model.cutHeight))));
 showValue("cutArea",fixed(Math.max(0,9-model.cutHeight*model.cutHeight))+"π");
 showValue("projectTiltLabel",model.projectTilt+"°");
 showValue("projectArea",fixed(6*Math.abs(Math.cos(deg(model.projectTilt)))));
 showValue("pointTLabel",fixed(model.t,3));
 showValue("pointLength",fixed(distanceSum(model.t),3));
 showValue("pointMinimum",fixed(minLength,3));
 const s=model.selected,part=s.length===3?"면":"선분",len=s.length===3?areaTriangle(...[...s].map(k=>tetra[k])):v.len(v.sub(tetra[s[0]],tetra[s[1]]));
 showValue("chosenPart",part+" "+s);
 showValue("chosenValue",fixed(len,2));
 document.querySelectorAll(".lab-parts button").forEach(b=>{
  const active=b.dataset.part===s;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));
 });
}
function selectMode(next,save=true){
 if(problemLab?.ready)return;
 if(!modes.includes(next))return;
 mode=next;momentum=false;velocity={yaw:0,pitch:0};
 byId("modeCode").textContent=titles[mode][0];
 byId("modeTitle").textContent=titles[mode][1];
 byId("modeDescription").textContent=titles[mode][2];
 byId("sceneLabel").textContent=titles[mode][3];
 byId("labHint").textContent=mode==="point"?"노란 점 P를 직접 이동 · 빈 공간을 드래그해 회전":mode==="highlight"?"면·선분을 터치해 선택 · 드래그해 회전":"한 손가락 회전 · 두 손가락 확대 및 이동";
 document.querySelectorAll(".lab-mode").forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle("active",active);b.setAttribute("aria-pressed",String(active));});
 document.querySelectorAll("[data-panel]").forEach(p=>p.hidden=p.dataset.panel!==mode);
 if(save){const url=new URL(location.href);url.searchParams.set("mode",mode);history.replaceState(null,"",url.pathname+url.search);}
 updateUI();
}
function resetView(){
 momentum=false;velocity={yaw:0,pitch:0};
 goal={yaw:-.64,pitch:.58,zoom:1,x:0,y:0};
}
function coordinates(e){return {x:e.clientX,y:e.clientY};}
function gestureCenter(){
 if(gestures.size!==2)return null;
 const pts=[...gestures.values()];
 return {x:(pts[0].x+pts[1].x)/2,y:(pts[0].y+pts[1].y)/2,dist:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)};
}
function setGesture(){
 gestureMode=gestures.size>=2?"pinch":gestures.size===1?"orbit":"none";
 momentum=false;velocity={yaw:0,pitch:0};
 lastMoveTime=lastVelocityTime=performance.now();
}
function movePointAt(clientX,clientY){
 const b=project(movement.B),c=project(movement.C);
 const x=clientX-canvas.getBoundingClientRect().left,y=clientY-canvas.getBoundingClientRect().top;
 const dx=c.x-b.x,dy=c.y-b.y,t=((x-b.x)*dx+(y-b.y)*dy)/Math.max(1,dx*dx+dy*dy);
 model.t=clamp(t,0,1);byId("pointT").value=String(model.t);updateUI();
}
function segmentDistance(q,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((q.x-a.x)*dx+(q.y-a.y)*dy)/Math.max(1,dx*dx+dy*dy),0,1);
 return Math.hypot(q.x-a.x-dx*t,q.y-a.y-dy*t);
}
function inTriangle(p,a,b,c){
 const cross=(x,y,z)=>(y.x-x.x)*(z.y-x.y)-(y.y-x.y)*(z.x-x.x);
 const d1=cross(a,b,p),d2=cross(b,c,p),d3=cross(c,a,p);
 return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));
}
function pickHighlight(clientX,clientY){
 const rect=canvas.getBoundingClientRect(),p={x:clientX-rect.left,y:clientY-rect.top};
 let best=null,dist=16;
 for(const name of edges){
  const d=segmentDistance(p,project(tetra[name[0]]),project(tetra[name[1]]));
  if(d<dist){dist=d;best=name;}
 }
 if(!best){
  const inside=faces.filter(name=>inTriangle(p,...[...name].map(k=>project(tetra[k]))));
  if(inside.length)best=inside.sort((a,b)=>{
   const avg=key=>[...key].reduce((sum,k)=>sum+project(tetra[k]).depth,0)/3;
   return avg(b)-avg(a);
  })[0];
 }
 if(best){model.selected=best;updateUI();}
}
function zoomAt(factor,px,py){
 const before=goal.zoom;
 goal.zoom=clamp(before*factor,.28,4.5);
 const ratio=goal.zoom/before;if(Math.abs(ratio-1)<1e-8)return;
 const rect=canvas.getBoundingClientRect(),x=px-rect.left-W/2,y=py-rect.top-H/2;
 goal.x=x-ratio*(x-goal.x);goal.y=y-ratio*(y-goal.y);
}
canvas.addEventListener("contextmenu",e=>e.preventDefault());
canvas.addEventListener("pointerdown",e=>{
 if(e.pointerType==="mouse"&&e.button!==0)return;
 if(e.cancelable)e.preventDefault();
 gestures.set(e.pointerId,coordinates(e));
 pointerStart={x:e.clientX,y:e.clientY,travel:0};
 try{canvas.setPointerCapture(e.pointerId);}catch(err){}
 setGesture();
 if(gestures.size===1&&problemLab?.ready&&problemLab.nearDraggable(e.clientX,e.clientY)){gestureMode="dragProblemPoint";}
 else if(gestures.size===1&&mode==="point"&&!problemLab?.ready){
  const p=project(pointPosition()),rect=canvas.getBoundingClientRect();
  if(Math.hypot(e.clientX-rect.left-p.x,e.clientY-rect.top-p.y)<28)gestureMode="dragPoint";
 }
});
canvas.addEventListener("pointermove",e=>{
 if(!gestures.has(e.pointerId))return;
 if(e.cancelable)e.preventDefault();
 const prev=gestures.get(e.pointerId),before=gestureCenter(),now=performance.now();
 gestures.set(e.pointerId,coordinates(e));
 const dx=e.clientX-prev.x,dy=e.clientY-prev.y;
 if(pointerStart)pointerStart.travel+=Math.hypot(dx,dy);
 if(gestureMode==="dragProblemPoint"&&gestures.size===1){problemLab.movePoint(e.clientX,e.clientY);}
 else if(gestureMode==="dragPoint"&&gestures.size===1){
  movePointAt(e.clientX,e.clientY);
 }else if(gestureMode==="orbit"&&gestures.size===1){
  const sensitivity=2.6/Math.max(260,Math.min(W,H));
  goal.yaw+=dx*sensitivity;
  goal.pitch=clamp(goal.pitch+dy*sensitivity,-1.48,1.48);
  const elapsed=clamp((now-lastVelocityTime)/1000,.008,.12);
  if(Math.abs(dx)+Math.abs(dy)>.12){
   velocity.yaw=.58*velocity.yaw+.42*clamp(dx*sensitivity/elapsed,-3.5,3.5);
   velocity.pitch=.58*velocity.pitch+.42*clamp(dy*sensitivity/elapsed,-3,3);
   lastMoveTime=now;
  }
  lastVelocityTime=now;
 }else if(gestureMode==="pinch"&&gestures.size===2&&before){
  const after=gestureCenter(),rect=canvas.getBoundingClientRect();
  const oldZoom=goal.zoom;
  goal.zoom=clamp(goal.zoom*after.dist/Math.max(1,before.dist),.28,4.5);
  const ratio=goal.zoom/oldZoom;
  const px=before.x-rect.left-W/2,py=before.y-rect.top-H/2;
  const nx=after.x-rect.left-W/2,ny=after.y-rect.top-H/2;
  goal.x=nx-ratio*(px-goal.x);goal.y=ny-ratio*(py-goal.y);
 }
});
function release(e){
 if(!gestures.has(e.pointerId))return;
 const single=gestures.size===1,wasOrbit=gestureMode==="orbit";
 if(single&&mode==="highlight"&&pointerStart&&pointerStart.travel<9)pickHighlight(e.clientX,e.clientY);
 gestures.delete(e.pointerId);
 if(single&&wasOrbit&&pointerStart&&pointerStart.travel>9&&performance.now()-lastMoveTime<75){
  momentum=Math.abs(velocity.yaw)+Math.abs(velocity.pitch)>.12;
 }else{momentum=false;velocity={yaw:0,pitch:0};}
 if(gestures.size)setGesture();else gestureMode="none";
 pointerStart=null;
}
canvas.addEventListener("pointerup",release);
canvas.addEventListener("pointercancel",release);
canvas.addEventListener("lostpointercapture",release);
canvas.addEventListener("wheel",e=>{if(e.cancelable)e.preventDefault();zoomAt(Math.exp(-e.deltaY*.0012),e.clientX,e.clientY);},{passive:false});
canvas.addEventListener("dblclick",e=>{e.preventDefault();resetView();});
byId("resetView").addEventListener("click",resetView);
byId("toggleAxes").addEventListener("click",()=>{
 axes=!axes;byId("toggleAxes").setAttribute("aria-pressed",String(axes));
});
document.querySelectorAll(".lab-mode").forEach(b=>b.addEventListener("click",()=>selectMode(b.dataset.mode)));
function slider(id,key){
 byId(id).addEventListener("input",e=>{model[key]=Number(e.target.value);updateUI();});
}
slider("cutHeight","cutHeight");
slider("cutTilt","cutTilt");
slider("projectTilt","projectTilt");
slider("pointT","t");
byId("snapMinimum").addEventListener("click",()=>{
 model.t=minT;byId("pointT").value=String(minT);updateUI();
});
byId("dimOthers").addEventListener("change",e=>{model.dimOthers=e.target.checked;updateUI();});
for(const [root,values,prefix] of [["faceChoices",faces,"면 "],["edgeChoices",edges,"선분 "]]){
 for(const item of values){
  const b=document.createElement("button");b.type="button";b.textContent=prefix+item;b.dataset.part=item;
  b.addEventListener("click",()=>{model.selected=item;updateUI();});byId(root).appendChild(b);
 }
}
const from=fromProblem;
if(from&&/^[a-zA-Z0-9-]{1,90}$/.test(from)){
 const link=byId("backToLesson");link.href="viewer.html?id="+encodeURIComponent(from);link.hidden=false;
}
if(from&&/^[a-zA-Z0-9-]{1,90}$/.test(from)&&typeof window.GeometryProblemLab==="function"){
 problemLab=window.GeometryProblemLab({byId,v,clamp,deg,fixed,drawSphere,ring,line,dot,polygon,planeCorners,surface,drawSurfaces,project,canvas});
 byId("modeCode").textContent="PROBLEM EXPERIMENT";
 byId("modeTitle").textContent="문항별 공간도형 실험";
 byId("modeDescription").textContent="선택한 문항의 도형과 조건을 불러오는 중입니다.";
 byId("sceneLabel").textContent="문항별 실험 모드";
 document.querySelectorAll(".lab-mode").forEach(b=>b.classList.remove("active"));
 document.querySelector(".lab-modes").hidden=true;
 document.querySelectorAll("[data-panel]").forEach(p=>p.hidden=true);
 byId("problemMode").hidden=false;
 byId("labHint").textContent="원래 문항의 도형을 회전하면서 조건을 조작할 수 있습니다.";
 problemLab.load(from).then(record=>{
  byId("modeTitle").textContent="문항별 공간도형 실험";
  byId("modeDescription").textContent="이 문항의 3D 풀이 데이터를 바탕으로 구성한 실험입니다. 슬라이더로 조건을 바꿔 공간적 변화를 확인할 수 있습니다.";
  byId("sceneLabel").textContent=(record.sourceName||record.sourceType||"평가원")+" · "+record.number+"번";
 }).catch(err=>{
  byId("modeDescription").textContent=err.message+" 기존 개념 실험 모드를 이용할 수 있습니다.";
  byId("problemMode").hidden=true;document.querySelector(".lab-modes").hidden=false;
  problemLab=null;selectMode(mode,false);
 });
}
window.addEventListener("resize",rescale);
selectMode(mode,false);
rescale();
requestAnimationFrame(step);
})();
