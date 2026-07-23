let sceneMode = 'single';
let flagPlanes = false;
let flagNormals = false;
let flagCircleLabels = true;
let flagVertexLabels = true;
let flagSatellites = false;
let flagSolidLines = false;
let flagShowIntersectionColor = true;
let flagCenterLines = true;
let flagShowSphereOutline = true;
let ctrlCircleCount = 6;
let ctrlSphereCount = 6;
let ctrlGridSize = 3;
let ctrlPlaneDensity = 0.4;
let ctrlSatelliteDensity = 0.6;
let ctrlSatelliteScale = 1.0;
let ctrlStrokeScale = 1.0;
let ctrlRotateSpeed = 1.0;
let ctrlVertexSize = 1.0;
let flagBlurFills = false;
let ctrlBlurAmount = 0.03;
let gridContentMode = 'single';
let flagRandomGrid = false;
let flagCircleSpin = true; // whether circles precess on their own axes during animation
let ctrlAspect = 'square'; // 'square' | '16:9'
let zoomLevel = 1;
const EPS = 6e-3;
const YELLOW = '#F0DB3A';
const HIGHLIGHT_PALETTE = ['#F0DB3A', '#EDA946', '#A6D6FC', '#C3E36B'];
function hexToRgba(hex, alpha){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16);
  const g = parseInt(h.substring(2,4),16);
  const b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
const INK = '#2F2F2F';
const PAPER = '#FFFCF2';
const SOLID_GRAY = '#9C948E';
function inkA(a){ return `rgba(47,47,47,${a})`; }
function LW(base){ return base * ctrlStrokeScale; }
function dotDash(gapUnits){ return flagSolidLines ? [] : [0.001, LW(gapUnits)]; }
function dashColor(normalColor){ return flagSolidLines ? SOLID_GRAY : normalColor; }

