"use strict";
const $=(id)=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const V={sub:(a,b)=>a.map((x,i)=>x-b[i]),add:(a,b)=>a.map((x,i)=>x+b[i]),mul:(a,s)=>a.map(x=>x*s),cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm:a=>Math.hypot(...a),unit:a=>{const n=Math.hypot(...a);return n?a.map(x=>x/n):[0,0,1]}};
let lesson=null, step=0, yaw=-.53,pitch=.38,zoom=1, axes=true, playing=false, playTimer=null,recorder=null,recTimer=null,recorded=[],pointer=new Map(),lastDistance=null,recording=false,recFormat="video/webm";
const canvas=$("canvas"),ctx=canvas.getContext("2d");
let W=700,H=520,DPR=1;
function resize(){DPR=Math.min(devicePixelRatio||1,2);const box=canvas.getBoundingClientRect();W=Math.max(200,box.width);H=Math.max(200,box.height);canvas.width=Math.round(W*DPR);canvas.height=Math.round(H*DPR);ctx.setTransform(DPR,0,0,DPR,0,0);}
function rot(v){const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),x=v[0]*cy-v[2]*sy,z=v[0]*sy+v[2]*cy;return [x,v[1]*cp-z*sp,v[1]*sp+z*cp]}
function project(v){const r=rot(v),scale=Math.min(W,H)*.39/(lesson?.scale||10)*zoom;return [W/2+r[0]*scale,H/2-r[1]*scale,r[2]]}
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
function frame(){
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
canvas.addEventListener("pointerdown",e=>{pointer.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener("pointermove",e=>{if(!pointer.has(e.pointerId))return;const old=pointer.get(e.pointerId);pointer.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointer.size===1){yaw+=(e.clientX-old.x)*.01;pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.clientY-old.y)*.01));}else if(pointer.size===2){const points=[...pointer.values()],dist=Math.hypot(points[0].x-points[1].x,points[0].y-points[1].y);if(lastDistance!==null)zoom=Math.min(5,Math.max(.25,zoom*dist/Math.max(1,lastDistance)));lastDistance=dist;}});
function endPointer(e){pointer.delete(e.pointerId);if(pointer.size<2)lastDistance=null}canvas.addEventListener("pointerup",endPointer);canvas.addEventListener("pointercancel",endPointer);
canvas.addEventListener("wheel",e=>{e.preventDefault();zoom=Math.min(5,Math.max(.25,zoom*Math.exp(-e.deltaY*.001)))},{passive:false});
$("reset").onclick=()=>{yaw=-.53;pitch=.38;zoom=1};$("grid").onclick=()=>{axes=!axes;$("grid").textContent=axes?"⌗ 축 숨기기":"⌗ 축 표시"};$("prev").onclick=()=>{endPlay();setStep(step-1)};$("next").onclick=()=>{endPlay();setStep(step+1)};$("start").onclick=()=>{endPlay();setStep(0)};$("play").onclick=autoplay;$("record").onclick=startRecord;
window.addEventListener("resize",resize);resize();requestAnimationFrame(frame);
(async()=>{try{
 const requestedId=new URLSearchParams(location.search).get("id")||"2027-09-28";const id=requestedId==="private-speedrunner-26-30"?"private-speedrunner-25-30":requestedId;const [l,p,x1,x2,x3,x4]=await Promise.all([fetch("data/lessons.json"),fetch("data/problems.json"),fetch("data/lessons-extra-1.json"),fetch("data/lessons-extra-2.json"),fetch("data/lessons-extra-3.json"),fetch("data/lessons-private.json")]);if(!l.ok||!p.ok||!x1.ok||!x2.ok||!x3.ok||!x4.ok)throw Error("풀이 데이터를 불러오지 못했습니다.");
 const lessons={...(await l.json()),...(await x1.json()),...(await x2.json()),...(await x3.json()),...(await x4.json())},problems=await p.json();lesson=lessons[id];const current=problems.find(v=>v.id===id);
 if(!lesson)throw Error("선택한 문항의 3D 풀이가 아직 등록되지 않았습니다. 풀이가 있는 다른 문항을 선택해 주세요.");
 $("heading").textContent=current?`${current.year?current.year+"학년도 · ":""}${current.sourceType==="사설"?(current.sourceName+" · "):""}${current.exam==="대학수학능력시험"?"수능":current.exam} · ${current.subject||"기하"} ${current.number}번`:"3D 단계별 풀이";
 const sourceEl=document.getElementById("sourceInfo");if(sourceEl&&current){const category=current.sourceType||"평가원";sourceEl.textContent=category+(current.sourceName&&current.sourceName!==category?` · ${current.sourceName}`:"");}
 $("question").textContent=lesson.prompt;$("answer").textContent="정답 · "+lesson.answer;setStep(0);
 }catch(e){lesson=null;$("heading").textContent="풀이 준비 중";$("question").innerHTML=`<div class="error">${esc(e.message)}</div>`;$("step").hidden=true;$("answer").hidden=true;}})();