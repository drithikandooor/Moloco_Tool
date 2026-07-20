let sceneMode = 'single';
let flagPlanes = false;
let flagNormals = false;
let flagCircleLabels = true;
let flagVertexLabels = true;
let flagSatellites = false;
let ctrlCircleCount = 6;
let ctrlSphereCount = 6;
let ctrlGridSize = 3;
let ctrlPlaneDensity = 0.4;
let ctrlSatelliteDensity = 0.6;
let ctrlStrokeScale = 0.6;
let gridContentMode = 'single';
let zoomLevel = 1;
const EPS = 6e-3;
const YELLOW = '#FFEF74';
const INK = '#5B4E49';
const PAPER = '#FDFDFC';
function inkA(a){ return `rgba(91,78,73,${a})`; }
function LW(base){ return base * ctrlStrokeScale; }

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

function makeCircle(n,h,tag){
  const [u,v] = basis(n);
  const rho = Math.sqrt(Math.max(0,1-h*h));
  const type = classifyCircle(n,h,rho);
  return {n,h,u,v,rho,tag,type};
}

function pointOnCircle(c, theta){
  const p1 = scale(c.n, c.h);
  const p2 = scale(c.u, c.rho*Math.cos(theta));
  const p3 = scale(c.v, c.rho*Math.sin(theta));
  return add(p1, add(p2,p3));
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

function proj(ocx,ocy,oR,p3){ return [ocx + p3[0]*oR, ocy - p3[1]*oR]; }

function labelFor(c, idx){
  if (!c.tag) return 'C'+idx;
  if (c.tag.indexOf('nbr-')===0) return 'C\u2192S'+c.tag.slice(4);
  const map = {tangent:'C'+idx+' (tangent)', concurrent:'C'+idx+' (concurrent)',
    'forced-polar':'C'+idx+' (polar)', 'forced-bipolar':'C'+idx+' (bipolar)'};
  return map[c.tag] || ('C'+idx);
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
// Fills the true lens between two circles using both of their real intersection
// points -- the actual overlap area, not an arbitrary sliver.
function fillLensBetween(ctx, ocx,ocy,oR, rotFn, c1, c2, p1, p2){
  const segs = 24;
  const t1a = thetaOf(c1,p1), t1b = thetaOf(c1,p2);
  const t2a = thetaOf(c2,p1), t2b = thetaOf(c2,p2);
  const arc1 = shortArcThetas(t1a,t1b,segs).map(t=>pointOnCircle(c1,t));
  const arc2 = shortArcThetas(t2b,t2a,segs).map(t=>pointOnCircle(c2,t));
  const scr = arc1.concat(arc2).map(p => proj(ocx,ocy,oR, rotFn(p)));
  ctx.beginPath();
  ctx.moveTo(scr[0][0],scr[0][1]);
  for (let k=1;k<scr.length;k++) ctx.lineTo(scr[k][0],scr[k][1]);
  ctx.closePath();
  ctx.fillStyle = YELLOW;
  ctx.fill();
}
function fillTangentSpot(ctx, ocx,ocy,oR, rotFn, p3){
  const scr = proj(ocx,ocy,oR, rotFn(p3));
  ctx.beginPath();
  ctx.arc(scr[0],scr[1], oR*0.035, 0, 2*Math.PI);
  ctx.fillStyle = YELLOW;
  ctx.fill();
}

// ---- Shared renderer: draws ONE sphere's full circle arrangement ----
function renderSphereView(ctx, ocx, ocy, oR, circleList, opts){
  opts = opts || {};
  const rotFn = opts.rotate || (p=>p);
  const vertexList = opts.vertexList || [];
  const highlightSet = opts.highlightSet || new Set();

  // Highlight fills first -- bottom layer.
  vertexList.forEach((v, vi) => {
    if (!highlightSet.has(vi)) return;
    const p3 = rotFn(v.p3);
    if (p3[2] < 0) return;
    const partner = vertexList.find((w,wi)=> wi!==vi && w.i===v.i && w.j===v.j);
    if (partner) fillLensBetween(ctx, ocx,ocy,oR, rotFn, circleList[v.i], circleList[v.j], v.p3, partner.p3);
    else fillTangentSpot(ctx, ocx,ocy,oR, rotFn, v.p3);
  });

  ctx.beginPath();
  ctx.arc(ocx,ocy,oR,0,2*Math.PI);
  ctx.strokeStyle = INK;
  ctx.lineWidth = LW(1.0);
  ctx.setLineDash([]);
  ctx.stroke();

  const N = opts.arcSamples || 220;
  const typeCounts = {normal:0, threaded:0, 'north-polar':0, 'south-polar':0, bipolar:0};
  const labelPts = [];
  const planeCount = Math.round((opts.planeDensity != null ? opts.planeDensity : 1) * circleList.length);
  const satCount = Math.round((opts.satelliteDensity != null ? opts.satelliteDensity : 1) * vertexList.length);

  circleList.forEach((c, idx) => {
    typeCounts[c.type] = (typeCounts[c.type]||0) + 1;
    const isPolarish = (c.type==='north-polar' || c.type==='south-polar');
    let prev = null, prevZ = null;
    for (let k=0;k<=N;k++){
      const theta = (k/N)*2*Math.PI;
      const p3 = rotFn(pointOnCircle(c, theta));
      const scr = proj(ocx,ocy,oR,p3);
      if (prev){
        const visible = (p3[2] >= 0) && (prevZ >= 0);
        ctx.beginPath();
        ctx.moveTo(prev[0],prev[1]);
        ctx.lineTo(scr[0],scr[1]);
        ctx.strokeStyle = INK;
        ctx.lineWidth = LW(c.type==='bipolar' ? 1.1 : 0.7);
        if (!visible) ctx.setLineDash([1.3,2.6]);
        else if (c.type==='threaded') ctx.setLineDash([4.5,1.8,1,1.8]);
        else if (isPolarish) ctx.setLineDash([5.5,2.6]);
        else ctx.setLineDash([]);
        ctx.stroke();
      }
      prev = scr; prevZ = p3[2];
    }
    if (c.type === 'threaded' && opts.showThreadTicks !== false){
      const centerScr = proj(ocx,ocy,oR, rotFn(scale(c.n, c.h)));
      ctx.beginPath();
      ctx.moveTo(ocx,ocy);
      ctx.lineTo(centerScr[0], centerScr[1]);
      ctx.strokeStyle = inkA(0.4);
      ctx.lineWidth = LW(0.5);
      ctx.setLineDash([1,2]);
      ctx.stroke();
    }

    const wantPlane = opts.showPlanes && (idx < planeCount);
    const wantNormal = opts.showNormals;
    if (wantPlane || wantNormal){
      const foot = scale(c.n, c.h);
      if (wantPlane){
        const nearW = c.rho * 0.55, farW = c.rho * 1.5;
        const nearD = c.rho * 0.15, farD = c.rho * 2.6 + 0.5;
        const nearA = add(foot, add(scale(c.u,nearD), scale(c.v, nearW)));
        const farA  = add(foot, add(scale(c.u,farD),  scale(c.v, farW)));
        const farB  = add(foot, add(scale(c.u,farD),  scale(c.v,-farW)));
        const nearB = add(foot, add(scale(c.u,nearD), scale(c.v,-nearW)));
        const corners = [nearA, farA, farB, nearB].map(p => proj(ocx,ocy,oR, rotFn(p)));
        ctx.beginPath();
        ctx.moveTo(corners[0][0],corners[0][1]);
        for (let k=1;k<4;k++) ctx.lineTo(corners[k][0],corners[k][1]);
        ctx.closePath();
        ctx.strokeStyle = inkA(0.55);
        ctx.lineWidth = LW(0.5);
        ctx.setLineDash([]);
        ctx.stroke();
        const beyondA = add(foot, add(scale(c.u, farD*1.15), scale(c.v, farW*1.12)));
        const beyondB = add(foot, add(scale(c.u, farD*1.15), scale(c.v,-farW*1.12)));
        const beyondAScr = proj(ocx,ocy,oR, rotFn(beyondA));
        const beyondBScr = proj(ocx,ocy,oR, rotFn(beyondB));
        ctx.beginPath();
        ctx.moveTo(corners[1][0],corners[1][1]); ctx.lineTo(beyondAScr[0],beyondAScr[1]);
        ctx.moveTo(corners[2][0],corners[2][1]); ctx.lineTo(beyondBScr[0],beyondBScr[1]);
        ctx.setLineDash([1,3]);
        ctx.stroke();
        ctx.setLineDash([]);
        if (opts.showLabels !== false){
          ctx.font = '9px Georgia';
          ctx.fillStyle = INK;
          const midFarScr = proj(ocx,ocy,oR, rotFn(add(foot, scale(c.u, farD))));
          ctx.fillText('RF\u2080,'+idx, midFarScr[0]+3, midFarScr[1]-3);
        }
      }
      if (wantNormal){
        const tip = add(foot, scale(c.n, c.rho*0.9 + 0.4));
        const footScr = proj(ocx,ocy,oR, rotFn(foot));
        const tipScr = proj(ocx,ocy,oR, rotFn(tip));
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
          ctx.font = '9px Georgia';
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

  if (opts.showMeridian){
    ctx.beginPath();
    ctx.moveTo(ocx,ocy);
    ctx.lineTo(ocx + oR*Math.cos(opts.meridianAngle), ocy + oR*Math.sin(opts.meridianAngle));
    ctx.strokeStyle = inkA(0.45);
    ctx.lineWidth = LW(0.7);
    ctx.setLineDash([2,4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  let totalSingular = 0, tangentPairs = 0;
  vertexList.forEach(v=>{ if (v.tangent) tangentPairs++; });
  totalSingular = vertexList.length;

  vertexList.forEach((v, vi) => {
    const p3 = rotFn(v.p3);
    if (p3[2] < 0) return;
    const scr = proj(ocx,ocy,oR,p3);

    if (opts.satellites && (vi < satCount) && v.satCircles && v.satCircles.length){
      const satR = oR * v.satRFrac;
      const satHighlight = (v.satHighlight != null) ? new Set([v.satHighlight]) : new Set();
      renderSphereView(ctx, scr[0], scr[1], satR, v.satCircles, {
        rotate: rotFn, showMeridian:false, arcSamples:50,
        showLabels:false, showVertexLabels:false, satellites:false,
        vertexList: v.satVertices, highlightSet: satHighlight,
        dotR: Math.max(1, (opts.dotR||2.2)*0.55)
      });
    }

    ctx.beginPath();
    ctx.arc(scr[0],scr[1], opts.dotR || 2.2, 0,2*Math.PI);
    ctx.fillStyle = INK;
    ctx.fill();

    if (opts.showVertexLabels !== false){
      ctx.font = (opts.vertexLabelSize||9) + 'px Georgia';
      ctx.fillStyle = INK;
      ctx.fillText(letterLabel(vi), scr[0]+5, scr[1]-4);
    }
  });

  if (opts.showLabels !== false){
    ctx.font = (opts.labelFontSize||9.5) + 'px Georgia';
    ctx.fillStyle = INK;
    for (const lp of labelPts){
      const scr = proj(ocx,ocy,oR,lp.p3);
      const dx = scr[0]-ocx, dy = scr[1]-ocy;
      const m = Math.sqrt(dx*dx+dy*dy) || 1;
      ctx.fillText(lp.text, scr[0]+(dx/m)*9, scr[1]+(dy/m)*9);
    }
  }

  if (opts.label){
    ctx.font = (opts.labelSize||13) + 'px Georgia';
    ctx.fillStyle = INK;
    ctx.fillText(opts.label, ocx-6, ocy-oR-8);
  }

  return {typeCounts, totalSingular, tangentPairs};
}

// ---- Builders: pure data, reused by single mode, network mode, and grid cells ----
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
  const vl = computeVertexList(cs);
  attachSatelliteData(vl);
  const frontIdxs = vl.map((v,i)=>i).filter(i=> rot(vl[i].p3)[2] >= 0);
  const pool = frontIdxs.length ? frontIdxs : vl.map((v,i)=>i);
  const highlightIdx = pool.length ? pick(pool) : null;
  return {circles:cs, notes:notesLocal, vertexList:vl, highlightIdx};
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
  const vertexLists = localCircles.map(cl => {
    const vl = computeVertexList(cl);
    attachSatelliteData(vl);
    return vl;
  });
  const pool = [];
  vertexLists.forEach((vl,si)=>{ vl.forEach((v,vi)=>{ if (rot(v.p3)[2] >= 0) pool.push({si,vi}); }); });
  if (pool.length === 0) vertexLists.forEach((vl,si)=>{ vl.forEach((v,vi)=> pool.push({si,vi})); });
  for (let k=pool.length-1;k>0;k--){
    const j = Math.floor(Math.random()*(k+1));
    [pool[k],pool[j]] = [pool[j],pool[k]];
  }
  const highlights = pool.slice(0, Math.min(4, pool.length));
  return {spheres, localCircles, edges, centroid, vertexLists, highlights};
}

function renderNetworkInBox(ctx, data, boxCx, boxCy, boxHalfW, boxHalfH, opts){
  opts = opts || {};
  const rotatedCenters = data.spheres.map(s => add(data.centroid, rot(sub(s.a, data.centroid))));
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
    ctx.beginPath();
    ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y);
    ctx.strokeStyle = inkA(0.4);
    ctx.lineWidth = LW(0.5);
    ctx.setLineDash([2,3]);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const totals = {singular:0, tangent:0, threaded:0, polar:0, bipolar:0};
  const order = layout.map((L,i)=>i).sort((a,b)=> layout[a].z - layout[b].z);
  for (const i of order){
    const L = layout[i];
    const hset = flagSatellites ? new Set() : new Set(data.highlights.filter(h=>h.si===i).map(h=>h.vi));
    const res = renderSphereView(ctx, L.x, L.y, L.r, data.localCircles[i], {
      showMeridian:false, arcSamples:opts.arcSamples||150, rotate:rot,
      showPlanes:flagPlanes, showNormals:flagNormals, planeDensity:ctrlPlaneDensity,
      showLabels:opts.showLabels!==false, showVertexLabels:opts.showVertexLabels!==false,
      satellites:flagSatellites, satelliteDensity:ctrlSatelliteDensity,
      vertexList:data.vertexLists[i], highlightSet:hset,
      label: opts.showLabels!==false ? ('S'+i) : null,
      labelSize:opts.labelSize||11, dotR:opts.dotR||1.6, labelFontSize:opts.labelFontSize||8.5
    });
    totals.singular += res.totalSingular;
    totals.tangent += res.tangentPairs;
    totals.threaded += res.typeCounts.threaded;
    totals.polar += res.typeCounts['north-polar']+res.typeCounts['south-polar'];
    totals.bipolar += res.typeCounts.bipolar;
  }
  return totals;
}

// ---- Single-sphere mode ----
let SIZE = 640;
let cx = 320, cy = 320, baseR = 250;
function recomputeDerivedSizes(){
  cx = SIZE/2; cy = SIZE/2; baseR = SIZE*0.39;
}
let circles = [], notes = [], singleVertices = [], singleHighlightIdx = null;

function generateSingle(){
  const d = buildSingleArrangement(ctrlCircleCount);
  circles = d.circles; notes = d.notes; singleVertices = d.vertexList; singleHighlightIdx = d.highlightIdx;
}

let staticAngle = 0;

function drawSingle(ctx){
  ctx.clearRect(0,0,SIZE,SIZE);
  ctx.fillStyle = PAPER; ctx.fillRect(0,0,SIZE,SIZE);

  const R = baseR * zoomLevel;
  const highlightSet = flagSatellites ? new Set() : (singleHighlightIdx!=null ? new Set([singleHighlightIdx]) : new Set());
  const result = renderSphereView(ctx, cx, cy, R, circles, {
    showMeridian:true, meridianAngle:staticAngle, label:'S\u2080', rotate:rot,
    showPlanes:flagPlanes, showNormals:flagNormals, planeDensity:ctrlPlaneDensity,
    showLabels:flagCircleLabels, showVertexLabels:flagVertexLabels,
    satellites:flagSatellites, satelliteDensity:ctrlSatelliteDensity,
    vertexList:singleVertices, highlightSet
  });

  for (const note of notes){
    const p3 = rot(note.p);
    if (p3[2] < 0) continue;
    const scr = proj(cx,cy,R,p3);
    ctx.beginPath();
    ctx.arc(scr[0],scr[1],4.2,0,2*Math.PI);
    ctx.strokeStyle = INK;
    ctx.lineWidth = LW(0.5);
    ctx.setLineDash([1,2]);
    ctx.stroke();
    ctx.setLineDash([]);
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

// ---- Sphere network mode ----
let netData = null;

function generateNetwork(){
  netData = buildNetworkArrangement(ctrlSphereCount);
}

function drawNetwork(ctx){
  ctx.clearRect(0,0,SIZE,SIZE);
  ctx.fillStyle = PAPER; ctx.fillRect(0,0,SIZE,SIZE);
  const totals = renderNetworkInBox(ctx, netData, cx, cy, SIZE*0.47, SIZE*0.47, {
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

// ---- Grid mode ----
let gridData = [];

function generateGrid(){
  const n = ctrlGridSize * ctrlGridSize;
  gridData = [];
  const cellCircleCount = Math.max(3, Math.min(ctrlCircleCount, 8));
  const cellSphereCount = Math.max(4, Math.min(ctrlSphereCount, 8));
  for (let k=0;k<n;k++){
    if (gridContentMode === 'single') gridData.push(buildSingleArrangement(cellCircleCount));
    else gridData.push(buildNetworkArrangement(cellSphereCount));
  }
}

function drawGrid(ctx){
  ctx.clearRect(0,0,SIZE,SIZE);
  ctx.fillStyle = PAPER; ctx.fillRect(0,0,SIZE,SIZE);
  const n = ctrlGridSize;
  const cellW = SIZE/n, cellH = SIZE/n;
  for (let idx=0; idx<gridData.length; idx++){
    const row = Math.floor(idx/n), col = idx % n;
    const boxCx = col*cellW + cellW/2;
    const boxCy = row*cellH + cellH/2;
    const halfSize = Math.min(cellW,cellH)/2 - 8;
    if (gridContentMode === 'single'){
      const d = gridData[idx];
      const hset = flagSatellites ? new Set() : (d.highlightIdx!=null ? new Set([d.highlightIdx]) : new Set());
      renderSphereView(ctx, boxCx, boxCy, halfSize*zoomLevel, d.circles, {
        showMeridian:false, arcSamples:80, rotate:rot,
        showPlanes:flagPlanes, showNormals:flagNormals, planeDensity:ctrlPlaneDensity,
        showLabels:flagCircleLabels, showVertexLabels:flagVertexLabels,
        satellites:flagSatellites, satelliteDensity:ctrlSatelliteDensity,
        vertexList:d.vertexList, highlightSet:hset, dotR:1.3
      });
    } else {
      renderNetworkInBox(ctx, gridData[idx], boxCx, boxCy, halfSize, halfSize, {
        arcSamples:60, showLabels:flagCircleLabels, showVertexLabels:flagVertexLabels,
        pad:6, dotR:1.0, zoom:zoomLevel
      });
    }
  }
  document.getElementById('stats').textContent =
`grid                 : ${n}\u00d7${n} = ${gridData.length} arrangements
content               : ${gridContentMode}`;
  document.getElementById('legend').innerHTML =
    'Each cell is an independent random arrangement, freshly generated.';
}

// ---- Canvas setup ----
let mainCtx = null;
function computeCanvasSize(){
  const margin = 48; // top+bottom breathing room
  const availH = window.innerHeight - margin;
  const availW = window.innerWidth - 300 - 24 - 32; // sidebar + gaps + page padding
  return Math.max(360, Math.floor(Math.min(availH, availW)));
}

function setupCanvas(){
  const canvas = document.getElementById('base');
  const dpr = window.devicePixelRatio || 1;
  SIZE = computeCanvasSize();
  recomputeDerivedSizes();
  canvas.style.width = SIZE + 'px';
  canvas.style.height = SIZE + 'px';
  canvas.width = Math.round(SIZE*dpr);
  canvas.height = Math.round(SIZE*dpr);
  document.getElementById('stage').style.width = SIZE + 'px';
  document.getElementById('stage').style.height = SIZE + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  mainCtx = ctx;
}

let resizeTimer = null;
window.addEventListener('resize', ()=>{
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(()=>{ setupCanvas(); redraw(); }, 120);
});

function redraw(){
  if (sceneMode === 'single') drawSingle(mainCtx);
  else if (sceneMode === 'network') drawNetwork(mainCtx);
  else drawGrid(mainCtx);
}

function regen(){
  if (sceneMode === 'single'){ staticAngle = Math.random()*2*Math.PI; generateSingle(); }
  else if (sceneMode === 'network'){ generateNetwork(); }
  else { generateGrid(); }
  redraw();
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
document.getElementById('sliderStrokeWidth').addEventListener('input', (e)=>{
  const pct = parseInt(e.target.value,10);
  ctrlStrokeScale = pct/100;
  document.getElementById('lblStrokeWidth').textContent = pct+'%';
  redraw();
});
document.getElementById('zoomIn').addEventListener('click', ()=>{ zoomLevel = Math.min(4, zoomLevel*1.2); redraw(); });
document.getElementById('zoomOut').addEventListener('click', ()=>{ zoomLevel = Math.max(0.3, zoomLevel/1.2); redraw(); });

// ---- Drag-to-rotate, wheel/pinch-to-zoom ----
const stage = document.getElementById('stage');
let dragging = false, lastX = 0, lastY = 0;
function pointerDown(x,y){ dragging = true; lastX = x; lastY = y; stage.classList.add('dragging'); }
function pointerMove(x,y){
  if (!dragging) return;
  const dx = x - lastX, dy = y - lastY;
  viewYaw += dx * 0.01;
  viewPitch += dy * 0.01;
  viewPitch = Math.max(-1.5, Math.min(1.5, viewPitch));
  lastX = x; lastY = y;
  redraw();
}
function pointerUp(){ dragging = false; stage.classList.remove('dragging'); }

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

setupCanvas();
updateControlAvailability();
regen();