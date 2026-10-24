"use strict";
window.GeometryProblemLab=function(api){
 const {byId,v,clamp,deg,fixed,drawSphere,ring,line,dot,polygon,planeCorners,surface,drawSurfaces,project}=api;
 const rt=Math.sqrt,PI=Math.PI,TAU=2*PI;
 const norm=a=>{const m=v.len(a);return m>1e-9?v.mul(a,1/m):[0,0,1]};
 const app=(tag,parent,cls,text)=>{
  const el=document.createElement(tag);if(cls)el.className=cls;
  if(text!==undefined)el.textContent=text;parent.append(el);return el;
 };
 const safeNumber=(x,backup)=>Number.isFinite(x)?x:backup;
 const state={ready:false,record:null,lesson:null,center:[0,0,0],scale:9,tool:"original",selected:null,activeSphere:0,activePolygon:0,activeLine:0,cutHeight:0,cutTilt:18,projectionTilt:32,pointT:.5,phi:0,theta:35.26438968275,beta:90,detail:null,dragHandle:null};
 const panel=byId("problemControls");
 const root=byId("problemInfo");
 const notes=byId("problemNotes");
 const idAlias=id=>id==="private-speedrunner-26-30"?"private-speedrunner-25-30":id;
 function fmtRecord(p){
  return [p.sourceType==="사설"?p.sourceName||"사설":p.sourceType||"평가원",p.year?p.year+"학년도":null,p.exam==="대학수학능력시험"?"수능":p.exam,p.subject||"기하",(p.number||"?")+"번"].filter(Boolean).join(" · ");
 }
 function primitivePoints(obj){
  if(obj.type==="sphere"||obj.type==="circle")return [obj.c];
  if(obj.type==="plane")return [obj.c];
  if(obj.type==="point")return [obj.p];
  if(obj.type==="line")return [obj.a,obj.b];
  if(obj.type==="polygon")return obj.pts;
  return [];
 }
 function makeCenter(objects){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  const include=(x,r=0)=>{if(!Array.isArray(x)||x.length!==3)return;
   for(let i=0;i<3;i++){min[i]=Math.min(min[i],x[i]-r);max[i]=Math.max(max[i],x[i]+r);}};
  for(const obj of objects){
   if(obj.type==="sphere"||obj.type==="circle")include(obj.c,obj.r||0);
   else for(const p of primitivePoints(obj))include(p);
  }
  const center=min.every(Number.isFinite)?min.map((x,i)=>(x+max[i])/2):[0,0,0];
  const radius=min.every(Number.isFinite)?Math.max(...min.map((x,i)=>max[i]-x),2):9;
  return {center,scale:Math.max(4,radius*.85)};
 }
 function unitBasis(normal){
  const n=norm(normal),base=Math.abs(n[2])<.82?[0,0,1]:[0,1,0],u=norm(v.cross(n,base));
  return {u,w:norm(v.cross(n,u))};
 }
 function anglePlanes(normal1,normal2){
  return Math.acos(clamp(Math.abs(v.dot(norm(normal1),norm(normal2))),0,1))/PI*180;
 }
 function area(pts){
  if(!pts||pts.length<3)return 0;
  let a=0;for(let i=1;i<pts.length-1;i++)a+=v.len(v.cross(v.sub(pts[i],pts[0]),v.sub(pts[i+1],pts[0])))/2;
  return a;
 }
 function setText(el,text){el.textContent=text;}
 function row(parent,title,val){
  const container=app("div",parent,"problem-value");
  app("span",container,"",title);const output=app("strong",container,"",val);return output;
 }
 function slider(parent,label,min,max,step,value,onChange){
  const group=app("div",parent,"problem-slider");
  const caption=app("label",group,"lab-control-label");
  app("span",caption,"",label);const display=app("output",caption,"",fixed(value,step<1?2:0));
  const control=app("input",group);
  control.type="range";control.min=min;control.max=max;control.step=step;control.value=value;
  control.setAttribute("aria-label",label);
  control.addEventListener("input",()=>{
   const n=Number(control.value);display.textContent=fixed(n,step<1?2:0)+(label.includes("각")?"°":"");
   onChange(n);
  });
  if(label.includes("각"))display.textContent=fixed(value,step<1?2:0)+"°";
  return {control,display};
 }
 function select(parent,label,values,onChange){
  const group=app("div",parent,"problem-select");
  app("label",group,"lab-control-label",label);
  const control=app("select",group);
  for(const item of values){const option=new Option(item.label,item.value);control.add(option);}
  control.addEventListener("change",()=>onChange(control.value));
  return control;
 }
 function button(parent,label,handler){
  const el=app("button",parent,"lab-secondary-action",label);el.type="button";el.addEventListener("click",handler);return el;
 }
 function metricBox(parent){return app("div",parent,"problem-metrics");}
 function showError(message){
  panel.replaceChildren();app("p",panel,"lab-note",message);
 }
 function getOriginalData(){
  const objects=state.lesson.objects||[];
  return {
   spheres:objects.filter(o=>o.type==="sphere"),
   circles:objects.filter(o=>o.type==="circle"),
   polys:objects.filter(o=>o.type==="polygon"&&o.pts?.length>=3),
   lines:objects.filter(o=>o.type==="line"),
   points:objects.filter(o=>o.type==="point")
  };
 }
 function sceneScale(){return state.scale;}
 function sceneCenter(){return state.center;}
 function renderObjects(objects,opts={}){
  const surfaces=[],circles=[],segments=[],dots=[],spheres=[];
  const filter=opts.filter||(()=>true);
  for(const o of objects){
   if(!filter(o))continue;
   const c=o.color||"#7dd3fc";
   const faded=opts.highlight&&o.id!==opts.highlight;
   const alpha=faded?.065:.2;
   if(o.type==="sphere")spheres.push(o);
   else if(o.type==="plane"){const b=unitBasis(o.n);surfaces.push(surface(planeCorners(o.c,b.u,b.w,o.size||8),faded?.04:.13,c));}
   else if(o.type==="polygon")surfaces.push(surface(o.pts,alpha,c));
   else if(o.type==="circle")circles.push(o);
   else if(o.type==="line")segments.push(o);
   else if(o.type==="point")dots.push(o);
  }
  for(const o of spheres)drawSphere(o.c,o.r);
  drawSurfaces(surfaces);
  for(const o of circles){const b=unitBasis(o.n);ring(o.c,b.u,b.w,o.r,o.color||"#fbbf24",o.id===opts.highlight?4:2,.94);}
  for(const o of segments)line(o.a,o.b,o.id===opts.highlight?"#fbbf24":o.color||"#7dd3fc",o.id===opts.highlight?4:2,false,opts.highlight&&o.id!==opts.highlight?.18:1);
  for(const o of dots)dot(o.id,o.p,o.id===opts.highlight?"#fbbf24":o.color||"#dbeafe",o.id===opts.highlight?6:3.6);
 }
 function drawCustom2022(){
  const C=[2,rt(5),5],O=[0,0,0],P=[0,0,1],u=[2/3,rt(5)/3,0],z=[0,0,1];
  const phi=deg(state.phi),Q=v.add(C,v.mul(v.add(v.mul(u,Math.cos(phi)),v.mul(z,Math.sin(phi))),5));
  const chord=v.sub(Q,P),d=norm(chord);
  const F=v.add(P,v.mul(d,v.dot(v.sub(C,P),d)));
  const toC=v.sub(C,F),height=v.len(toC),n0=norm(toC),b=norm(v.cross(d,n0));
  const A=v.cross(d,n0)[2],B=v.cross(d,b)[2];
  const radius=Math.hypot(A,B),cosTarget=Math.cos(deg(state.theta));
  const minTheta=Math.acos(clamp(radius,0,1))*180/PI;
  const attainable=clamp(state.theta,minTheta,90);state.theta=attainable;
  // PQ를 포함하는 평면 가운데 희망 이면각과 일치하는 평면을 기존 방향에서 가장 가까운 가지로 선택.
  const delta=Math.atan2(B,A),ang=Math.acos(clamp(cosTarget/Math.max(radius,1e-7),-1,1));
  const d2=Math.acos(clamp(-cosTarget/Math.max(radius,1e-7),-1,1));
  const goalAlpha=deg(state.detail?.alpha??-65.9051574478893);
  const candidates=[delta+ang,delta-ang,delta+d2,delta-d2,delta+TAU+ang,delta-TAU-ang,delta+TAU-ang,delta-TAU+ang,delta+d2+TAU,delta-d2-TAU];
  const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
  const alpha=candidates.reduce((best,x)=>Math.abs(wrap(x-goalAlpha))<Math.abs(wrap(best-goalAlpha))?x:best,candidates[0]);
  const t=norm(v.add(v.mul(n0,Math.cos(alpha)),v.mul(b,Math.sin(alpha))));
  const J=v.add(F,v.mul(t,v.dot(toC,t)));
  const rr=Math.sqrt(Math.max(0,25-Math.pow(v.len(v.sub(C,J)),2)));
  const beta=deg(state.beta);
  const R=v.add(J,v.mul(v.add(v.mul(d,Math.cos(beta)),v.mul(t,Math.sin(beta))),rr));
  const Q1=[Q[0],Q[1],0],R1=[R[0],R[1],0];
  const normal=norm(v.cross(d,t));
  const dihedral=anglePlanes(normal,[0,0,1]);
  const areaXY=area([O,Q1,R1]);
  const projected=areaXY*Math.abs(normal[2]);
  state.detail={alpha:alpha*180/PI,thetaMin:minTheta,actualTheta:dihedral,areaXY,projected,Q,R};
  // 평면 OPC는 원래 구의 중심을 지나는 대원이다.
  drawSphere(C,5);
  drawSurfaces([
   surface(planeCorners(C,u,z,13),.1,"#a78bfa"),
   surface([O,Q1,R1],.29,"#34d399"),
   surface([P,Q,R],.33,"#fbbf24",2)
  ]);
  ring(C,u,z,5,"#60cfff",1.9,.8);
  line(P,Q,"#a78bfa",2.3);
  line(P,R,"#fbbf24",2.2);
  line(Q,R,"#fbbf24",2.2);
  line(Q,Q1,"#5eead4",1.5,true);
  line(R,R1,"#5eead4",1.5,true);
  line(O,Q1,"#34d399",2.2);line(O,R1,"#34d399",2.2);
  dot("C",C,"#dbeafe");dot("O",O,"#dbeafe");dot("P",P,"#a78bfa");
  dot("Q",Q,"#fbbf24",5.5);dot("R",R,"#f472b6",5.5);
  dot("Q₁",Q1,"#34d399");dot("R₁",R1,"#34d399");
 }
 function drawSpecial2022P(){
  const A=[0,0,3],B=[2,0,0],C=[0,2*rt(3),0],D=[0,0,0];
  const t=state.pointT,Pt=v.mix(B,C,t);
  drawSurfaces([surface([A,D,B],.12,"#a78bfa"),surface([A,D,C],.12,"#60a5fa"),surface([D,B,C],.15,"#34d399")]);
  for(const [s,e] of [[A,B],[A,C],[A,D],[D,B],[D,C],[B,C]])line(s,e,"#7dd3fc",2);
  line(A,Pt,"#f472b6",3);line(D,Pt,"#fbbf24",3);
  for(const [id,xyz] of Object.entries({A,B,C,D}))dot(id,xyz);
  dot("P",Pt,"#fbbf24",6);
  state.detail={ap:v.len(v.sub(A,Pt)),dp:v.len(Pt)};
 }
 function drawOriginal(){renderObjects(state.lesson.objects||[]);}
 function drawSlice(){
  drawOriginal();
  const s=getOriginalData().spheres[state.activeSphere];if(!s)return;
  const angle=deg(state.cutTilt),n=[0,-Math.sin(angle),Math.cos(angle)];
  const distance=state.cutHeight*s.r,c=v.add(s.c,v.mul(n,distance));
  const r=Math.sqrt(Math.max(0,s.r*s.r-distance*distance)),basis=unitBasis(n);
  drawSurfaces([surface(planeCorners(c,basis.u,basis.w,s.r*2.4),.21,"#5eead4")]);
  ring(c,basis.u,basis.w,r,"#fbbf24",3);
  dot("단면 중심",c,"#fbbf24",4);
 }
 function drawProjection(){
  drawOriginal();const shape=getOriginalData().polys[state.activePolygon];if(!shape)return;
  const pts=shape.pts;
  const centroid=pts.reduce((acc,p)=>v.add(acc,p),[0,0,0]).map(x=>x/pts.length);
  const n0=norm(v.cross(v.sub(pts[1],pts[0]),v.sub(pts[2],pts[0])));
  const basis=unitBasis(n0),tilt=deg(state.projectionTilt),n=norm(v.add(v.mul(n0,Math.cos(tilt)),v.mul(basis.u,Math.sin(tilt))));
  const b=unitBasis(n);
  const out=pts.map(p=>v.sub(p,v.mul(n,v.dot(v.sub(p,centroid),n))));
  drawSurfaces([surface(planeCorners(centroid,b.u,b.w,state.scale*1.6),.09,"#5eead4"),surface(pts,.25,"#93c5fd"),surface(out,.43,"#34d399")]);
  pts.forEach((p,i)=>{line(p,out[i],"#fbbf24",1.8,true);dot("X"+(i+1),out[i],"#5eead4",3.5)});
  state.detail={baseArea:area(pts),projectedArea:area(out)};
 }
 function drawLinePoint(){
  drawOriginal();const edge=getOriginalData().lines[state.activeLine];if(!edge)return;
  const p=v.mix(edge.a,edge.b,state.pointT);
  line(edge.a,edge.b,"#fbbf24",3.5);dot("X",p,"#fbbf24",6.5);
 }
 function drawHighlight(){
  const objects=state.lesson.objects||[],part=objects.find(o=>o.id===state.selected);
  renderObjects(objects,{highlight:part?.id});
  if(part?.type==="polygon")polygon(part.pts,"#5eead4",.43,3);
  if(part?.type==="line")line(part.a,part.b,"#fbbf24",4);
 }
 function draw(){
  if(!state.ready||!state.lesson)return;
  if(state.tool==="special2022")drawCustom2022();
  else if(state.tool==="special2022point")drawSpecial2022P();
  else if(state.tool==="slice")drawSlice();
  else if(state.tool==="projection")drawProjection();
  else if(state.tool==="point")drawLinePoint();
  else if(state.tool==="highlight")drawHighlight();
  else drawOriginal();
 }
 function updateHeader(){
  if(!state.record)return;
  const title=fmtRecord(state.record);
  byId("problemHeading").textContent=title;
  byId("problemInfo").textContent=state.lesson.prompt||state.record.description||"";
  byId("problemBack").href="viewer.html?id="+encodeURIComponent(state.record.id);
 }
 function build2022(){
  panel.replaceChildren();
  app("p",panel,"problem-explanation","Q는 원래 대원 위, R은 구 위에 남도록 구성했습니다. 이면각을 변경하면 평면 PQR과 R의 위치가 함께 바뀝니다.");
  const metrics=metricBox(panel),mTheta=row(metrics,"현재 이면각 θ","35.26°"),mXY=row(metrics,"△OQ₁R₁ 넓이","20.00"),mProjected=row(metrics,"PQR로 정사영한 넓이","16.33"),mMin=row(metrics,"현재 Q에서 가능한 최소 이면각","26.57°");
  const q=slider(panel,"대원 위 Q 위치각",-80,80,1,state.phi,n=>{state.phi=n;state.detail=null;sync();});
  const theta=slider(panel,"평면 PQR의 이면각 θ",0,90,.5,state.theta,n=>{state.theta=n;sync();});
  const r=slider(panel,"교원 위 R 위치각",-180,180,1,state.beta,n=>{state.beta=n;sync();});
  const warning=app("p",panel,"lab-constraint-note","Q의 위치에 따라 가능한 최소 이면각이 달라집니다. 각도를 그보다 작게 지정하면 가능한 최소 각으로 자동 조정됩니다.");
  app("p",panel,"lab-note","노란 Q와 분홍 R을 직접 드래그하거나 슬라이더로 이동할 수 있습니다. ※ 원문 최댓값 조건은 조작 중 유지되지 않을 수 있습니다.");
  button(panel,"원래 풀이의 배치로 복원",()=>{
   state.phi=0;state.theta=35.26438968275;state.beta=90;state.detail=null;
   q.control.value=0;q.display.textContent="0°";
   theta.control.value=String(state.theta);theta.display.textContent=fixed(state.theta)+"°";
   r.control.value=90;r.display.textContent="90°";
   sync();
  });
  state.syncMetrics=()=>{
   const d=state.detail;if(!d)return;
   theta.control.min=fixed(d.thetaMin,3);
   if(state.theta<d.thetaMin){state.theta=d.thetaMin;theta.control.value=String(d.thetaMin);}
   theta.display.textContent=fixed(state.theta)+"°";
   mTheta.textContent=fixed(d.actualTheta)+"°";mXY.textContent=fixed(d.areaXY);
   mProjected.textContent=fixed(d.projected);mMin.textContent=fixed(d.thetaMin)+"°";
   warning.textContent="현재 Q에서 가능한 이면각: "+fixed(d.thetaMin)+"°~90°. Q를 옮길 때 범위를 벗어난 설정은 가장 가까운 가능한 각도로 맞춰집니다.";
  };
 }
 function build2022P(){
  panel.replaceChildren();
  app("p",panel,"problem-explanation","사면체의 조건을 그대로 유지하면서 점 P를 선분 BC 위에서 이동시킵니다.");
  const metrics=metricBox(panel),length=row(metrics,"AP + DP",""),distance=row(metrics,"DP",""),optimal=row(metrics,"최솟값","3√3");
  const sliderObj=slider(panel,"BC 위 P 위치 (B→C)",0,1,.005,state.pointT,n=>{state.pointT=n;sync();});
  button(panel,"원문 최솟값 위치 t=1/4",()=>{
   state.pointT=.25;sliderObj.control.value=".25";sliderObj.display.textContent="0.25";sync();
  });
  state.syncMetrics=()=>{if(!state.detail)return;length.textContent=fixed(state.detail.ap+state.detail.dp);distance.textContent=fixed(state.detail.dp);optimal.textContent="3√3 ≈ "+fixed(3*rt(3));};
 }
 function availableTools(){
  const data=getOriginalData(),options=[{label:"문제의 원래 3D 모델",value:"original"}];
  if(data.spheres.length)options.push({label:"구 절단 평면 실험",value:"slice"});
  if(data.polys.length)options.push({label:"도형의 정사영 실험",value:"projection"});
  if(data.lines.length)options.push({label:"모서리 위 점 이동",value:"point"});
  if((state.lesson.objects||[]).length)options.push({label:"면·선분 강조",value:"highlight"});
  return options;
 }
 function buildGeneric(){
  panel.replaceChildren();
  app("p",panel,"problem-explanation","풀이에 사용된 실제 3D 도형을 불러왔습니다. 아래 추가 실험은 원문에 주어지지 않은 조건을 임의로 변경할 수 있습니다.");
  const selector=select(panel,"실험할 항목",availableTools(),value=>{state.tool=value;state.detail=null;buildGeneric();sync();});
  selector.value=state.tool;
  const data=getOriginalData();
  if(state.tool==="original"){
   app("p",panel,"lab-note","원래 풀이의 모든 선분, 점, 구와 평면을 한 화면에 표시합니다. 손가락으로 회전·확대하면서 공간 배치를 확인할 수 있습니다.");
  }else if(state.tool==="slice"){
   select(panel,"구 선택",data.spheres.map((o,i)=>({label:o.id||"구 "+(i+1),value:i})),v0=>{state.activeSphere=Number(v0);sync();}).value=String(state.activeSphere);
   const sphere=data.spheres[state.activeSphere];
   const metrics=metricBox(panel),radius=row(metrics,"단면 반지름",""),areaOut=row(metrics,"단면 넓이","");
   slider(panel,"중심에서 단면까지 거리 (반지름 비율)",-1,1,.01,state.cutHeight,n=>{state.cutHeight=n;sync();});
   slider(panel,"절단 평면 기울기",0,90,1,state.cutTilt,n=>{state.cutTilt=n;sync();});
   state.syncMetrics=()=>{const dist=Math.abs(state.cutHeight*sphere.r);radius.textContent=fixed(Math.sqrt(Math.max(0,sphere.r*sphere.r-dist*dist)));areaOut.textContent=fixed(sphere.r*sphere.r-dist*dist)+"π";};
  }else if(state.tool==="projection"){
   const selector=select(panel,"도형 선택",data.polys.map((o,i)=>({label:o.id||"면 "+(i+1),value:i})),value=>{state.activePolygon=Number(value);sync();});
   selector.value=String(state.activePolygon);
   const metrics=metricBox(panel),base=row(metrics,"원래 넓이",""),result=row(metrics,"정사영 넓이","");
   slider(panel,"정사영 평면 기울기",0,90,.5,state.projectionTilt,n=>{state.projectionTilt=n;sync();});
   state.syncMetrics=()=>{const p=data.polys[state.activePolygon]?.pts;if(!p)return;const initial=area(p);base.textContent=fixed(initial);result.textContent=fixed(initial*Math.abs(Math.cos(deg(state.projectionTilt))));};
  }else if(state.tool==="point"){
   const selector=select(panel,"이동할 선분",data.lines.map((o,i)=>({label:o.id||"선분 "+(i+1),value:i})),value=>{state.activeLine=Number(value);sync();});
   selector.value=String(state.activeLine);
   const metrics=metricBox(panel),length=row(metrics,"점 X까지의 거리",""),rest=row(metrics,"남은 선분 길이","");
   slider(panel,"선분 위 점 X 위치",0,1,.005,state.pointT,n=>{state.pointT=n;sync();});
   state.syncMetrics=()=>{const o=data.lines[state.activeLine],dist=v.len(v.sub(o.a,o.b));length.textContent=fixed(state.pointT*dist);rest.textContent=fixed((1-state.pointT)*dist);};
  }else if(state.tool==="highlight"){
   const list=[...data.polys,...data.lines,...data.circles,...data.points].filter(Boolean);
   const selector=select(panel,"표시할 요소",list.map((o,i)=>({label:o.id||o.type+" "+(i+1),value:String(i)})),value=>{state.selected=list[Number(value)]?.id;sync();});
   if(!list.some(o=>o.id===state.selected))state.selected=list[0]?.id;
   selector.value=String(list.findIndex(o=>o.id===state.selected));
   const metrics=metricBox(panel),detail=row(metrics,"선택한 요소의 길이 또는 넓이","");
   state.syncMetrics=()=>{const selected=list.find(o=>o.id===state.selected);
    detail.textContent=selected?.type==="line"?fixed(v.len(v.sub(selected.a,selected.b))):selected?.type==="polygon"?fixed(area(selected.pts)):"—";
   };
  }
  app("p",panel,"lab-note","도형을 바꾸는 추가 실험은 원래 문항의 정답이나 제약 조건을 보장하지 않습니다. 정확한 원문 풀이를 확인하려면 상단의 ‘풀이로 돌아가기’를 선택하세요.");
 }
 function sync(){
  if(!state.ready)return;
  // 2022 수능 30번은 평면의 정상 범위를 매번 재계산한다.
  if(state.tool==="special2022"){
   // render에서 사용하는 순수 좌표식과 동일한 계산을 진행해 즉시 표시한다.
   const C=[2,rt(5),5],P=[0,0,1],u=[2/3,rt(5)/3,0],phi=deg(state.phi);
   const Q=v.add(C,v.mul(v.add(v.mul(u,Math.cos(phi)),[0,0,Math.sin(phi)]),5));
   const d=norm(v.sub(Q,P)),F=v.add(P,v.mul(d,v.dot(v.sub(C,P),d))),n0=norm(v.sub(C,F)),b=norm(v.cross(d,n0));
   const az=v.cross(d,n0)[2],bz=v.cross(d,b)[2],mag=Math.hypot(az,bz);
   const lower=Math.acos(clamp(mag,0,1))*180/PI;
   state.theta=clamp(state.theta,lower,90);
   // Directly compute the full interactive scene for current controls (draw() uses the same deterministic geometry).
   const delta=Math.atan2(bz,az),cosT=Math.cos(deg(state.theta)),ar=Math.acos(clamp(cosT/Math.max(mag,1e-9),-1,1)),ar2=Math.acos(clamp(-cosT/Math.max(mag,1e-9),-1,1));
   const ref=deg(state.detail?.alpha??-65.9051574478893);
   const options=[delta+ar,delta-ar,delta+ar2,delta-ar2,delta+TAU+ar,delta-TAU-ar,delta+TAU-ar2,delta-TAU+ar2];
   const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
   const alpha=options.reduce((best,x)=>Math.abs(wrap(x-ref))<Math.abs(wrap(best-ref))?x:best,options[0]);
   const t=norm(v.add(v.mul(n0,Math.cos(alpha)),v.mul(b,Math.sin(alpha)))),J=v.add(F,v.mul(t,v.dot(v.sub(C,F),t)));
   const rr=rt(Math.max(0,25-v.len(v.sub(C,J))**2)),beta=deg(state.beta);
   const R=v.add(J,v.mul(v.add(v.mul(d,Math.cos(beta)),v.mul(t,Math.sin(beta))),rr));
   const n=norm(v.cross(d,t)),areaXY=area([[0,0,0],[Q[0],Q[1],0],[R[0],R[1],0]]);
   state.detail={alpha:alpha*180/PI,thetaMin:lower,actualTheta:anglePlanes(n,[0,0,1]),areaXY,projected:areaXY*Math.abs(n[2]),Q,R};
  }else if(state.tool==="special2022point"){
   const p=v.mix([2,0,0],[0,2*rt(3),0],state.pointT);
   state.detail={ap:v.len(v.sub([0,0,3],p)),dp:v.len(p)};
  }
  if(state.syncMetrics)state.syncMetrics();
 }
 function buildPanel(){
  state.syncMetrics=null;
  if(state.tool==="special2022")build2022();
  else if(state.tool==="special2022point")build2022P();
  else buildGeneric();
  sync();
 }
 async function load(id){
  try{
   const canonical=idAlias(id);
   const list=["data/problems.json","data/lessons.json","data/lessons-extra-1.json","data/lessons-extra-2.json","data/lessons-extra-3.json","data/lessons-private.json"];
   const response=await Promise.all(list.map(path=>fetch(path,{cache:"no-store"})));
   if(response.some(x=>!x.ok))throw Error("문항별 실험 데이터를 불러올 수 없습니다.");
   const [problems,...sets]=await Promise.all(response.map(x=>x.json()));
   const lessons=Object.assign({},...sets);
   const record=problems.find(p=>p.id===canonical),lesson=lessons[canonical];
   if(!record||!lesson)throw Error("선택한 문항에 등록된 3D 풀이가 없습니다.");
   state.ready=true;state.record=record;state.lesson=lesson;
   const geom=makeCenter(lesson.objects||[]);state.scale=Math.max(lesson.scale||7,geom.scale);
   state.center=geom.center;
   state.tool=canonical==="2022-11-30"?"special2022":canonical==="2022-09-27"?"special2022point":"original";
   if(state.tool==="special2022"){state.center=[2,2,3];state.scale=15;}
   if(state.tool==="special2022point"){state.center=[.7,.6,1];state.scale=5.5;state.pointT=.25;}
   updateHeader();buildPanel();
   return record;
  }catch(e){
   state.ready=false;showError(e.message||String(e));throw e;
  }
 }
 function movePoint(clientX,clientY){
  if(state.tool==="special2022"){
   const handle=state.dragHandle;if(!handle)return false;
   const rect=api.canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
   const C=[2,rt(5),5],u=[2/3,rt(5)/3,0],P=[0,0,1],fromPhi=state.phi;
   const Qat=phi=>v.add(C,v.mul(v.add(v.mul(u,Math.cos(deg(phi))),[0,0,Math.sin(deg(phi))]),5));
   // R은 현재 평면 PQR과 구의 교원 위에서 움직이므로 현재 구와 평면의 교선을 사용한다.
   const Q=Qat(fromPhi),d=norm(v.sub(Q,P));
   const F=v.add(P,v.mul(d,v.dot(v.sub(C,P),d)));
   const n0=norm(v.sub(C,F)),b=norm(v.cross(d,n0));
   const alpha=deg(state.detail?.alpha??-65.9051574478893);
   const t=norm(v.add(v.mul(n0,Math.cos(alpha)),v.mul(b,Math.sin(alpha))));
   const J=v.add(F,v.mul(t,v.dot(v.sub(C,F),t)));
   const rr=rt(Math.max(0,25-v.len(v.sub(C,J))**2));
   const Rat=beta=>v.add(J,v.mul(v.add(v.mul(d,Math.cos(deg(beta))),v.mul(t,Math.sin(deg(beta)))),rr));
   const low=handle==="Q"?-80:-180,high=handle==="Q"?80:180;
   let best=low,bestDist=Infinity;
   for(let a=low;a<=high;a+=1){
    const screen=project(handle==="Q"?Qat(a):Rat(a));
    const dist=(screen.x-x)**2+(screen.y-y)**2;
    if(dist<bestDist){bestDist=dist;best=a;}
   }
   const name=handle==="Q"?"대원 위 Q 위치각":"교원 위 R 위치각";
   state[handle==="Q"?"phi":"beta"]=best;
   const control=[...panel.querySelectorAll('input[type="range"]')].find(e=>e.getAttribute("aria-label")===name);
   if(control){control.value=String(best);control.dispatchEvent(new Event("input",{bubbles:true}));}
   else sync();
   return true;
  }
  if(state.tool!=="special2022point"&&state.tool!=="point")return false;
  const edge=state.tool==="special2022point"?{a:[2,0,0],b:[0,2*rt(3),0]}:getOriginalData().lines[state.activeLine];
  if(!edge)return false;
  const rect=api.canvas.getBoundingClientRect(),px=clientX-rect.left,py=clientY-rect.top;
  const a=project(edge.a),b=project(edge.b);
  const abx=b.x-a.x,aby=b.y-a.y;
  const t=clamp(((px-a.x)*abx+(py-a.y)*aby)/Math.max(1,abx*abx+aby*aby),0,1);
  state.pointT=t;
  const range=[...panel.querySelectorAll('input[type="range"]')].find(x=>x.getAttribute("aria-label")?.includes("위")||x.getAttribute("aria-label")?.includes("위치"));
  if(range){range.value=String(t);range.dispatchEvent(new Event("input"));}
  else sync();
  return true;
 }
 function nearDraggable(clientX,clientY){
  if(!state.ready)return false;
  state.dragHandle=null;
  if(state.tool==="special2022"){
   const detail=state.detail;if(!detail)return false;
   const rect=api.canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;
   const Q=project(detail.Q),R=project(detail.R),distQ=Math.hypot(x-Q.x,y-Q.y),distR=Math.hypot(x-R.x,y-R.y);
   if(Math.min(distQ,distR)<37){state.dragHandle=distQ<=distR?"Q":"R";return true;}
   return false;
  }
  if(!["special2022point","point"].includes(state.tool))return false;
  const rect=api.canvas.getBoundingClientRect();
  const point=state.tool==="special2022point"?v.mix([2,0,0],[0,2*rt(3),0],state.pointT):
   (()=>{const l=getOriginalData().lines[state.activeLine];return l?v.mix(l.a,l.b,state.pointT):null;})();
  if(!point)return false;
  const screen=project(point);
  return Math.hypot(clientX-rect.left-screen.x,clientY-rect.top-screen.y)<33;
 }
 return {load,draw,sceneScale,sceneCenter,nearDraggable,movePoint,get ready(){return state.ready},get record(){return state.record},get state(){return state}};
};