function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];}
function add(a,b){return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function scale(a,s){return [a[0]*s,a[1]*s,a[2]*s];}
function norm(a){return Math.sqrt(dot(a,a));}
function normalize(a){const n=norm(a); return n<1e-9?[0,0,1]:scale(a,1/n);}
function randRange(lo,hi){ return lo + Math.random()*(hi-lo); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function randUnit(){
  const z = Math.random()*2-1;
  const t = Math.random()*2*Math.PI;
  const r = Math.sqrt(Math.max(0,1-z*z));
  return [r*Math.cos(t), r*Math.sin(t), z];
}

function basis(n){
  const a = Math.abs(n[0]) < 0.9 ? [1,0,0] : [0,1,0];
  const u = normalize(cross(n,a));
  const v = cross(n,u);
  return [u,v];
}

let viewYaw = 0.5, viewPitch = 0.28;
function rotate3D(p, yaw, pitch){
  const x=p[0], y=p[1], z=p[2];
  const x1 = x*Math.cos(yaw) + z*Math.sin(yaw);
  const z1 = -x*Math.sin(yaw) + z*Math.cos(yaw);
  const y2 = y*Math.cos(pitch) - z1*Math.sin(pitch);
  const z2 = y*Math.sin(pitch) + z1*Math.cos(pitch);
  return [x1, y2, z2];
}
function rot(p){ return rotate3D(p, viewYaw, viewPitch); }

function classifyCircle(n,h,rho){
  const nz = n[2];
  if (Math.abs(h) < EPS && Math.abs(nz) < EPS) return 'bipolar';
  if (Math.abs(nz - h) < EPS) return 'north-polar';
  if (Math.abs(-nz - h) < EPS) return 'south-polar';
  if (Math.abs(nz) < 1e-4) return 'normal';
  const t = h / nz;
  const q = [0,0,t];
  const foot = scale(n, h);
  const dist = norm(sub(q,foot));
  return (dist < rho) ? 'threaded' : 'normal';
}

function rotateAroundAxis(v, axis, angle){
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const d = dot(v, axis);
  const cr = cross(axis, v);
  return [
    v[0]*cosA + cr[0]*sinA + axis[0]*d*(1-cosA),
    v[1]*cosA + cr[1]*sinA + axis[1]*d*(1-cosA),
    v[2]*cosA + cr[2]*sinA + axis[2]*d*(1-cosA)
  ];
}

function makeCircle(n,h,tag){
  const [u,v] = basis(n);
  const rho = Math.sqrt(Math.max(0,1-h*h));
  const type = classifyCircle(n,h,rho);
  return {
    n,h,u,v,rho,tag,type,
    origN: n, spinAxis: randUnit(), spinAngle: 0,
    spinSpeed: randRange(0.003, 0.012) * (Math.random()<0.5?-1:1)
  };
}

function advanceCircleSpin(c, dt){
  c.spinAngle += c.spinSpeed * dt;
  c.n = rotateAroundAxis(c.origN, c.spinAxis, c.spinAngle);
  const [u,v] = basis(c.n);
  c.u = u; c.v = v;
  c.type = classifyCircle(c.n, c.h, c.rho);
}

function pointOnCircle(c, theta){
  const p1 = scale(c.n, c.h);
  const p2 = scale(c.u, c.rho*Math.cos(theta));
  const p3 = scale(c.v, c.rho*Math.sin(theta));
  return add(p1, add(p2,p3));
}

function circlePairInfo(c1,c2){
  const cc = dot(c1.n,c2.n);
  if (Math.abs(cc) > 0.999999) return {disc:-1, p1:null, p2:null};
  const denom = 1-cc*cc;
  const b = (c2.h - c1.h*cc)/denom;
  const a = (c1.h - b*cc);
  const p0 = add(scale(c1.n,a), scale(c2.n,b));
  const d = cross(c1.n,c2.n);
  const A = dot(d,d);
  const B = 2*dot(p0,d);
  const C = dot(p0,p0) - 1;
  const disc = B*B - 4*A*C;
  if (disc < 0) return {disc, p1:null, p2:null};
  const sq = Math.sqrt(disc);
  const t1 = (-B+sq)/(2*A), t2 = (-B-sq)/(2*A);
  return {disc, p1: add(p0,scale(d,t1)), p2: add(p0,scale(d,t2))};
}
function smoothstep(edge0, edge1, x){
  const t = Math.max(0, Math.min(1, (x-edge0)/(edge1-edge0)));
  return t*t*(3-2*t);
}

function circleIntersections(c1,c2){
  const cc = dot(c1.n,c2.n);
  if (Math.abs(cc) > 0.999999) return {pts:[], tangent:false};
  const denom = 1-cc*cc;
  const b = (c2.h - c1.h*cc)/denom;
  const a = (c1.h - b*cc);
  const p0 = add(scale(c1.n,a), scale(c2.n,b));
  const d = cross(c1.n,c2.n);
  const A = dot(d,d);
  const B = 2*dot(p0,d);
  const C = dot(p0,p0) - 1;
  let disc = B*B - 4*A*C;
  if (disc < -1e-7) return {pts:[], tangent:false};
  if (disc < 0) disc = 0;
  const tangent = disc < 2e-5;
  const sq = Math.sqrt(disc);
  const t1 = (-B+sq)/(2*A);
  const pts = [add(p0, scale(d,t1))];
  if (!tangent){
    const t2 = (-B-sq)/(2*A);
    pts.push(add(p0, scale(d,t2)));
  }
  return {pts, tangent};
}

function computeVertexList(circleList){
  const out = [];
  for (let i=0;i<circleList.length;i++){
    for (let j=i+1;j<circleList.length;j++){
      const res = circleIntersections(circleList[i],circleList[j]);
      for (const p3 of res.pts) out.push({i,j,p3,tangent:res.tangent});
    }
  }
  return out;
}

function generateSatelliteCircles(){
  const n = Math.random() < 0.5 ? 2 : 3;
  const cs = [];
  for (let k=0;k<n;k++) cs.push(makeCircle(randUnit(), randRange(-0.55,0.55)));
  return cs;
}

function attachSatelliteData(vertexList){
  for (const v of vertexList){
    v.satCircles = generateSatelliteCircles();
    v.satVertices = computeVertexList(v.satCircles);
    const frontSat = v.satVertices.map((sv,i)=>i).filter(i=> rot(v.satVertices[i].p3)[2] >= 0);
    const satPool = frontSat.length ? frontSat : v.satVertices.map((sv,i)=>i);
    v.satHighlight = satPool.length ? pick(satPool) : null;
    v.satRFrac = randRange(0.05, 0.09);
  }
}

function generateSatelliteAnchors(circleList, count){
  const anchors = [];
  if (!circleList.length) return anchors;
  for (let k=0;k<count;k++){
    const hostIdx = Math.floor(Math.random()*circleList.length);
    const theta = Math.random()*2*Math.PI;
    anchors.push({hostIdx, theta});
  }
  attachSatelliteData(anchors);
  return anchors;
}

function proj(ocx,ocy,oR,p3){ return [ocx + p3[0]*oR, ocy - p3[1]*oR]; }

function labelFor(c, idx){
  if (!c.tag) return 'C'+idx;
  if (c.tag.indexOf('nbr-')===0) return 'C\u2192S'+c.tag.slice(4);
  return 'C'+idx;
}

function letterLabel(n){
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  if (n < 26) return letters[n];
  return letters[n%26] + Math.floor(n/26);
}

function thetaOf(c,p){
  const foot = scale(c.n, c.h);
  const rel = sub(p, foot);
  return Math.atan2(dot(rel,c.v), dot(rel,c.u));
}
function shortArcThetas(t1,t2,n){
  let diff = t2-t1;
  while (diff > Math.PI) diff -= 2*Math.PI;
  while (diff < -Math.PI) diff += 2*Math.PI;
  const arr = [];
  for (let k=0;k<=n;k++) arr.push(t1 + diff*(k/n));
  return arr;
}
function yellowA(alpha, colorHex){ return hexToRgba(colorHex || YELLOW, alpha); }

function fillLensBetween(ctx, ocx,ocy,oR, rotFn, c1, c2, p1, p2, opacity, colorHex){
  const segs = 24;
  const t1a = thetaOf(c1,p1), t1b = thetaOf(c1,p2);
  const t2a = thetaOf(c2,p1), t2b = thetaOf(c2,p2);
  const arc1 = shortArcThetas(t1a,t1b,segs).map(t=>pointOnCircle(c1,t));
  const arc2 = shortArcThetas(t2b,t2a,segs).map(t=>pointOnCircle(c2,t));
  const scr = arc1.concat(arc2).map(p => proj(ocx,ocy,oR, rotFn(p)));
  if (flagBlurFills) ctx.filter = `blur(${(oR*ctrlBlurAmount).toFixed(1)}px)`;
  ctx.beginPath();
  ctx.moveTo(scr[0][0],scr[0][1]);
  for (let k=1;k<scr.length;k++) ctx.lineTo(scr[k][0],scr[k][1]);
  ctx.closePath();
  ctx.fillStyle = yellowA(opacity != null ? opacity : 1, colorHex);
  ctx.fill();
  if (flagBlurFills) ctx.filter = 'none';
}
function fillTangentSpot(ctx, ocx,ocy,oR, rotFn, p3, opacity, colorHex){
  const scr = proj(ocx,ocy,oR, rotFn(p3));
  if (flagBlurFills) ctx.filter = `blur(${(oR*ctrlBlurAmount).toFixed(1)}px)`;
  ctx.beginPath();
  ctx.arc(scr[0],scr[1], oR*0.035, 0, 2*Math.PI);
  ctx.fillStyle = yellowA(opacity != null ? opacity : 1, colorHex);
  ctx.fill();
  if (flagBlurFills) ctx.filter = 'none';
}

const HORIZON_EPS = 0.08;

function renderSphereView(ctx, ocx, ocy, oR, circleList, opts){
  opts = opts || {};
  const rotFn = opts.rotate || (p=>p);
  const vertexList = opts.vertexList || computeVertexList(circleList);
  const highlightSet = opts.highlightSet || new Set();
  const highlightPairs = opts.highlightPairs || [];
  const vDotR = (opts.dotR != null ? opts.dotR : 2.2) * ctrlVertexSize;

  ctx.layer = 'fills';
  if (flagShowIntersectionColor){
    vertexList.forEach((v, vi) => {
      if (!highlightSet.has(vi)) return;
      const p3 = rotFn(v.p3);
      if (p3[2] < 0) return;
      const partner = vertexList.find((w,wi)=> wi!==vi && w.i===v.i && w.j===v.j);
      if (partner) fillLensBetween(ctx, ocx,ocy,oR, rotFn, circleList[v.i], circleList[v.j], v.p3, partner.p3, 1, opts.highlightColor);
      else fillTangentSpot(ctx, ocx,ocy,oR, rotFn, v.p3, 1, opts.highlightColor);
    });
    highlightPairs.forEach(hp => {
      if (!hp.p1) return;
      const p3 = rotFn(hp.p1);
      const depthFade = smoothstep(-HORIZON_EPS, HORIZON_EPS, p3[2]);
      const finalOpacity = hp.opacity * depthFade;
      if (finalOpacity <= 0.015) return;
      if (hp.p2) fillLensBetween(ctx, ocx,ocy,oR, rotFn, circleList[hp.i], circleList[hp.j], hp.p1, hp.p2, finalOpacity, hp.color);
      else fillTangentSpot(ctx, ocx,ocy,oR, rotFn, hp.p1, finalOpacity, hp.color);
    });
  }

  if (flagShowSphereOutline){
    ctx.layer = 'outline';
    ctx.beginPath();
    ctx.arc(ocx,ocy,oR,0,2*Math.PI);
    ctx.strokeStyle = INK;
    ctx.lineWidth = LW(1.0);
    ctx.setLineDash([]);
    ctx.stroke();
  }

  const N = opts.arcSamples || 220;
  const typeCounts = {normal:0, threaded:0, 'north-polar':0, 'south-polar':0, bipolar:0};
  const labelPts = [];
  const planeCount = Math.round((opts.planeDensity != null ? opts.planeDensity : 1) * circleList.length);

  circleList.forEach((c, idx) => {
    typeCounts[c.type] = (typeCounts[c.type]||0) + 1;
    const isPolarish = (c.type==='north-polar' || c.type==='south-polar');
    let prev = null, prevZ = null;
    let runPts = [];
    let runKey = null;
    const flushRun = () => {
      if (runPts.length < 2){ runPts = []; return; }
      const isDashedRun = runKey !== 'normal';
      ctx.layer = 'arcs';
      ctx.beginPath();
      ctx.moveTo(runPts[0][0], runPts[0][1]);
      for (let i=1;i<runPts.length;i++) ctx.lineTo(runPts[i][0], runPts[i][1]);
      ctx.strokeStyle = isDashedRun ? dashColor(INK) : INK;
      ctx.lineWidth = LW(isDashedRun ? 1.5 : (c.type==='bipolar' ? 1.1 : 0.7));
      if (runKey==='hidden') ctx.setLineDash(dotDash(4));
      else if (runKey==='threaded') ctx.setLineDash(dotDash(5));
      else if (runKey==='polar') ctx.setLineDash(dotDash(6));
      else ctx.setLineDash([]);
      ctx.stroke();
      runPts = [];
    };
    for (let k=0;k<=N;k++){
      const theta = (k/N)*2*Math.PI;
      const p3 = rotFn(pointOnCircle(c, theta));
      const scr = proj(ocx,ocy,oR,p3);
      if (prev){
        const visible = (p3[2] >= 0) && (prevZ >= 0);
        const baseKey = c.type==='threaded' ? 'threaded' : (isPolarish ? 'polar' : 'normal');
        const key = (flagSolidLines || visible) ? baseKey : 'hidden';
        if (runKey !== null && key !== runKey) flushRun();
        if (runPts.length === 0) runPts.push(prev);
        runPts.push(scr);
        runKey = key;
      }
      prev = scr; prevZ = p3[2];
    }
    flushRun();
    if (c.type === 'threaded' && opts.showThreadTicks !== false && flagCenterLines){
      const centerScr = proj(ocx,ocy,oR, rotFn(scale(c.n, c.h)));
      ctx.layer = 'centerlines';
      ctx.beginPath();
      ctx.moveTo(ocx,ocy);
      ctx.lineTo(centerScr[0], centerScr[1]);
      ctx.strokeStyle = dashColor(inkA(0.62));
      ctx.lineWidth = LW(1.3);
      ctx.setLineDash(dotDash(4));
      ctx.stroke();
    }

    const wantPlane = opts.showPlanes && (idx < planeCount);
    const wantNormal = opts.showNormals;
    if (wantPlane || wantNormal){
      const foot = scale(c.n, c.h);
      if (wantPlane){
        const nearW = c.rho * 0.55, farW = c.rho * 1.1;
        const nearD = c.rho * 0.15, farD = c.rho * 1.1 + 0.15;
        const nearA = add(foot, add(scale(c.u,nearD), scale(c.v, nearW)));
        const farA  = add(foot, add(scale(c.u,farD),  scale(c.v, farW)));
        const farB  = add(foot, add(scale(c.u,farD),  scale(c.v,-farW)));
        const nearB = add(foot, add(scale(c.u,nearD), scale(c.v,-nearW)));
        const corners = [nearA, farA, farB, nearB].map(p => proj(ocx,ocy,oR, rotFn(p)));
        ctx.layer = 'planes';
        ctx.beginPath();
        ctx.moveTo(corners[0][0],corners[0][1]);
        for (let k=1;k<4;k++) ctx.lineTo(corners[k][0],corners[k][1]);
        ctx.closePath();
        ctx.strokeStyle = inkA(0.75);
        ctx.lineWidth = LW(0.5);
        ctx.setLineDash([]);
        ctx.stroke();
        if (opts.showLabels !== false){
          ctx.layer = 'labels';
          ctx.font = "9px 'Test Pitch', Georgia, serif";
          ctx.fillStyle = INK;
          const midFarScr = proj(ocx,ocy,oR, rotFn(add(foot, scale(c.u, farD))));
          ctx.fillText('RF\u2080,'+idx, midFarScr[0]+3, midFarScr[1]-3);
        }
      }
      if (wantNormal){
        const tip = add(foot, scale(c.n, c.rho*0.9 + 0.4));
        const footScr = proj(ocx,ocy,oR, rotFn(foot));
        const tipScr = proj(ocx,ocy,oR, rotFn(tip));
        ctx.layer = 'normals';
        ctx.beginPath();
        ctx.moveTo(footScr[0],footScr[1]);
        ctx.lineTo(tipScr[0],tipScr[1]);
        ctx.strokeStyle = INK;
        ctx.lineWidth = LW(0.7);
        ctx.stroke();
        const ang = Math.atan2(tipScr[1]-footScr[1], tipScr[0]-footScr[0]);
        const ah = 5;
        ctx.beginPath();
        ctx.moveTo(tipScr[0],tipScr[1]);
        ctx.lineTo(tipScr[0]-ah*Math.cos(ang-0.4), tipScr[1]-ah*Math.sin(ang-0.4));
        ctx.moveTo(tipScr[0],tipScr[1]);
        ctx.lineTo(tipScr[0]-ah*Math.cos(ang+0.4), tipScr[1]-ah*Math.sin(ang+0.4));
        ctx.stroke();
        if (opts.showLabels !== false){
          ctx.layer = 'labels';
          ctx.font = "9px 'Test Pitch', Georgia, serif";
          ctx.fillStyle = INK;
          ctx.fillText('n', tipScr[0]+4, tipScr[1]-2);
        }
      }
    }

    if (opts.showLabels !== false){
      const labelTheta = (idx * 2.399963) % (2*Math.PI);
      const raw = pointOnCircle(c, labelTheta);
      const p3 = rotFn(raw);
      if (p3[2] >= 0) labelPts.push({p3, text: labelFor(c, idx)});
    }
  });
  ctx.setLineDash([]);

  if (opts.showMeridian && flagCenterLines){
    ctx.layer = 'centerlines';
    ctx.beginPath();
    ctx.moveTo(ocx,ocy);
    ctx.lineTo(ocx + oR*Math.cos(opts.meridianAngle), ocy + oR*Math.sin(opts.meridianAngle));
    ctx.strokeStyle = dashColor(inkA(0.65));
    ctx.lineWidth = LW(1.4);
    ctx.setLineDash(dotDash(4.5));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  let totalSingular = 0, tangentPairs = 0;
  vertexList.forEach(v=>{ if (v.tangent) tangentPairs++; });
  totalSingular = vertexList.length;

  ctx.layer = 'vertices';
  vertexList.forEach((v, vi) => {
    const p3 = rotFn(v.p3);
    if (p3[2] < 0) return;
    const scr = proj(ocx,ocy,oR,p3);

    ctx.layer = 'vertices';
    ctx.beginPath();
    ctx.arc(scr[0],scr[1], vDotR, 0,2*Math.PI);
    ctx.fillStyle = INK;
    ctx.fill();

    if (opts.showVertexLabels !== false){
      ctx.layer = 'labels';
      ctx.font = (opts.vertexLabelSize||9) + "px 'Test Pitch', Georgia, serif";
      ctx.fillStyle = INK;
      ctx.fillText(letterLabel(vi), scr[0]+5, scr[1]-4);
    }
  });

  if (opts.satellites && opts.satelliteAnchors){
    const anchors = opts.satelliteAnchors;
    const satShowCount = Math.round((opts.satelliteDensity != null ? opts.satelliteDensity : 1) * anchors.length);
    anchors.forEach((anchor, ai) => {
      if (ai >= satShowCount) return;
      const hostCircle = circleList[anchor.hostIdx];
      if (!hostCircle) return;
      const p3 = rotFn(pointOnCircle(hostCircle, anchor.theta));
      if (p3[2] < 0) return;
      const scr = proj(ocx,ocy,oR,p3);
      if (anchor.satCircles && anchor.satCircles.length){
        const satR = oR * anchor.satRFrac * ctrlSatelliteScale;
        const satHighlight = (anchor.satHighlight != null) ? new Set([anchor.satHighlight]) : new Set();
        renderSphereView(ctx, scr[0], scr[1], satR, anchor.satCircles, {
          rotate: rotFn, showMeridian:false, arcSamples:50,
          showLabels:false, showVertexLabels:false, satellites:false,
          vertexList: anchor.satVertices, highlightSet: satHighlight, highlightColor: opts.highlightColor,
          dotR: Math.max(1, (opts.dotR!=null?opts.dotR:2.2)*0.55)
        });
      }
      ctx.layer = 'vertices';
      ctx.beginPath();
      ctx.arc(scr[0],scr[1], vDotR*0.85, 0, 2*Math.PI);
      ctx.fillStyle = INK;
      ctx.fill();
    });
  }

  if (opts.showLabels !== false){
    ctx.layer = 'labels';
    ctx.font = (opts.labelFontSize||9.5) + "px 'Test Pitch', Georgia, serif";
    ctx.fillStyle = INK;
    for (const lp of labelPts){
      const scr = proj(ocx,ocy,oR,lp.p3);
      const dx = scr[0]-ocx, dy = scr[1]-ocy;
      const m = Math.sqrt(dx*dx+dy*dy) || 1;
      ctx.fillText(lp.text, scr[0]+(dx/m)*9, scr[1]+(dy/m)*9);
    }
  }

  if (opts.label){
    ctx.layer = 'labels';
    ctx.font = (opts.labelSize||13) + "px 'Test Pitch', Georgia, serif";
    ctx.fillStyle = INK;
    ctx.fillText(opts.label, ocx-6, ocy-oR-8);
  }

  return {typeCounts, totalSingular, tangentPairs};
}

function buildSingleArrangement(circleCount){
  const cs = [];
  for (let i=0;i<circleCount;i++) cs.push(makeCircle(randUnit(), randRange(-0.62,0.62)));
  if (Math.random() < 0.4){
    const n = randUnit();
    const h = (Math.random()<0.5 ? 1 : -1) * n[2];
    cs.push(makeCircle(n,h,'forced-polar'));
  }
  if (Math.random() < 0.3){
    const a = Math.random()*2*Math.PI;
    cs.push(makeCircle([Math.cos(a),Math.sin(a),0], 0, 'forced-bipolar'));
  }
  const notesLocal = [];
  if (Math.random() < 0.65){
    const i = Math.floor(Math.random()*cs.length);
    const theta = Math.random()*2*Math.PI;
    const p = pointOnCircle(cs[i], theta);
    const lambda = (Math.random()<0.5?-1:1)*randRange(0.5,1.3);
    const n2 = normalize(add(cs[i].n, scale(p,lambda)));
    const h2 = dot(n2,p);
    cs.push(makeCircle(n2,h2,'tangent'));
    notesLocal.push({p, label:'tangent pair (PC3-like)'});
  }
  if (Math.random() < 0.55){
    for (let tries=0; tries<12; tries++){
      const i = Math.floor(Math.random()*cs.length);
      const j = Math.floor(Math.random()*cs.length);
      if (i===j) continue;
      const res = circleIntersections(cs[i],cs[j]);
      if (res.pts.length>0){
        const p = pick(res.pts);
        const n3 = randUnit();
        const h3 = dot(n3,p);
        cs.push(makeCircle(n3,h3,'concurrent'));
        notesLocal.push({p, label:'concurrent point (PC4-like)'});
        break;
      }
    }
  }
  const highlightPair = pickHighlightCandidate(cs, rot);
  const anchorCount = Math.min(60, Math.max(6, Math.round(cs.length * 4)));
  const satelliteAnchors = generateSatelliteAnchors(cs, anchorCount);
  return {circles:cs, notes:notesLocal, highlightPair, satelliteAnchors};
}

function buildNetworkArrangement(sphereCount){
  const m = sphereCount;
  const spheres = [];
  for (let i=0;i<m;i++){
    spheres.push({ a:[randRange(-1.1,1.1), randRange(-1.1,1.1), randRange(-1.1,1.1)], r:randRange(0.85,1.5) });
  }
  let centroid = [0,0,0];
  spheres.forEach(s=>{ centroid = add(centroid, s.a); });
  centroid = scale(centroid, 1/spheres.length);

  const edges = [];
  const localCircles = spheres.map(()=>[]);
  for (let i=0;i<m;i++){
    for (let j=0;j<m;j++){
      if (i===j) continue;
      const d = norm(sub(spheres[j].a, spheres[i].a));
      const ri = spheres[i].r, rj = spheres[j].r;
      if (d < ri+rj && d > Math.abs(ri-rj) && d > 1e-6){
        const nLocal = normalize(sub(spheres[j].a, spheres[i].a));
        const hPhys = (ri*ri - rj*rj + d*d) / (2*d);
        const hLocal = hPhys / ri;
        if (Math.abs(hLocal) < 1){
          localCircles[i].push(makeCircle(nLocal, hLocal, 'nbr-'+j));
          if (i<j) edges.push({i,j});
        }
      }
    }
  }
  const vertexLists = localCircles.map(cl => computeVertexList(cl));
  const satelliteAnchorLists = localCircles.map(cl => {
    const anchorCount = Math.min(60, Math.max(6, Math.round(cl.length * 4)));
    return generateSatelliteAnchors(cl, anchorCount);
  });
  const NEAR_PARALLEL = 0.97;
  const allCandidates = [];
  vertexLists.forEach((vl,si)=>{
    vl.forEach((v)=>{
      const partner = vl.find(w => w!==v && w.i===v.i && w.j===v.j);
      const n1 = localCircles[si][v.i].n, n2 = localCircles[si][v.j].n;
      allCandidates.push({
        si, i:v.i, j:v.j, p1:v.p3, p2: partner?partner.p3:null,
        tangent: v.tangent, nearParallel: Math.abs(dot(n1,n2)) >= NEAR_PARALLEL,
        z: rot(v.p3)[2]
      });
    });
  });
  const stable = allCandidates.filter(c => !c.tangent && !c.nearParallel);
  const base = stable.length ? stable : allCandidates;
  const tierA = base.filter(c => {
    const info = circlePairInfo(localCircles[c.si][c.i], localCircles[c.si][c.j]);
    return c.z >= 0.6 && info.disc > FADE_EPS*3;
  });
  const tierB = base.filter(c => c.z >= 0.3);
  let pool = tierA.length ? tierA : (tierB.length ? tierB : base);
  for (let k=pool.length-1;k>0;k--){
    const j = Math.floor(Math.random()*(k+1));
    [pool[k],pool[j]] = [pool[j],pool[k]];
  }
  const highlightPairs = pool.slice(0, Math.min(4, pool.length));
  highlightPairs.forEach(h=>{
    const info = circlePairInfo(localCircles[h.si][h.i], localCircles[h.si][h.j]);
    h.opacity = smoothstep(-FADE_EPS, FADE_EPS, info.disc);
  });
  return {spheres, localCircles, edges, centroid, highlightPairs, satelliteAnchorLists};
}

function renderNetworkInBox(ctx, data, boxCx, boxCy, boxHalfW, boxHalfH, opts){
  opts = opts || {};
  const rotateFn = opts.rotate || rot;
  const rotatedCenters = data.spheres.map(s => add(data.centroid, rotateFn(sub(s.a, data.centroid))));
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  rotatedCenters.forEach((c,i)=>{
    const r = data.spheres[i].r;
    minX = Math.min(minX, c[0]-r); maxX = Math.max(maxX, c[0]+r);
    minY = Math.min(minY, c[1]-r); maxY = Math.max(maxY, c[1]+r);
  });
  const pad = opts.pad != null ? opts.pad : 24;
  const sc = Math.min((2*boxHalfW-2*pad)/(maxX-minX), (2*boxHalfH-2*pad)/(maxY-minY)) * (opts.zoom||1);
  const offX = boxCx - sc*(minX+maxX)/2;
  const offY = boxCy - sc*(minY+maxY)/2;
  const layout = rotatedCenters.map((c,i)=>({
    x: offX + sc*c[0], y: offY + sc*c[1], r: sc*data.spheres[i].r, z: c[2]
  }));

  for (const e of data.edges){
    const A = layout[e.i], B = layout[e.j];
    ctx.layer = 'edges';
    ctx.beginPath();
    ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y);
    ctx.strokeStyle = dashColor(inkA(0.62));
    ctx.lineWidth = LW(1.3);
    ctx.setLineDash(dotDash(4.5));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const totals = {singular:0, tangent:0, threaded:0, polar:0, bipolar:0};
  const order = layout.map((L,i)=>i).sort((a,b)=> layout[a].z - layout[b].z);
  for (const i of order){
    const L = layout[i];
    const hpairs = flagSatellites ? [] : data.highlightPairs.filter(h=>h.si===i);
    const res = renderSphereView(ctx, L.x, L.y, L.r, data.localCircles[i], {
      showMeridian:false, arcSamples:opts.arcSamples||150, rotate:rotateFn,
      showPlanes:flagPlanes, showNormals:flagNormals, planeDensity:ctrlPlaneDensity,
      showLabels:opts.showLabels!==false, showVertexLabels:opts.showVertexLabels!==false,
      satellites:flagSatellites, satelliteDensity:ctrlSatelliteDensity,
      highlightPairs:hpairs, satelliteAnchors:data.satelliteAnchorLists[i],
      label: opts.showLabels!==false ? ('S'+i) : null,
      labelSize:opts.labelSize||11, dotR:opts.dotR||1.6, labelFontSize:opts.labelFontSize||8.5,
      highlightColor: data.cellColor
    });
    totals.singular += res.totalSingular;
    totals.tangent += res.tangentPairs;
    totals.threaded += res.typeCounts.threaded;
    totals.polar += res.typeCounts['north-polar']+res.typeCounts['south-polar'];
    totals.bipolar += res.typeCounts.bipolar;
  }
  return totals;
}

let CW = 640, CH = 640;
let cx = 320, cy = 320, baseR = 250;
function recomputeDerivedSizes(){
  cx = CW/2; cy = CH/2;
  baseR = Math.min(CW,CH)*0.39;
}
let circles = [], notes = [], singleHighlightPair = null, singleSatelliteAnchors = [];

function generateSingle(){
  const d = buildSingleArrangement(ctrlCircleCount);
  circles = d.circles; notes = d.notes;
  singleHighlightPair = d.highlightPair;
  singleSatelliteAnchors = d.satelliteAnchors;
}

let staticAngle = 0;

function drawSingle(ctx){
  ctx.clearRect(0,0,CW,CH);
  ctx.layer = 'background'; ctx.fillStyle = PAPER; ctx.fillRect(0,0,CW,CH);
  ctx.lineCap = 'round';

  const R = baseR * zoomLevel;
  const highlightPairs = (!flagSatellites && singleHighlightPair) ? [singleHighlightPair] : [];
  const result = renderSphereView(ctx, cx, cy, R, circles, {
    showMeridian:true, meridianAngle:staticAngle, label:'S\u2080', rotate:rot,
    showPlanes:flagPlanes, showNormals:flagNormals, planeDensity:ctrlPlaneDensity,
    showLabels:flagCircleLabels, showVertexLabels:flagVertexLabels,
    satellites:flagSatellites, satelliteDensity:ctrlSatelliteDensity,
    highlightPairs, satelliteAnchors:singleSatelliteAnchors
  });

  for (const note of notes){
    const p3 = rot(note.p);
    if (p3[2] < 0) continue;
    const scr = proj(cx,cy,R,p3);
    ctx.layer = 'notes';
    ctx.beginPath();
    ctx.arc(scr[0],scr[1],4.2,0,2*Math.PI);
    ctx.strokeStyle = dashColor(INK);
    ctx.lineWidth = LW(1.3);
    ctx.setLineDash(dotDash(4));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (planePoints.length){
    const pts = planePoints.map(a => [cx + R*Math.cos(a), cy - R*Math.sin(a)]);
    ctx.layer = 'userplane';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k=1;k<pts.length;k++) ctx.lineTo(pts[k][0], pts[k][1]);
    if (pts.length >= 3) ctx.closePath();
    ctx.strokeStyle = INK;
    ctx.lineWidth = LW(1.2);
    ctx.setLineDash([]);
    ctx.stroke();
    for (const p of pts){
      ctx.beginPath();
      ctx.arc(p[0],p[1],3,0,2*Math.PI);
      ctx.fillStyle = INK;
      ctx.fill();
    }
  }

  document.getElementById('stats').textContent =
`circles (n)         : ${circles.length}
  normal            : ${result.typeCounts.normal}
  threaded          : ${result.typeCounts.threaded}
  polar (N/S)       : ${result.typeCounts['north-polar']+result.typeCounts['south-polar']}
  bipolar           : ${result.typeCounts.bipolar}
singular points (P1): ${result.totalSingular}
tangent pairs (P2)  : ${result.tangentPairs}`;

  document.getElementById('legend').innerHTML =
    notes.map(n => '&middot; ' + n.label).join('<br>') || '&middot; no forced degeneracies this round';
}

let netData = null;

function generateNetwork(){
  netData = buildNetworkArrangement(ctrlSphereCount);
}

function drawNetwork(ctx){
  ctx.clearRect(0,0,CW,CH);
  ctx.layer = 'background'; ctx.fillStyle = PAPER; ctx.fillRect(0,0,CW,CH);
  ctx.lineCap = 'round';
  const totals = renderNetworkInBox(ctx, netData, cx, cy, CW*0.47, CH*0.47, {
    arcSamples:150, showLabels:flagCircleLabels, showVertexLabels:flagVertexLabels, zoom:zoomLevel
  });

  document.getElementById('stats').textContent =
`spheres (m)          : ${netData.spheres.length}
contacts (edges)     : ${netData.edges.length}
neighbor counts       : ${netData.localCircles.map(l=>l.length).join(', ')}
singular pts, all Si  : ${totals.singular}
tangent pairs, all Si : ${totals.tangent}
threaded circles      : ${totals.threaded}
polar / bipolar       : ${totals.polar} / ${totals.bipolar}`;

  document.getElementById('legend').innerHTML =
    'Circle labels read "C\u2192S<i>k</i>": this sphere\u2019s intersection circle with neighbor S<i>k</i>. Dotted lines are the contact graph.';
}

let gridData = [];

function generateGrid(){
  const n = ctrlGridSize * ctrlGridSize;
  gridData = [];
  const circleMax = Math.max(3, Math.min(ctrlCircleCount, 8));
  const sphereMax = Math.max(4, Math.min(ctrlSphereCount, 8));
  for (let k=0;k<n;k++){
    const cellCircleCount = flagRandomGrid
      ? Math.floor(randRange(3, circleMax + 1))
      : circleMax;
    const cellSphereCount = flagRandomGrid
      ? Math.floor(randRange(4, sphereMax + 1))
      : sphereMax;
    const d = (gridContentMode === 'single')
      ? buildSingleArrangement(cellCircleCount)
      : buildNetworkArrangement(cellSphereCount);
    d.spinYaw = 0;
    d.spinPitch = 0;
    d.spinSpeedYaw = randRange(0.003, 0.01) * (Math.random()<0.5?-1:1);
    d.spinSpeedPitch = randRange(-0.002, 0.002);
    if (flagRandomGrid){
      const cellColor = pick(HIGHLIGHT_PALETTE);
      d.cellColor = cellColor;
      if (d.highlightPair) d.highlightPair.color = cellColor;
      if (d.highlightPairs) d.highlightPairs.forEach(hp => { hp.color = cellColor; });
    }
    gridData.push(d);
  }
}

function cellRotateFn(d){
  return (p) => rotate3D(rotate3D(p, d.spinYaw, d.spinPitch), viewYaw, viewPitch);
}

function drawGrid(ctx){
  ctx.clearRect(0,0,CW,CH);
  ctx.layer = 'background'; ctx.fillStyle = PAPER; ctx.fillRect(0,0,CW,CH);
  ctx.lineCap = 'round';
  const n = ctrlGridSize;
  const cellW = CW/n, cellH = CH/n;
  for (let idx=0; idx<gridData.length; idx++){
    const row = Math.floor(idx/n), col = idx % n;
    const boxCx = col*cellW + cellW/2;
    const boxCy = row*cellH + cellH/2;
    const halfSize = Math.min(cellW,cellH)/2 - 8;
    if (gridContentMode === 'single'){
      const d = gridData[idx];
      const hpairs = (!flagSatellites && d.highlightPair) ? [d.highlightPair] : [];
      renderSphereView(ctx, boxCx, boxCy, halfSize*zoomLevel, d.circles, {
        showMeridian:false, arcSamples:80, rotate:cellRotateFn(d),
        showPlanes:flagPlanes, showNormals:flagNormals, planeDensity:ctrlPlaneDensity,
        showLabels:flagCircleLabels, showVertexLabels:flagVertexLabels,
        satellites:flagSatellites, satelliteDensity:ctrlSatelliteDensity,
        highlightPairs:hpairs, satelliteAnchors:d.satelliteAnchors, dotR:1.3, highlightColor:d.cellColor
      });
    } else {
      renderNetworkInBox(ctx, gridData[idx], boxCx, boxCy, halfSize, halfSize, {
        arcSamples:60, showLabels:flagCircleLabels, showVertexLabels:flagVertexLabels,
        pad:6, dotR:1.0, zoom:zoomLevel, rotate:cellRotateFn(gridData[idx])
      });
    }
  }
  document.getElementById('stats').textContent =
`grid                 : ${n}\u00d7${n} = ${gridData.length} arrangements
content               : ${gridContentMode}`;
  document.getElementById('legend').innerHTML =
    'Each cell is an independent random arrangement, freshly generated.';
}

let mainCtx = null;
function computeCanvasSize(){
  const margin = 48;
  const availH = window.innerHeight - margin;
  const availW = window.innerWidth - 300 - 24 - 32;
  if (ctrlAspect === '16:9'){
    let w = availW, h = Math.round(w*9/16);
    if (h > availH){ h = availH; w = Math.round(h*16/9); }
    w = Math.max(360, w); h = Math.max(203, h);
    return {w: Math.floor(w), h: Math.floor(h)};
  }
  const s = Math.max(360, Math.floor(Math.min(availH, availW)));
  return {w:s, h:s};
}

function setupCanvas(){
  const canvas = document.getElementById('base');
  const dpr = window.devicePixelRatio || 1;
  const size = computeCanvasSize();
  CW = size.w; CH = size.h;
  recomputeDerivedSizes();
  canvas.style.width = CW + 'px';
  canvas.style.height = CH + 'px';
  canvas.width = Math.round(CW*dpr);
  canvas.height = Math.round(CH*dpr);
  document.getElementById('stage').style.width = CW + 'px';
  document.getElementById('stage').style.height = CH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  mainCtx = ctx;
}

let resizeTimer = null;
window.addEventListener('resize', ()=>{
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(()=>{ setupCanvas(); redraw(); }, 120);
});

class SVGRecorder {
  constructor(){
    this.layerBuckets = {};
    this.layer = 'misc';
    this.filterDefs = {};
    this._filter = 'none';
    this._path = [];
    this._strokeStyle = '#000';
    this._fillStyle = '#000';
    this._lineWidth = 1;
    this._dash = [];
    this._font = "10px 'Test Pitch', Georgia, serif";
    this._fontSize = 10;
  }
  set filter(v){ this._filter = v || 'none'; }
  get filter(){ return this._filter; }
  _filterAttr(){
    if (!this._filter || this._filter === 'none') return '';
    const m = /blur\(([\d.]+)px\)/.exec(this._filter);
    if (!m) return '';
    const std = m[1];
    if (!this.filterDefs[std]) this.filterDefs[std] = `blur${Object.keys(this.filterDefs).length}`;
    return ` filter="url(#${this.filterDefs[std]})"`;
  }
  _push(str){
    if (!this.layerBuckets[this.layer]) this.layerBuckets[this.layer] = [];
    this.layerBuckets[this.layer].push(str);
  }
  set strokeStyle(v){ this._strokeStyle = v; }
  get strokeStyle(){ return this._strokeStyle; }
  set fillStyle(v){ this._fillStyle = v; }
  get fillStyle(){ return this._fillStyle; }
  set lineWidth(v){ this._lineWidth = v; }
  get lineWidth(){ return this._lineWidth; }
  set lineCap(v){ this._lineCap = v; }
  get lineCap(){ return this._lineCap || 'butt'; }
  set font(v){
    this._font = v;
    const m = /([\d.]+)px/.exec(v);
    this._fontSize = m ? parseFloat(m[1]) : 10;
  }
  get font(){ return this._font; }
  setTransform(){ }
  setLineDash(arr){ this._dash = arr || []; }
  beginPath(){ this._path = []; }
  moveTo(x,y){ this._path.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`); }
  lineTo(x,y){ this._path.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`); }
  closePath(){ this._path.push('Z'); }
  arc(x,y,r,a0,a1){
    const x0 = x-r, x1 = x+r;
    this._path.push(`M ${x0.toFixed(2)} ${y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${x1.toFixed(2)} ${y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${x0.toFixed(2)} ${y.toFixed(2)}`);
  }
  _dashAttr(){ return this._dash.length ? ` stroke-dasharray="${this._dash.join(',')}"` : ''; }
  stroke(){
    if (!this._path.length) return;
    this._push(`<path d="${this._path.join(' ')}" fill="none" stroke="${this._strokeStyle}" stroke-width="${this._lineWidth}" stroke-linecap="${this.lineCap}"${this._dashAttr()} />`);
  }
  fill(){
    if (!this._path.length) return;
    this._push(`<path d="${this._path.join(' ')}" fill="${this._fillStyle}" stroke="none"${this._filterAttr()} />`);
  }
  fillRect(x,y,w,h){
    this._push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${this._fillStyle}" />`);
  }
  clearRect(){ }
  fillText(text,x,y){
    const esc = String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    this._push(`<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-family="'Test Pitch', Georgia, 'Times New Roman', serif" font-size="${this._fontSize}" fill="${this._fillStyle}">${esc}</text>`);
  }
}

function downloadBlob(filename, data, mime){
  const blob = new Blob([data], {type:mime});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = filename;
  link.href = url;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(()=> URL.revokeObjectURL(url), 1000);
}

function exportPNG(){
  const canvas = document.getElementById('base');
  const link = document.createElement('a');
  link.download = 'circle-arrangement.png';
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportSVG(){
  const rec = new SVGRecorder();
  renderSceneToContext(rec);
  const layerOrder = [
    'background', 'fills', 'outline', 'arcs', 'centerlines', 'planes',
    'normals', 'edges', 'notes', 'userplane', 'vertices', 'labels', 'misc'
  ];
  const seen = new Set();
  const groups = [];
  for (const name of layerOrder){
    const els = rec.layerBuckets[name];
    if (els && els.length){
      seen.add(name);
      groups.push(`  <g id="${name}">\n    ${els.join('\n    ')}\n  </g>`);
    }
  }
  for (const name of Object.keys(rec.layerBuckets)){
    if (seen.has(name)) continue;
    const els = rec.layerBuckets[name];
    if (els && els.length) groups.push(`  <g id="${name}">\n    ${els.join('\n    ')}\n  </g>`);
  }
  const defsParts = Object.entries(rec.filterDefs).map(([std,id]) =>
    `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${std}" /></filter>`
  );
  const defs = defsParts.length ? `  <defs>\n    ${defsParts.join('\n    ')}\n  </defs>\n` : '';
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}" width="${CW}" height="${CH}">
${defs}${groups.join('\n')}
</svg>`;
  downloadBlob('circle-arrangement.svg', svg, 'image/svg+xml');
}

function renderSceneToContext(ctx){
  if (sceneMode === 'single') drawSingle(ctx);
  else if (sceneMode === 'network') drawNetwork(ctx);
  else drawGrid(ctx);
}

function redraw(){
  renderSceneToContext(mainCtx);
}

function regen(){
  if (sceneMode === 'single'){ staticAngle = Math.random()*2*Math.PI; generateSingle(); }
  else if (sceneMode === 'network'){ generateNetwork(); }
  else { generateGrid(); }
  redraw();
}

let flagAutoRotate = false;
let autoRotateHandle = null;

const FADE_EPS = 0.15;

function pickHighlightCandidate(circleList, rotateFn){
  rotateFn = rotateFn || rot;
  const vl = computeVertexList(circleList);
  if (!vl.length) return null;
  const NEAR_PARALLEL = 0.97;
  const stable = vl.map((v,i)=>i).filter(i =>
    !vl[i].tangent && Math.abs(dot(circleList[vl[i].i].n, circleList[vl[i].j].n)) < NEAR_PARALLEL
  );
  const baseIdxs = stable.length ? stable : vl.map((v,i)=>i);
  const ranked = baseIdxs.slice().sort((a,b) => rotateFn(vl[b].p3)[2] - rotateFn(vl[a].p3)[2]);
  const topCount = Math.max(1, Math.min(3, ranked.length));
  const chosenIdx = ranked[Math.floor(Math.random()*topCount)];
  const chosen = vl[chosenIdx];
  const partner = vl.find(w => w!==chosen && w.i===chosen.i && w.j===chosen.j);
  const info = circlePairInfo(circleList[chosen.i], circleList[chosen.j]);
  const initialOpacity = smoothstep(-FADE_EPS, FADE_EPS, info.disc);
  return {i:chosen.i, j:chosen.j, opacity:initialOpacity, p1:chosen.p3, p2: partner?partner.p3:null};
}

const MAX_INVISIBLE_MS = 500;

function effectiveVisibility(pairObj, rotateFn){
  if (!pairObj || !pairObj.p1) return 0;
  const z = rotateFn(pairObj.p1)[2];
  const depthFade = smoothstep(-HORIZON_EPS, HORIZON_EPS, z);
  return pairObj.opacity * depthFade;
}

function updatePairOpacity(circleListForPair, pairObj, rotateFn, now){
  if (!pairObj) return;
  const c1 = circleListForPair[pairObj.i], c2 = circleListForPair[pairObj.j];
  if (!c1 || !c2){ pairObj.opacity = 0; return; }
  const info = circlePairInfo(c1,c2);
  const target = smoothstep(-FADE_EPS, FADE_EPS, info.disc);
  pairObj.opacity += (target - pairObj.opacity) * 0.18;
  if (info.p1){ pairObj.p1 = info.p1; pairObj.p2 = info.p2; }

  const visible = effectiveVisibility(pairObj, rotateFn || rot) > 0.05;
  if (visible){
    pairObj.invisibleSince = null;
  } else {
    if (pairObj.invisibleSince == null) pairObj.invisibleSince = now;
    else if (now - pairObj.invisibleSince > MAX_INVISIBLE_MS){
      const fresh = pickHighlightCandidate(circleListForPair, rotateFn || rot);
      if (fresh){
        pairObj.i = fresh.i; pairObj.j = fresh.j;
        pairObj.p1 = fresh.p1; pairObj.p2 = fresh.p2;
        pairObj.opacity = 0; // always fade in from nothing, never pop to the target value
        pairObj.invisibleSince = null;
      }
    }
  }
}

function animationTick(){
  if (!flagAutoRotate) return;
  const dt = ctrlRotateSpeed;
  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  viewYaw += 0.0035 * dt;

  if (sceneMode === 'single'){
    if (flagCircleSpin) circles.forEach(c => advanceCircleSpin(c, dt));
    if (!singleHighlightPair){
      singleHighlightPair = pickHighlightCandidate(circles, rot);
      if (singleHighlightPair) singleHighlightPair.opacity = 0;
    }
    updatePairOpacity(circles, singleHighlightPair, rot, now);
  } else if (sceneMode === 'network'){
    if (flagCircleSpin) netData.localCircles.forEach(cl => cl.forEach(c => advanceCircleSpin(c, dt)));
    for (let si=0; si<netData.localCircles.length; si++){
      if (!netData.highlightPairs.some(hp => hp.si === si)){
        const cand = pickHighlightCandidate(netData.localCircles[si], rot);
        if (cand){ cand.si = si; cand.opacity = 0; netData.highlightPairs.push(cand); }
      }
    }
    netData.highlightPairs.forEach(hp => updatePairOpacity(netData.localCircles[hp.si], hp, rot, now));
  } else if (sceneMode === 'grid'){
    gridData.forEach(d=>{
      d.spinYaw += d.spinSpeedYaw * dt;
      d.spinPitch += d.spinSpeedPitch * dt;
      const rfn = cellRotateFn(d);
      if (gridContentMode === 'single'){
        if (flagCircleSpin) d.circles.forEach(c => advanceCircleSpin(c, dt));
        if (!d.highlightPair){
          d.highlightPair = pickHighlightCandidate(d.circles, rfn);
          if (d.highlightPair){
            d.highlightPair.opacity = 0;
            if (d.cellColor) d.highlightPair.color = d.cellColor;
          }
        }
        updatePairOpacity(d.circles, d.highlightPair, rfn, now);
      } else {
        if (flagCircleSpin) d.localCircles.forEach(cl => cl.forEach(c => advanceCircleSpin(c, dt)));
        for (let si=0; si<d.localCircles.length; si++){
          if (!d.highlightPairs.some(hp => hp.si === si)){
            const cand = pickHighlightCandidate(d.localCircles[si], rfn);
            if (cand){
              cand.si = si;
              cand.opacity = 0;
              if (d.cellColor) cand.color = d.cellColor;
              d.highlightPairs.push(cand);
            }
          }
        }
        d.highlightPairs.forEach(hp => updatePairOpacity(d.localCircles[hp.si], hp, rfn, now));
      }
    });
  }

  redraw();
  autoRotateHandle = requestAnimationFrame(animationTick);
}

function setAutoRotate(on){
  flagAutoRotate = on;
  if (flagAutoRotate){
    if (autoRotateHandle) cancelAnimationFrame(autoRotateHandle);
    autoRotateHandle = requestAnimationFrame(animationTick);
  } else if (autoRotateHandle){
    cancelAnimationFrame(autoRotateHandle);
    autoRotateHandle = null;
  }
}

const modeOrder = ['single','network','grid'];
const modeLabels = {single:'Switch to sphere network', network:'Switch to grid view', grid:'Switch to single-sphere view'};

function updateControlAvailability(){
  const circleActive = (sceneMode==='single') || (sceneMode==='grid' && gridContentMode==='single');
  const sphereActive = (sceneMode==='network') || (sceneMode==='grid' && gridContentMode==='network');
  const gridActive = (sceneMode==='grid');
  document.getElementById('sliderCircleCount').disabled = !circleActive;
  document.getElementById('sliderSphereCount').disabled = !sphereActive;
  document.getElementById('sliderGridSize').disabled = !gridActive;
  document.getElementById('gridcontentbtn').disabled = !gridActive;
}

document.getElementById('regen').addEventListener('click', regen);
document.getElementById('modebtn').addEventListener('click', ()=>{
  const idx = modeOrder.indexOf(sceneMode);
  sceneMode = modeOrder[(idx+1)%modeOrder.length];
  document.getElementById('modebtn').textContent = modeLabels[sceneMode];
  updateControlAvailability();
  regen();
});
document.getElementById('gridcontentbtn').addEventListener('click', ()=>{
  gridContentMode = (gridContentMode === 'single') ? 'network' : 'single';
  document.getElementById('gridcontentbtn').textContent = 'Grid content: '+gridContentMode;
  updateControlAvailability();
  if (sceneMode === 'grid'){ generateGrid(); redraw(); }
});
document.getElementById('randomgridbtn').addEventListener('click', ()=>{
  flagRandomGrid = !flagRandomGrid;
  document.getElementById('randomgridbtn').textContent =
    flagRandomGrid ? 'Random grid: on' : 'Random grid: off';
  if (sceneMode === 'grid'){ generateGrid(); redraw(); }
});
document.getElementById('planesbtn').addEventListener('click', ()=>{
  flagPlanes = !flagPlanes;
  document.getElementById('planesbtn').textContent = flagPlanes ? 'Hide radical planes' : 'Show radical planes';
  redraw();
});
document.getElementById('normalsbtn').addEventListener('click', ()=>{
  flagNormals = !flagNormals;
  document.getElementById('normalsbtn').textContent = flagNormals ? 'Hide normal vectors' : 'Show normal vectors';
  redraw();
});
document.getElementById('satbtn').addEventListener('click', ()=>{
  flagSatellites = !flagSatellites;
  document.getElementById('satbtn').textContent = flagSatellites ? 'Hide satellite spheres' : 'Show satellite spheres';
  redraw();
});
document.getElementById('circlabelbtn').addEventListener('click', ()=>{
  flagCircleLabels = !flagCircleLabels;
  document.getElementById('circlabelbtn').textContent = flagCircleLabels ? 'Hide circle labels' : 'Show circle labels';
  redraw();
});
document.getElementById('vertlabelbtn').addEventListener('click', ()=>{
  flagVertexLabels = !flagVertexLabels;
  document.getElementById('vertlabelbtn').textContent = flagVertexLabels ? 'Hide vertex labels' : 'Show vertex labels';
  redraw();
});
document.getElementById('sliderCircleCount').addEventListener('input', (e)=>{
  ctrlCircleCount = parseInt(e.target.value,10);
  document.getElementById('lblCircleCount').textContent = ctrlCircleCount;
  if (sceneMode==='single'){ generateSingle(); redraw(); }
  else if (sceneMode==='grid' && gridContentMode==='single'){ generateGrid(); redraw(); }
});
document.getElementById('sliderSphereCount').addEventListener('input', (e)=>{
  ctrlSphereCount = parseInt(e.target.value,10);
  document.getElementById('lblSphereCount').textContent = ctrlSphereCount;
  if (sceneMode==='network'){ generateNetwork(); redraw(); }
  else if (sceneMode==='grid' && gridContentMode==='network'){ generateGrid(); redraw(); }
});
document.getElementById('sliderGridSize').addEventListener('input', (e)=>{
  ctrlGridSize = parseInt(e.target.value,10);
  document.getElementById('lblGridSize').textContent = ctrlGridSize+'\u00d7'+ctrlGridSize;
  if (sceneMode==='grid'){ generateGrid(); redraw(); }
});
document.getElementById('sliderPlaneDensity').addEventListener('input', (e)=>{
  const pct = parseInt(e.target.value,10);
  ctrlPlaneDensity = pct/100;
  document.getElementById('lblPlaneDensity').textContent = pct+'%';
  redraw();
});
document.getElementById('sliderSatDensity').addEventListener('input', (e)=>{
  const pct = parseInt(e.target.value,10);
  ctrlSatelliteDensity = pct/100;
  document.getElementById('lblSatDensity').textContent = pct+'%';
  redraw();
});
document.getElementById('sliderSatScale').addEventListener('input', (e)=>{
  const pct = parseInt(e.target.value,10);
  ctrlSatelliteScale = pct/100;
  document.getElementById('lblSatScale').textContent = pct+'%';
  redraw();
});
document.getElementById('sliderStrokeWidth').addEventListener('input', (e)=>{
  const pct = parseInt(e.target.value,10);
  ctrlStrokeScale = pct/100;
  document.getElementById('lblStrokeWidth').textContent = pct+'%';
  redraw();
});
document.getElementById('sliderRotateSpeed').addEventListener('input', (e)=>{
  const pct = parseInt(e.target.value,10);
  ctrlRotateSpeed = pct/100;
  document.getElementById('lblRotateSpeed').textContent = pct+'%';
});
document.getElementById('sliderVertexSize').addEventListener('input', (e)=>{
  const pct = parseInt(e.target.value,10);
  ctrlVertexSize = pct/100;
  document.getElementById('lblVertexSize').textContent = pct+'%';
  redraw();
});
document.getElementById('circlespinbtn').addEventListener('click', ()=>{
  flagCircleSpin = !flagCircleSpin;
  document.getElementById('circlespinbtn').textContent =
    flagCircleSpin ? 'Freeze circle rotation' : 'Circles spin independently';
});
document.getElementById('aspectbtn').addEventListener('click', ()=>{
  ctrlAspect = (ctrlAspect === 'square') ? '16:9' : 'square';
  document.getElementById('aspectbtn').textContent =
    ctrlAspect === '16:9' ? 'Canvas: square' : 'Canvas: 16:9';
  setupCanvas();
  redraw();
});
document.getElementById('blurbtn').addEventListener('click', ()=>{
  flagBlurFills = !flagBlurFills;
  document.getElementById('blurbtn').textContent =
    flagBlurFills ? 'Hide blur' : 'Blur intersection fills';
  redraw();
});
document.getElementById('sliderBlurAmount').addEventListener('input', (e)=>{
  const pct = parseInt(e.target.value,10);
  ctrlBlurAmount = pct/100;
  document.getElementById('lblBlurAmount').textContent = pct+'%';
  redraw();
});
document.getElementById('zoomIn').addEventListener('click', ()=>{ zoomLevel = Math.min(4, zoomLevel*1.2); redraw(); });
document.getElementById('zoomOut').addEventListener('click', ()=>{ zoomLevel = Math.max(0.3, zoomLevel/1.2); redraw(); });
document.getElementById('autorotatebtn').addEventListener('click', ()=>{
  setAutoRotate(!flagAutoRotate);
  document.getElementById('autorotatebtn').textContent =
    flagAutoRotate ? 'Stop rotation' : 'Start rotation';
});

const stage = document.getElementById('stage');
let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0;
let planeDrawMode = false;
let planePoints = [];

function pointerDown(x,y){
  dragging = true; lastX = x; lastY = y; downX = x; downY = y; stage.classList.add('dragging');
  if (flagAutoRotate){
    setAutoRotate(false);
    document.getElementById('autorotatebtn').textContent = 'Start rotation';
  }
}
function pointerMove(x,y){
  if (!dragging) return;
  const dx = x - lastX, dy = y - lastY;
  viewYaw += dx * 0.01;
  viewPitch += dy * 0.01;
  viewPitch = Math.max(-1.5, Math.min(1.5, viewPitch));
  lastX = x; lastY = y;
  redraw();
}
function pointerUp(){
  dragging = false;
  stage.classList.remove('dragging');
  if (planeDrawMode && sceneMode==='single'){
    const moved = Math.hypot(lastX-downX, lastY-downY);
    if (moved < 5) addPlanePointAtClient(lastX, lastY);
  }
}
function addPlanePointAtClient(clientX, clientY){
  const rect = document.getElementById('base').getBoundingClientRect();
  const px = clientX - rect.left, py = clientY - rect.top;
  const angle = Math.atan2(cy-py, px-cx);
  planePoints.push(angle);
  redraw();
}

stage.addEventListener('mousedown', e=>pointerDown(e.clientX,e.clientY));
window.addEventListener('mousemove', e=>pointerMove(e.clientX,e.clientY));
window.addEventListener('mouseup', pointerUp);
stage.addEventListener('touchstart', e=>{ if (e.touches.length===1){ const t=e.touches[0]; pointerDown(t.clientX,t.clientY);} }, {passive:true});
stage.addEventListener('touchmove', e=>{ if (e.touches.length===1){ const t=e.touches[0]; pointerMove(t.clientX,t.clientY);} }, {passive:true});
stage.addEventListener('touchend', pointerUp);

stage.addEventListener('wheel', (e)=>{
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.08 : 1/1.08;
  zoomLevel = Math.max(0.3, Math.min(4, zoomLevel*factor));
  redraw();
}, {passive:false});

let pinchStartDist = null, pinchStartZoom = 1;
stage.addEventListener('touchstart', e=>{
  if (e.touches.length === 2){
    dragging = false;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    pinchStartDist = Math.sqrt(dx*dx+dy*dy);
    pinchStartZoom = zoomLevel;
  }
}, {passive:true});
stage.addEventListener('touchmove', e=>{
  if (e.touches.length === 2 && pinchStartDist){
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const d = Math.sqrt(dx*dx+dy*dy);
    zoomLevel = Math.max(0.3, Math.min(4, pinchStartZoom * (d/pinchStartDist)));
    redraw();
  }
}, {passive:true});
stage.addEventListener('touchend', ()=>{ pinchStartDist = null; });

document.getElementById('exportPngBtn').addEventListener('click', exportPNG);
document.getElementById('exportSvgBtn').addEventListener('click', exportSVG);
document.getElementById('drawplanebtn').addEventListener('click', ()=>{
  planeDrawMode = !planeDrawMode;
  document.getElementById('drawplanebtn').textContent =
    planeDrawMode ? 'Stop drawing plane' : 'Draw plane on S\u2080';
});
document.getElementById('clearplanebtn').addEventListener('click', ()=>{
  planePoints = [];
  redraw();
});
document.getElementById('solidlinesbtn').addEventListener('click', ()=>{
  flagSolidLines = !flagSolidLines;
  document.getElementById('solidlinesbtn').textContent =
    flagSolidLines ? 'Restore dotted lines' : 'Make dotted lines solid gray';
  redraw();
});
document.getElementById('hidecolorbtn').addEventListener('click', ()=>{
  flagShowIntersectionColor = !flagShowIntersectionColor;
  document.getElementById('hidecolorbtn').textContent =
    flagShowIntersectionColor ? 'Hide intersection colors' : 'Show intersection colors';
  redraw();
});
document.getElementById('centerlinesbtn').addEventListener('click', ()=>{
  flagCenterLines = !flagCenterLines;
  document.getElementById('centerlinesbtn').textContent =
    flagCenterLines ? 'Hide center lines' : 'Show center lines';
  redraw();
});
document.getElementById('sphereoutlinebtn').addEventListener('click', ()=>{
  flagShowSphereOutline = !flagShowSphereOutline;
  document.getElementById('sphereoutlinebtn').textContent =
    flagShowSphereOutline ? 'Hide sphere boundary' : 'Show sphere boundary';
  redraw();
});

setupCanvas();
updateControlAvailability();
regen();