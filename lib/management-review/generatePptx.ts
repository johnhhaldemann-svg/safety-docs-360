import {
  REVIEW_SLUG, AGENDA_ITEMS, H1, PREV_ACTIONS, SITES, OBJECTIVES, LEGAL, LEADING,
} from "./data";

// ══════════════════════════════════════════════════════════════════════════════
//  PPTX GENERATOR  (pptxgenjs — async, dynamic import)
// ══════════════════════════════════════════════════════════════════════════════

export async function generatePptx(exportDate: string, checkedItems: Set<number>) {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 10" × 5.625"

  const C = {
    navy:"0f172a", navyMid:"1e3a5f", blue:"0ea5e9", green:"10b981", greenBg:"f0fdf4", greenBdr:"86efac",
    red:"dc2626", redBg:"fef2f2", redBdr:"fca5a5", orange:"f97316", orangeBg:"fff7ed", orangeBdr:"fed7aa",
    amber:"f59e0b", amberBg:"fffbeb", amberBdr:"fde047", purple:"7c3aed", purpleBg:"faf5ff",
    white:"FFFFFF", ltGray:"f8fafc", border:"e2e8f0", dark:"1e293b", mid:"334155", muted:"64748b", faint:"94a3b8",
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function hdr(slide: any, title: string, sub: string, n: number) {
    slide.addShape("rect", { x:0,y:0,w:10,h:0.65, fill:{color:C.navy} });
    slide.addText(title, { x:0.4,y:0.07,w:8.5,h:0.35, fontSize:14,bold:true,color:C.white,fontFace:"Calibri" });
    slide.addText(sub,   { x:0.4,y:0.42,w:8.5,h:0.2,  fontSize:8.5,color:"aaaaaa",fontFace:"Calibri" });
    slide.addShape("rect", { x:0,y:5.28,w:10,h:0.345, fill:{color:"f1f5f9"} });
    slide.addText("SafePredict  ·  H1 2026 Management Review  ·  CONFIDENTIAL", { x:0.3,y:5.3,w:8,h:0.2, fontSize:7.5,color:C.faint,fontFace:"Calibri" });
    slide.addText(`${n} / 16`, { x:9.3,y:5.3,w:0.5,h:0.2, fontSize:7.5,color:C.faint,fontFace:"Calibri",align:"right" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function statBox(slide: any, x:number,y:number,w:number,h:number, val:string,label:string,sub:string, valCol:string,bg:string) {
    slide.addShape("rect",{ x,y,w,h, fill:{color:bg},line:{color:C.border,width:1} });
    slide.addText(val,  { x:x+0.1,y:y+0.08, w:w-0.2,h:0.52, fontSize:28,bold:true,color:valCol,fontFace:"Calibri" });
    slide.addText(label,{ x:x+0.1,y:y+0.58, w:w-0.2,h:0.22, fontSize:10,bold:true,color:C.dark,fontFace:"Calibri" });
    slide.addText(sub,  { x:x+0.1,y:y+0.8,  w:w-0.2,h:0.2,  fontSize:8.5,color:C.muted,fontFace:"Calibri" });
  }

  // ── Slide 1 — TITLE ─────────────────────────────────────────────────────────
  const sl1 = pres.addSlide();
  sl1.addShape("rect",{x:0,y:0,w:10,h:5.625,fill:{color:C.navy}});
  sl1.addText("SafePredict  ·  Safety Docs 360",{x:0.6,y:0.45,w:9,h:0.25,fontSize:9,color:"888888",bold:true,fontFace:"Calibri"});
  sl1.addText("Safety & Compliance Review",{x:0.6,y:0.8,w:9,h:0.95,fontSize:36,bold:true,color:C.white,fontFace:"Calibri"});
  sl1.addText("H1 2026  ·  December 2025 – May 2026",{x:0.6,y:1.82,w:9,h:0.35,fontSize:14,color:"aaaaaa",fontFace:"Calibri"});
  ([["PORTFOLIO","5 Companies · 11 Jobsites"],["SAFETY EVENTS","31 logged"],["PERIOD","6 months"],["REPORT DATE",exportDate]] as [string,string][]).forEach(([l,v],i)=>{
    const x=0.5+i*2.35;
    sl1.addShape("rect",{x,y:2.45,w:2.2,h:0.75,fill:{color:C.navyMid},line:{color:"1e4a7f",width:1}});
    sl1.addText(l,{x,y:2.48,w:2.2,h:0.2,fontSize:7,color:"888888",bold:true,align:"center",fontFace:"Calibri"});
    sl1.addText(v,{x,y:2.68,w:2.2,h:0.3,fontSize:10,color:C.white,bold:true,align:"center",fontFace:"Calibri"});
  });
  sl1.addText("CONFIDENTIAL  ·  FOR EXECUTIVE REVIEW ONLY",{x:0.5,y:5.2,w:7,h:0.2,fontSize:8,color:"444444",fontFace:"Calibri"});
  sl1.addText("1 / 16",{x:9.3,y:5.2,w:0.5,h:0.2,fontSize:8,color:"444444",align:"right",fontFace:"Calibri"});

  // ── Slide 2 — PREVIOUS REVIEW ACTIONS ───────────────────────────────────────
  const sl2 = pres.addSlide();
  hdr(sl2,"Previous Review — Action Closeout","H2 2025 management review  ·  Status at H1 2026 review date",2);
  const statusCfgP = { closed:{col:"10b981",lbl:"CLOSED"}, partial:{col:"d97706",lbl:"PARTIAL"}, carried:{col:"dc2626",lbl:"CARRIED FWD"} };
  const prevTableRows = [
    [{text:"REF",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"ACTION",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"OWNER",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"DUE",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"STATUS",options:{bold:true,color:C.white,fill:{color:C.navy}}}],
    ...PREV_ACTIONS.map((a,i)=>{
      const cfg = statusCfgP[a.status]; const rf=i%2===0?"FFFFFF":"f8fafc";
      return [{text:a.ref,options:{bold:true,color:C.muted,fill:{color:rf}}},{text:a.action,options:{color:C.dark,fill:{color:rf}}},{text:a.owner,options:{color:C.muted,fill:{color:rf}}},{text:a.due,options:{color:C.muted,fill:{color:rf}}},{text:cfg.lbl,options:{bold:true,color:cfg.col,fill:{color:rf}}}];
    }),
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sl2.addTable(prevTableRows as any,{x:0.4,y:0.73,w:9.2,h:4.3,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[0.55,4.45,1.5,0.9,1.3],fontFace:"Calibri",fontSize:10,rowH:0.55});
  const [cCnt,pCnt,xCnt]=[PREV_ACTIONS.filter(a=>a.status==="closed").length,PREV_ACTIONS.filter(a=>a.status==="partial").length,PREV_ACTIONS.filter(a=>a.status==="carried").length];
  sl2.addShape("rect",{x:0.4,y:4.82,w:9.2,h:0.35,fill:{color:"fef9c3"},line:{color:"fde047",width:1}});
  sl2.addText(`✅ ${cCnt} closed  |  🟡 ${pCnt} partial  |  🔴 ${xCnt} carried forward — A2 (training) and A5 (hours) remain open data gaps this period`,{x:0.55,y:4.86,w:9.0,h:0.24,fontSize:9,color:"854d0e",fontFace:"Calibri"});

  // ── Slide 3 — EXECUTIVE SUMMARY ─────────────────────────────────────────────
  const sl3 = pres.addSlide();
  hdr(sl3,"Executive Summary","H1 2026  ·  5 Companies  ·  11 Jobsites",3);
  ([["31","Total Events","19 incidents + 12 near misses",C.blue,"f0f9ff"],["0","Fatalities","No fatal events this period",C.green,"f0fdf4"],["18","Recordable","OSHA recordable injuries",C.orange,"fff7ed"],["5","Lost-Time","29 days away · 39 restricted",C.red,"fef2f2"],["4","SIF-Potential","Serious injury or fatality risk",C.red,"fef2f2"]] as [string,string,string,string,string][]).forEach(([v,l,s,col,bg],i)=>{ statBox(sl3,0.35+i*1.87,0.73,1.77,1.1,v,l,s,col,bg); });
  ([["✅ 94% close rate","29 of 31 incidents closed — strong performance",C.green,"f0fdf4","86efac"],["⚠️ 6 CAs overdue","Past-due corrective actions need resourcing now",C.red,"fef2f2","fca5a5"],["🎯 4 SIF events","Targeted controls required — management priority",C.amber,"fffbeb","fde047"],["📌 Biggest ask","Load training & audit data. Clear overdue CAs. Document SIF controls.",C.muted,"f8fafc","e2e8f0"]] as [string,string,string,string,string][]).forEach(([t,b,col,bg,bdr],i)=>{
    const x=0.35+i*2.33;
    sl3.addShape("rect",{x,y:1.98,w:2.2,h:2.8,fill:{color:bg},line:{color:bdr,width:1}});
    sl3.addText(t,{x:x+0.1,y:2.05,w:2.0,h:0.3,fontSize:11,bold:true,color:col,fontFace:"Calibri"});
    sl3.addText(b,{x:x+0.1,y:2.4,w:2.0,h:2.2,fontSize:10,color:C.mid,fontFace:"Calibri",valign:"top"});
  });

  // ── Slide 4 — TREND COMPARISON ──────────────────────────────────────────────
  const sl4 = pres.addSlide();
  hdr(sl4,"Period-over-Period Trend","H2 2025 vs H1 2026  ·  All companies  ·  All jobsites",4);
  const tData:[string,string,string,string,string,boolean][]=[
    ["Total Safety Events","38","31","↓","−7",true],["Incidents","24","19","↓","−5",true],
    ["Near Misses","14","12","↓","−2",false],["Recordable Injuries","22","18","↓","−4",true],
    ["Lost-Time Cases","8","5","↓","−3",true],["Fatalities","0","0","→","—",true],
    ["SIF-Potential Events","6","4","↓","−2",true],["Incident Close Rate","87%","94%","↑","+7pts",true],
    ["CAs Overdue","9","6","↓","−3",true],["CA Actioned %","68%","78%","↑","+10pts",true],
  ];
  const tRows=[
    [{text:"METRIC",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"H2 2025",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center"}},{text:"H1 2026",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center"}},{text:"DIR",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center"}},{text:"CHANGE",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center"}}],
    ...tData.map(([m,p,c,d,ch,good])=>{
      const dc=d==="→"?C.muted:good?C.green:C.red; const rf=d==="→"?"FFFFFF":good?"f0fdf4":"fff5f5";
      return [{text:m,options:{color:C.dark,fill:{color:rf}}},{text:p,options:{bold:true,color:C.muted,align:"center",fill:{color:rf}}},{text:c,options:{bold:true,color:C.dark,align:"center",fill:{color:rf}}},{text:d,options:{bold:true,color:dc,fontSize:14,align:"center",fill:{color:rf}}},{text:ch,options:{bold:true,color:dc,align:"center",fill:{color:rf}}}];
    }),
  ];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sl4.addTable(tRows as any,{x:0.4,y:0.73,w:6.8,h:4.6,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[2.8,1.1,1.1,0.7,1.1],fontFace:"Calibri",fontSize:11,rowH:0.42});
  ([["✅ Positive overall","Events ↓18%, recordables ↓18%, lost-time ↓38%, close rate +7pts.",C.green,"f0fdf4","86efac",0.73,1.5],["⚠️ Watch items","Near-miss dipped (14→12) — target is to increase. 4 SIF events still high.",C.amber,"fffbeb","fde047",2.35,1.3],["📈 CA improving","Actioned rate +10pts (68→78%). Overdue ↓(9→6). Trend right.",C.blue,"eff6ff","bfdbfe",3.77,1.35]] as [string,string,string,string,string,number,number][]).forEach(([t,b,c,bg,bdr,y,h])=>{
    sl4.addShape("rect",{x:7.4,y,w:2.3,h,fill:{color:bg},line:{color:bdr,width:1}});
    sl4.addText(t,{x:7.5,y:y+0.08,w:2.1,h:0.28,fontSize:10,bold:true,color:c,fontFace:"Calibri"});
    sl4.addText(b,{x:7.5,y:y+0.38,w:2.1,h:h-0.45,fontSize:9.5,color:c,fontFace:"Calibri"});
  });

  // ── Slide 5 — SAFETY SCORECARD ──────────────────────────────────────────────
  const sl5 = pres.addSlide();
  hdr(sl5,"Safety Performance Scorecard","H1 2026  ·  All Companies  ·  All Jobsites",5);
  const scData:[string,string,string,string][]=[
    ["Total Safety Events","31","19 incidents + 12 near misses",C.blue],["Total Incidents","19","Recordable + non-recordable","3b82f6"],
    ["Near-Miss Reports","12","0.63:1 near-miss ratio (healthy)","8b5cf6"],["Recordable Injuries","18","OSHA recordable",C.orange],
    ["Lost-Time Cases","5","Days away or restricted work",C.red],["Fatalities","0 ✓","No fatal events recorded",C.green],
    ["SIF-Potential Events","4","Serious injury or fatality potential",C.red],["Days Away From Work","29","Total across all lost-time cases",C.amber],
    ["Days Restricted/Transfer","39","Total restricted or transferred duties",C.amber],["Incident Close Rate","94%","29 of 31 incidents closed",C.green],
  ];
  const scLeft  = scData.slice(0, 5);
  const scRight = scData.slice(5);
  const scHdr = [{text:"METRIC",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"VAL",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"NOTES",options:{bold:true,color:C.white,fill:{color:C.navy}}}];
  const scRow = ([m,v,n,c]:[string,string,string,string],i:number)=>[{text:m,options:{color:C.dark,fill:{color:i%2===0?"FFFFFF":"f8fafc"}}},{text:v,options:{bold:true,fontSize:14,color:c,align:"center" as const,fill:{color:i%2===0?"FFFFFF":"f8fafc"}}},{text:n,options:{color:C.muted,fill:{color:i%2===0?"FFFFFF":"f8fafc"}}}];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sl5.addTable([scHdr,...scLeft.map(scRow)]  as any,{x:0.3,y:0.73,w:4.55,h:2.64,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[2.0,0.65,1.9],fontFace:"Calibri",fontSize:10,rowH:0.44});
  sl5.addShape("line",{x:5.0,y:0.73,w:0,h:2.64,line:{color:"e2e8f0",width:1}});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sl5.addTable([scHdr,...scRight.map(scRow)] as any,{x:5.15,y:0.73,w:4.55,h:2.64,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[2.0,0.65,1.9],fontFace:"Calibri",fontSize:10,rowH:0.44});
  const infoCfg:[string,string,string,string,string,string][]=[
    ["TRIR Gap","TRIR/DART rates cannot be calculated — hours worked data is missing.","fef9c3","fde047","854d0e","⚠️"],
    ["Near-Miss Ratio","0.63 : 1  (target ≥ 1 : 1) — improve hazard reporting culture.","eff6ff","bfdbfe","1e40af","📊"],
    ["SIF Watch","4 SIF-potential events recorded — controls require formal verification.","fef2f2","fca5a5","991b1b","🔴"],
  ];
  infoCfg.forEach(([title,note,bg,bdr,tc,ic],i)=>{
    const x=0.3+i*3.2;
    sl5.addShape("rect",{x,y:3.55,w:3.0,h:1.62,fill:{color:bg},line:{color:bdr,width:1}});
    sl5.addText(`${ic}  ${title}`,{x:x+0.12,y:3.63,w:2.76,h:0.3,fontSize:11,bold:true,color:tc,fontFace:"Calibri"});
    sl5.addText(note,{x:x+0.12,y:4.0,w:2.76,h:0.9,fontSize:9.5,color:tc,fontFace:"Calibri"});
  });

  // ── Slide 6 — OBJECTIVES & TARGETS ──────────────────────────────────────────
  const sl6obj = pres.addSlide();
  hdr(sl6obj,"Objectives & Targets — H1 2026 vs Plan","Annual safety objectives  ·  RAG status at period end",6);
  const objStatCfgP = { met:{col:C.green,lbl:"MET ✓"}, watch:{col:"d97706",lbl:"MONITOR ⚠️"}, missed:{col:C.red,lbl:"MISSED ✗"}, gap:{col:C.muted,lbl:"DATA GAP"} };
  /* eslint-disable @typescript-eslint/no-explicit-any */
  sl6obj.addTable([
    [{text:"OBJECTIVE",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"TARGET",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"ACTUAL",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"STATUS",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"NOTES",options:{bold:true,color:C.white,fill:{color:C.navy}}}],
    ...OBJECTIVES.map((o,i)=>{const cfg=objStatCfgP[o.status];const rf=i%2===0?"FFFFFF":"f8fafc";return[{text:o.obj,options:{color:C.dark,fill:{color:rf}}},{text:o.target,options:{bold:true,color:C.muted,align:"center" as const,fill:{color:rf}}},{text:o.actual,options:{bold:true,fontSize:14,color:cfg.col,align:"center" as const,fill:{color:rf}}},{text:cfg.lbl,options:{bold:true,color:cfg.col,align:"center" as const,fill:{color:rf}}},{text:o.note,options:{color:C.muted,fill:{color:rf}}}];}),
  ] as any,{x:0.4,y:0.73,w:9.2,h:4.55,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[2.8,1.0,1.0,1.2,3.2],fontFace:"Calibri",fontSize:10,rowH:0.42});
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const [mc,wc,xc,gc]=[OBJECTIVES.filter(o=>o.status==="met").length,OBJECTIVES.filter(o=>o.status==="watch").length,OBJECTIVES.filter(o=>o.status==="missed").length,OBJECTIVES.filter(o=>o.status==="gap").length];
  sl6obj.addShape("rect",{x:0.4,y:5.0,w:9.2,h:0.22,fill:{color:"f0fdf4"},line:{color:"86efac",width:1}});
  sl6obj.addText(`✅ ${mc} met  |  ⚠️ ${wc} monitor  |  ✗ ${xc} missed  |  📭 ${gc} data gaps (training + audit not yet loaded)`,{x:0.55,y:5.02,w:9.0,h:0.18,fontSize:9,color:C.dark,fontFace:"Calibri"});

  // ── Slide 7 — SITE BREAKDOWN ─────────────────────────────────────────────────
  const sl6 = pres.addSlide();
  hdr(sl6,"Site-Level Performance Breakdown","H1 2026  ·  11 jobsites  ·  5 companies",7);
  const rCol={critical:C.red,high:C.orange,medium:C.amber,low:C.green,clear:C.green};
  /* eslint-disable @typescript-eslint/no-explicit-any */
  sl6.addTable([
    [{text:"SITE",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"COMPANY",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"EVENTS",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"INC",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"NM",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"SIF",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"OVERDUE",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}},{text:"RISK",options:{bold:true,color:C.white,fill:{color:C.navy},align:"center" as const}}],
    ...SITES.map((s,i)=>{const rf=i%2===0?"FFFFFF":"f8fafc";const rc=rCol[s.risk];return[{text:s.name,options:{color:C.dark,bold:true,fill:{color:rf}}},{text:s.company,options:{color:C.muted,fill:{color:rf}}},{text:String(s.events),options:{bold:true,fontSize:13,color:s.events>4?C.red:s.events>2?C.orange:C.dark,align:"center" as const,fill:{color:rf}}},{text:String(s.incidents),options:{bold:true,color:C.mid,align:"center" as const,fill:{color:rf}}},{text:String(s.nearMisses),options:{bold:true,color:"8b5cf6",align:"center" as const,fill:{color:rf}}},{text:s.sif>0?String(s.sif):"—",options:{bold:true,color:s.sif>0?C.red:C.green,align:"center" as const,fill:{color:rf}}},{text:s.overdueCAs>0?String(s.overdueCAs):"—",options:{bold:true,color:s.overdueCAs>0?C.orange:C.green,align:"center" as const,fill:{color:rf}}},{text:s.risk.toUpperCase(),options:{bold:true,color:rc,align:"center" as const,fill:{color:rf}}}];}),
  ] as any,{x:0.3,y:0.73,w:9.4,h:4.6,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[2.4,1.5,0.75,0.6,0.6,0.6,0.8,0.95],fontFace:"Calibri",fontSize:10,rowH:0.4});
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // ── Slide 8 — LEADING INDICATORS ─────────────────────────────────────────────
  const sl7 = pres.addSlide();
  hdr(sl7,"Leading Indicators Dashboard","H1 2026  ·  Proactive safety performance metrics",8);
  ([
    ["Site Inspections",       LEADING.inspections.completed,  LEADING.inspections.target,  LEADING.inspections.pct,  LEADING.prevPeriod.inspections,  C.blue],
    ["Toolbox Talks Delivered",LEADING.toolboxTalks.completed, LEADING.toolboxTalks.target, LEADING.toolboxTalks.pct, LEADING.prevPeriod.toolboxTalks, "8b5cf6"],
    ["Hazard Reports",         LEADING.hazardReports.completed,LEADING.hazardReports.target,LEADING.hazardReports.pct,LEADING.prevPeriod.hazardReports,C.orange],
    ["Safety Observations",    LEADING.safetyObs.completed,    LEADING.safetyObs.target,    LEADING.safetyObs.pct,    LEADING.prevPeriod.safetyObs,    C.green],
    ["Pre-Task Risk Assessments",LEADING.preTaskRAs.completed, LEADING.preTaskRAs.target,   LEADING.preTaskRAs.pct,   LEADING.prevPeriod.preTaskRAs,   "0ea5e9"],
  ] as [string,number,number,number,number,string][]).forEach(([lbl,done,tgt,pct,prev,col],idx)=>{
    const y=0.78+idx*0.84; const bw=Math.min(pct/100*5.8,5.8); const up=done>=prev;
    const trendStr=done===prev?"—":(up?`▲${done-prev}`:`▼${prev-done}`);
    sl7.addText(lbl,{x:0.4,y,w:3.0,h:0.3,fontSize:11,bold:true,color:C.dark,fontFace:"Calibri"});
    sl7.addText(`${done} / ${tgt}  (${pct}% of target)`,{x:6.7,y,w:3.0,h:0.3,fontSize:10,bold:true,color:col,fontFace:"Calibri"});
    sl7.addText(`vs H2 2025: ${trendStr}`,{x:6.7,y:y+0.32,w:3.0,h:0.22,fontSize:9,color:up?"16a34a":"dc2626",fontFace:"Calibri"});
    sl7.addShape("rect",{x:0.4,y:y+0.36,w:5.8,h:0.16,fill:{color:"e2e8f0"}});
    if(bw>0) sl7.addShape("rect",{x:0.4,y:y+0.36,w:bw,h:0.16,fill:{color:col}});
  });
  sl7.addShape("rect",{x:0.4,y:4.88,w:5.8,h:0.32,fill:{color:"fef9c3"},line:{color:"fde047",width:1}});
  sl7.addText("📌 Training completion is a key leading indicator not yet loaded — will appear here once data is populated.",{x:0.55,y:4.9,w:5.6,h:0.25,fontSize:9,color:"854d0e",fontFace:"Calibri"});
  sl7.addShape("rect",{x:6.55,y:0.78,w:3.1,h:0.92,fill:{color:"fef2f2"},line:{color:"fca5a5",width:1}});
  sl7.addText("3 Stop-Work Authorities issued",{x:6.65,y:0.84,w:2.9,h:0.26,fontSize:10,bold:true,color:C.red,fontFace:"Calibri"});
  sl7.addText("Workers exercising SWA rights — positive safety culture signal.",{x:6.65,y:1.12,w:2.9,h:0.44,fontSize:9,color:C.muted,fontFace:"Calibri"});
  sl7.addShape("rect",{x:6.55,y:1.82,w:3.1,h:0.92,fill:{color:"fff7ed"},line:{color:"fed7aa",width:1}});
  sl7.addText("Near-miss ratio: 0.63 : 1",{x:6.65,y:1.88,w:2.9,h:0.26,fontSize:10,bold:true,color:C.orange,fontFace:"Calibri"});
  sl7.addText("12 near misses : 19 incidents. Below ≥1:1 industry target — improve reporting culture.",{x:6.65,y:2.16,w:2.9,h:0.44,fontSize:9,color:C.muted,fontFace:"Calibri"});
  sl7.addShape("rect",{x:6.55,y:2.86,w:3.1,h:0.92,fill:{color:"f0fdf4"},line:{color:"86efac",width:1}});
  sl7.addText("Pre-Task RAs: 104% ✓",{x:6.65,y:2.92,w:2.9,h:0.26,fontSize:10,bold:true,color:C.green,fontFace:"Calibri"});
  sl7.addText("312 filed vs 300 planned — safety planning is ahead of target across the portfolio.",{x:6.65,y:3.20,w:2.9,h:0.44,fontSize:9,color:C.muted,fontFace:"Calibri"});
  sl7.addShape("rect",{x:6.55,y:3.90,w:3.1,h:0.92,fill:{color:"fffbeb"},line:{color:"fde047",width:1}});
  sl7.addText("Hazard Reports: 76% ⚠️",{x:6.65,y:3.96,w:2.9,h:0.26,fontSize:10,bold:true,color:C.amber,fontFace:"Calibri"});
  sl7.addText("38 of 50 planned submitted. Improve visibility and reporting cadence at underperforming sites.",{x:6.65,y:4.24,w:2.9,h:0.44,fontSize:9,color:C.muted,fontFace:"Calibri"});

  // ── Slide 9 — INCIDENT REVIEW ────────────────────────────────────────────────
  const sl8 = pres.addSlide();
  hdr(sl8,"Incident Review","H1 2026  ·  31 events  ·  19 incidents  ·  12 near misses",9);
  sl8.addText("By Severity",{x:0.4,y:0.73,w:4.0,h:0.25,fontSize:9,bold:true,color:C.muted,fontFace:"Calibri"});
  ([{l:"Critical",v:1,c:C.red},{l:"High",v:14,c:C.orange},{l:"Medium",v:12,c:C.amber},{l:"Low",v:4,c:C.green}]).forEach((s,i)=>{
    const y=1.02+i*0.65; const bw=Math.max(0.1,(s.v/14)*3.0);
    sl8.addText(s.l,{x:0.4,y,w:1.0,h:0.28,fontSize:10,color:C.dark,fontFace:"Calibri"});
    sl8.addShape("rect",{x:1.5,y:y+0.04,w:3.0,h:0.2,fill:{color:"e2e8f0"}});
    sl8.addShape("rect",{x:1.5,y:y+0.04,w:bw, h:0.2,fill:{color:s.c}});
    sl8.addText(String(s.v),{x:4.6,y,w:0.4,h:0.28,fontSize:11,bold:true,color:s.c,fontFace:"Calibri"});
  });
  sl8.addShape("rect",{x:0.4,y:3.72,w:4.2,h:0.42,fill:{color:"f0fdf4"},line:{color:"86efac",width:1}});
  sl8.addText("✅  94% close rate  |  29 closed  |  2 in progress  |  19 incidents  |  12 near misses",{x:0.5,y:3.76,w:4.0,h:0.28,fontSize:9.5,bold:true,color:C.green,fontFace:"Calibri"});
  sl8.addText("Notable & SIF-Potential Events",{x:5.0,y:0.73,w:4.7,h:0.25,fontSize:9,bold:true,color:C.muted,fontFace:"Calibri"});
  H1.incidents.notable.forEach((ev,i)=>{
    const y=1.02+i*0.63; const bg=ev.ai?"fdf4ff":ev.tags.some(t=>t.includes("SIF"))?"fff7f7":"f8fafc";
    sl8.addShape("rect",{x:5.0,y,w:4.7,h:0.57,fill:{color:bg},line:{color:"e2e8f0",width:0.5}});
    const icon=ev.ai?"[AI]":ev.tags.some(t=>t.includes("SIF"))?"[SIF]":"";
    sl8.addText(`${icon} ${ev.title}`,{x:5.1,y:y+0.04,w:4.5,h:0.28,fontSize:9.5,bold:true,color:C.dark,fontFace:"Calibri"});
    sl8.addText(ev.tags.join("  ·  "),{x:5.1,y:y+0.34,w:4.5,h:0.18,fontSize:8,color:ev.ai?"7c3aed":C.muted,fontFace:"Calibri"});
  });
  sl8.addShape("rect",{x:5.0,y:4.82,w:4.7,h:0.35,fill:{color:"f0fdf4"},line:{color:"bbf7d0",width:1}});
  sl8.addText("Gus AI auto-flagged 2 of 6 notable events (energised panel + O₂ deficiency) before human report.",{x:5.1,y:4.86,w:4.5,h:0.24,fontSize:9,color:"166534",fontFace:"Calibri"});

  // ── Slide 10 — COMPLIANCE ─────────────────────────────────────────────────────
  const sl9 = pres.addSlide();
  hdr(sl9,"Compliance Status","Permits  ·  Audits  ·  Training  ·  H1 2026",10);
  sl9.addText("📋  Permits to Work",{x:0.4,y:0.75,w:4.0,h:0.3,fontSize:12,bold:true,color:C.dark,fontFace:"Calibri"});
  ([["38","Total",C.blue,"f0f9ff"],["7","Active","3b82f6","eff6ff"],["30","Closed",C.green,"f0fdf4"],["1","Draft",C.amber,"fffbeb"]] as [string,string,string,string][]).forEach(([v,l,c,bg],i)=>{
    const x=0.4+i*1.05;
    sl9.addShape("rect",{x,y:1.12,w:0.95,h:0.88,fill:{color:bg},line:{color:"e2e8f0",width:1}});
    sl9.addText(v,{x,y:1.15,w:0.95,h:0.44,fontSize:22,bold:true,color:c,align:"center",fontFace:"Calibri"});
    sl9.addText(l,{x,y:1.6,w:0.95,h:0.2,fontSize:9,color:C.muted,align:"center",fontFace:"Calibri"});
  });
  sl9.addShape("rect",{x:0.4,y:2.1,w:4.1,h:0.4,fill:{color:"f0fdf4"},line:{color:"86efac",width:1}});
  sl9.addText("✅  0 permits expiring in the next 30 days",{x:0.5,y:2.13,w:3.9,h:0.28,fontSize:10,bold:true,color:C.green,fontFace:"Calibri"});
  sl9.addShape("rect",{x:0.4,y:2.65,w:4.1,h:2.3,fill:{color:"fff7ed"},line:{color:"fed7aa",width:2}});
  sl9.addText("🔍  Site Audits — DATA GAP",{x:0.55,y:2.73,w:3.85,h:0.3,fontSize:11,bold:true,color:C.orange,fontFace:"Calibri"});
  sl9.addText("Jobsite audit records are not yet populated. Audit compliance scores cannot be reported this period.\n\nAction: populate audit data to unlock compliance scoring next period.",{x:0.55,y:3.1,w:3.85,h:1.7,fontSize:10,color:"9a3412",fontFace:"Calibri"});
  sl9.addShape("rect",{x:4.75,y:0.75,w:4.9,h:4.2,fill:{color:"fff7ed"},line:{color:"fed7aa",width:2}});
  sl9.addText("🎓  Employee Training — DATA GAP",{x:4.9,y:0.83,w:4.6,h:0.3,fontSize:11,bold:true,color:C.orange,fontFace:"Calibri"});
  sl9.addText("Training completion records are not yet populated.\n\nTraining completion % cannot be reported this period.\n\nThis is a mandatory ISO 45001 §7.2 metric.\n\nAction: assign data-entry ownership and set a deadline before the next management review.",{x:4.9,y:1.22,w:4.6,h:3.5,fontSize:11,color:"9a3412",fontFace:"Calibri"});

  // ── Slide 11 — LEGAL & REGULATORY STATUS ─────────────────────────────────────
  const sl11leg = pres.addSlide();
  hdr(sl11leg,"Legal & Regulatory Status","H1 2026  ·  WHS Act 2011  ·  ISO 45001 obligations",11);
  sl11leg.addShape("rect",{x:0.4,y:0.72,w:3.8,h:0.36,fill:{color:C.green},line:{color:C.green,width:0}});
  sl11leg.addText("✅  NO ENFORCEMENT NOTICES — PERIOD CLEAR",{x:0.5,y:0.75,w:3.6,h:0.28,fontSize:11,bold:true,color:C.white,fontFace:"Calibri"});
  sl11leg.addText("Jurisdiction",{x:0.4,y:1.16,w:1.6,h:0.22,fontSize:10,bold:true,color:C.muted,fontFace:"Calibri"});
  sl11leg.addText(LEGAL.jurisdiction,{x:0.4,y:1.38,w:3.8,h:0.3,fontSize:10,color:C.dark,fontFace:"Calibri"});
  sl11leg.addText("CERTIFICATIONS",{x:0.4,y:1.78,w:3.8,h:0.22,fontSize:10,bold:true,color:C.navy,fontFace:"Calibri"});
  /* eslint-disable @typescript-eslint/no-explicit-any */
  sl11leg.addTable([
    [{text:"Certification",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"Status",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"Expiry",options:{bold:true,color:C.white,fill:{color:C.navy}}}],
    ...LEGAL.certifications.map((c,i)=>{const rf=i%2===0?"FFFFFF":"f8fafc";return[{text:c.name,options:{color:C.dark,fill:{color:rf}}},{text:c.status,options:{color:c.ok?C.green:C.red,fill:{color:rf}}},{text:c.expiry,options:{color:C.muted,fill:{color:rf}}}];}),
  ] as any,{x:0.4,y:2.04,w:3.8,h:1.0,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[1.9,1.1,0.8],fontFace:"Calibri",fontSize:10,rowH:0.25});
  /* eslint-enable @typescript-eslint/no-explicit-any */
  sl11leg.addText("UPCOMING OBLIGATIONS",{x:0.4,y:3.14,w:3.8,h:0.22,fontSize:10,bold:true,color:C.navy,fontFace:"Calibri"});
  LEGAL.upcoming.forEach((u,i)=>{sl11leg.addText(`• ${u}`,{x:0.4,y:3.4+i*0.35,w:3.8,h:0.3,fontSize:10,color:"9a3412",fontFace:"Calibri"});});
  sl11leg.addText("REGULATORY UPDATES — H1 2026",{x:4.5,y:0.72,w:5.1,h:0.22,fontSize:10,bold:true,color:C.navy,fontFace:"Calibri"});
  const statusColor = (s:string) => s==="overdue"?C.red:s==="in-progress"?C.amber:"94a3b8";
  /* eslint-disable @typescript-eslint/no-explicit-any */
  sl11leg.addTable([
    [{text:"Date",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"Update / Obligation",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"Action Required",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"Due",options:{bold:true,color:C.white,fill:{color:C.navy}}},{text:"Status",options:{bold:true,color:C.white,fill:{color:C.navy}}}],
    ...LEGAL.updates.map((u,i)=>{const rf=i%2===0?"FFFFFF":"f8fafc";return[{text:u.date,options:{color:C.muted,fill:{color:rf}}},{text:u.item,options:{color:C.dark,fill:{color:rf}}},{text:u.action,options:{color:C.muted,fill:{color:rf}}},{text:u.due,options:{color:C.muted,fill:{color:rf}}},{text:u.status.toUpperCase(),options:{bold:true,color:statusColor(u.status),fill:{color:rf}}}];}),
  ] as any,{x:4.5,y:1.0,w:5.1,h:1.3,border:{type:"solid",color:"e2e8f0",pt:0.5},colW:[0.6,1.9,1.5,0.6,0.5],fontFace:"Calibri",fontSize:9,rowH:0.33});
  /* eslint-enable @typescript-eslint/no-explicit-any */
  sl11leg.addText("KEY COMPLIANCE RISK — PRIORITY ACTION",{x:4.5,y:2.4,w:5.1,h:0.22,fontSize:10,bold:true,color:C.red,fontFace:"Calibri"});
  sl11leg.addShape("rect",{x:4.5,y:2.66,w:5.1,h:1.6,fill:{color:"fef2f2"},line:{color:"fca5a5",width:1}});
  sl11leg.addText("Confined Space Regulations (Feb 2026 update) — OVERDUE\n\nState regulator revised atmospheric monitoring requirements. Site procedures must be updated and all affected personnel retrained before new confined space regulations take effect in Q3 2026.\n\nResponsible: HSE Manager  |  Deadline: Q2 2026 (OVERDUE)  |  Escalate immediately.",{x:4.6,y:2.72,w:4.9,h:1.48,fontSize:10,color:"9a3412",fontFace:"Calibri"});

  // ── Slide 12 — RISK MATRIX ───────────────────────────────────────────────────
  const sl10 = pres.addSlide();
  hdr(sl10,"Risk Matrix — Portfolio Overview","30 scored risk items  ·  All jobsites  ·  H1 2026",12);
  ([["2","Critical / Extreme","Immediate controls required",C.red,"fef2f2","fca5a5"],["14","High","Targeted risk treatment needed",C.orange,"fff7ed","fed7aa"],["13","Moderate","Manage & monitor",C.amber,"fffbeb","fde047"],["1","Low","Accept with periodic review",C.green,"f0fdf4","86efac"]] as [string,string,string,string,string,string][]).forEach(([v,l,d,c,bg,bdr],i)=>{
    const y=0.78+i*1.05;
    sl10.addShape("rect",{x:0.4,y,w:4.5,h:0.97,fill:{color:bg},line:{color:bdr,width:1}});
    sl10.addText(v,{x:0.5,y:y+0.12,w:0.9,h:0.7,fontSize:36,bold:true,color:c,fontFace:"Calibri"});
    sl10.addText(l,{x:1.55,y:y+0.1,w:3.2,h:0.3,fontSize:12,bold:true,color:C.dark,fontFace:"Calibri"});
    sl10.addText(d,{x:1.55,y:y+0.46,w:3.2,h:0.35,fontSize:10,color:C.muted,fontFace:"Calibri"});
  });
  const lvlCol:Record<string,string>={E:C.red,H:C.orange,M:C.amber,L:C.green};
  const lvlGrid=[["H","H","E","E","E"],["M","H","H","E","E"],["L","M","H","H","E"],["L","L","M","H","H"],["L","L","L","M","H"]];
  const cntGrid=[[1,2,0,1,1],[3,1,2,0,0],[0,4,3,2,0],[0,0,3,2,1],[1,0,0,3,0]];
  const cs=0.68,gx=5.2,gy=0.78;
  for(let r=0;r<5;r++)for(let c=0;c<5;c++){
    sl10.addShape("rect",{x:gx+c*cs,y:gy+r*cs,w:cs-0.04,h:cs-0.04,fill:{color:lvlCol[lvlGrid[r][c]]},line:{color:"FFFFFF",width:1}});
    if(cntGrid[r][c]>0) sl10.addText(String(cntGrid[r][c]),{x:gx+c*cs,y:gy+r*cs,w:cs-0.04,h:cs-0.04,fontSize:16,bold:true,color:"FFFFFF",align:"center",valign:"middle",fontFace:"Calibri"});
  }
  (["Fatal","Major","Moderate","Minor","Neglg."]).forEach((l,i)=>sl10.addText(l,{x:gx-1.05,y:gy+i*cs+0.22,w:1.0,h:0.28,fontSize:8.5,color:C.muted,align:"right",fontFace:"Calibri"}));
  (["Rare","Unlikely","Possible","Likely","A.Certain"]).forEach((l,i)=>sl10.addText(l,{x:gx+i*cs,y:gy+5*cs+0.05,w:cs,h:0.24,fontSize:8,color:C.muted,align:"center",fontFace:"Calibri"}));
  sl10.addShape("rect",{x:0.4,y:4.97,w:9.2,h:0.22,fill:{color:"fef2f2"},line:{color:"fca5a5",width:1}});
  sl10.addText("🔴  Key finding: 16 of 30 items (53%) in the high/critical band — this is the visual that drives the resourcing ask on slide 14.",{x:0.5,y:4.98,w:9.0,h:0.19,fontSize:9,bold:true,color:C.red,fontFace:"Calibri"});

  // ── Slide 13 — CORRECTIVE ACTIONS ───────────────────────────────────────────
  const sl11 = pres.addSlide();
  hdr(sl11,"Corrective Action Management","54 total  ·  H1 2026  ·  All jobsites",13);
  sl11.addShape("rect",{x:0.4,y:0.73,w:2.0,h:4.22,fill:{color:C.navy}});
  sl11.addText("TOTAL\nCORRECTIVE\nACTIONS",{x:0.4,y:0.9,w:2.0,h:0.65,fontSize:9,bold:true,color:"888888",align:"center",fontFace:"Calibri"});
  sl11.addText("54",{x:0.4,y:1.62,w:2.0,h:1.0,fontSize:58,bold:true,color:C.amber,align:"center",fontFace:"Calibri"});
  sl11.addText("78% actioned",{x:0.4,y:2.72,w:2.0,h:0.32,fontSize:11,bold:true,color:"fbbf24",align:"center",fontFace:"Calibri"});
  sl11.addText("42 of 54 actioned.\nVerification & overdue\nclosure is the bottleneck.",{x:0.4,y:3.1,w:2.0,h:0.7,fontSize:9,color:"888888",align:"center",fontFace:"Calibri"});
  ([{l:"Verified closed",v:25,c:C.green},{l:"Corrected",v:17,c:"3b82f6"},{l:"Open",v:12,c:C.amber},{l:"Overdue",v:6,c:C.red}]).forEach((s,i)=>{
    const y=0.82+i*0.6; const bw=(s.v/25)*2.8;
    sl11.addText(s.l,{x:2.6,y,w:1.5,h:0.28,fontSize:10,color:C.dark,fontFace:"Calibri"});
    sl11.addShape("rect",{x:4.2,y:y+0.04,w:2.8,h:0.2,fill:{color:"e2e8f0"}});
    sl11.addShape("rect",{x:4.2,y:y+0.04,w:bw, h:0.2,fill:{color:s.c}});
    sl11.addText(String(s.v),{x:7.08,y,w:0.4,h:0.28,fontSize:11,bold:true,color:s.c,fontFace:"Calibri"});
  });
  ([{l:"Critical",v:8,c:C.red},{l:"High",v:18,c:C.orange},{l:"Medium",v:10,c:C.amber},{l:"Low",v:18,c:C.green}]).forEach((s,i)=>{
    const y=3.38+i*0.33; const bw=(s.v/18)*2.8;
    sl11.addText(s.l,{x:2.6,y,w:1.1,h:0.26,fontSize:9,color:C.dark,fontFace:"Calibri"});
    sl11.addShape("rect",{x:3.8,y:y+0.04,w:2.8,h:0.16,fill:{color:"e2e8f0"}});
    sl11.addShape("rect",{x:3.8,y:y+0.04,w:bw, h:0.16,fill:{color:s.c}});
    sl11.addText(String(s.v),{x:6.68,y,w:0.35,h:0.26,fontSize:9,bold:true,color:s.c,fontFace:"Calibri"});
  });
  ([["✅ 25 verified closed","Fully closed & verified — 46% of total","f0fdf4",C.green],["🔵 17 corrected","Fix done, not yet independently verified","eff6ff","1d4ed8"],["🟡 12 still open","Active, in progress or not yet started","fffbeb","92400e"],["🔴 6 overdue","Past due date — management escalation required","fef2f2","991b1b"]] as [string,string,string,string][]).forEach(([t,d,bg,c],i)=>{
    const y=0.82+i*0.95;
    sl11.addShape("rect",{x:7.5,y,w:2.15,h:0.85,fill:{color:bg},line:{color:"e2e8f0",width:0.5}});
    sl11.addText(t,{x:7.62,y:y+0.08,w:1.9,h:0.28,fontSize:9.5,bold:true,color:C.dark,fontFace:"Calibri"});
    sl11.addText(d,{x:7.62,y:y+0.38,w:1.9,h:0.35,fontSize:9,color:c,fontFace:"Calibri"});
  });
  sl11.addShape("rect",{x:7.5,y:4.65,w:2.15,h:0.52,fill:{color:"fef9c3"},line:{color:"fde047",width:1}});
  sl11.addText("Critical CAs (8) include SIF-related incidents. Prioritise for closure.",{x:7.62,y:4.68,w:1.9,h:0.4,fontSize:9,color:"854d0e",fontFace:"Calibri"});

  // ── Slide 14 — ASKS & DECISIONS ──────────────────────────────────────────────
  const sl12 = pres.addSlide();
  hdr(sl12,"Asks & Decisions Required","Three specific actions needed from this review",14);
  ([
    ["a","Resource to clear overdue corrective actions","6 overdue CAs require owner assignment and expedited closure. 17 CAs marked 'corrected' need independent verification. Recommend a 2-week sprint.",C.red,"fef2f2","fca5a5"],
    ["b","Targeted controls for the high/critical risk band","2 critical and 14 high risk-band items (53% of all scored work) require active risk treatment. Assign controls for SIF hazard types: hand/crush, arc flash, chemical exposure, work-at-height.",C.orange,"fff7ed","fed7aa"],
    ["c","Turn on training & audit tracking","Training completion and audit scores not yet populated. ISO 45001 mandated. Assign data-entry ownership and set a deadline before the next review.",C.amber,"fffbeb","fde047"],
  ] as [string,string,string,string,string,string][]).forEach(([letter,title,body,c,bg,bdr],i)=>{
    const y=0.78+i*1.38;
    sl12.addShape("rect",{x:0.4,y,w:9.2,h:1.28,fill:{color:bg},line:{color:bdr,width:1}});
    sl12.addShape("rect",{x:0.52,y:y+0.24,w:0.5,h:0.5,fill:{color:c}});
    sl12.addText(letter,{x:0.52,y:y+0.24,w:0.5,h:0.5,fontSize:16,bold:true,color:"FFFFFF",align:"center",valign:"middle",fontFace:"Calibri"});
    sl12.addText(title,{x:1.2,y:y+0.1,w:8.2,h:0.34,fontSize:12,bold:true,color:C.dark,fontFace:"Calibri"});
    sl12.addText(body, {x:1.2,y:y+0.5,w:8.2,h:0.68,fontSize:10.5,color:C.mid,fontFace:"Calibri"});
  });
  sl12.addShape("rect",{x:0.4,y:4.95,w:9.2,h:0.22,fill:{color:"f0fdf4"},line:{color:"86efac",width:1}});
  sl12.addText("✅  Each ask is tied to specific numbers. Decisions and owners should be recorded in minutes before this meeting closes.",{x:0.55,y:4.97,w:9.0,h:0.18,fontSize:9,color:C.green,fontFace:"Calibri"});

  // ── Slide 15 — OPEN ISSUES & GAPS ───────────────────────────────────────────
  const sl13 = pres.addSlide();
  hdr(sl13,"Open Issues & Critical Gaps","H1 2026  ·  What needs immediate attention",15);
  sl13.addText("Top 5 Gaps",{x:0.4,y:0.73,w:3.4,h:0.25,fontSize:9,bold:true,color:C.red,fontFace:"Calibri"});
  ([["1","Training records not loaded","ISO 45001 §7.2 cannot be demonstrated.",C.red,"fef2f2","fca5a5"],["2","Site audit data missing","Data gap — not zero performance.",C.orange,"fff7ed","fed7aa"],["3","6 CAs overdue","Linked to SIF-potential events.",C.orange,"fff7ed","fed7aa"],["4","Hours worked not tracked","TRIR/DART rates cannot be calculated.",C.amber,"fffbeb","fde047"],["5","SIF controls unverified","4 events; controls not formally verified.","7c3aed","faf5ff","e9d5ff"]] as [string,string,string,string,string,string][]).forEach(([n,t,d,c,bg,bdr],i)=>{
    const y=1.02+i*0.78;
    sl13.addShape("rect",{x:0.4,y,w:3.5,h:0.72,fill:{color:bg},line:{color:bdr,width:1}});
    sl13.addShape("rect",{x:0.5,y:y+0.21,w:0.3,h:0.3,fill:{color:c}});
    sl13.addText(n,{x:0.5,y:y+0.21,w:0.3,h:0.3,fontSize:10,bold:true,color:"FFFFFF",align:"center",valign:"middle",fontFace:"Calibri"});
    sl13.addText(t,{x:0.95,y:y+0.07,w:2.85,h:0.27,fontSize:10,bold:true,color:C.dark,fontFace:"Calibri"});
    sl13.addText(d,{x:0.95,y:y+0.38,w:2.85,h:0.26,fontSize:9,color:C.muted,fontFace:"Calibri"});
  });
  sl13.addText("Key Incidents & Near-Misses",{x:4.15,y:0.73,w:3.5,h:0.25,fontSize:9,bold:true,color:C.muted,fontFace:"Calibri"});
  H1.incidents.notable.forEach((ev,i)=>{
    const y=1.02+i*0.63; const bg=ev.ai?"fdf4ff":ev.tags.some(t=>t.includes("SIF"))?"fff7f7":"f8fafc";
    sl13.addShape("rect",{x:4.15,y,w:3.5,h:0.57,fill:{color:bg},line:{color:"e2e8f0",width:0.5}});
    const icon=ev.ai?"[AI]":ev.tags.some(t=>t.includes("SIF"))?"[SIF]":"";
    sl13.addText(`${icon} ${ev.title}`,{x:4.25,y:y+0.05,w:3.3,h:0.27,fontSize:9.5,bold:true,color:C.dark,fontFace:"Calibri"});
    sl13.addText(ev.tags.join("  ·  "),{x:4.25,y:y+0.34,w:3.3,h:0.18,fontSize:8,color:ev.ai?"7c3aed":C.muted,fontFace:"Calibri"});
  });
  sl13.addText("High-Risk Activities",{x:7.9,y:0.73,w:1.8,h:0.25,fontSize:9,bold:true,color:"7c3aed",fontFace:"Calibri"});
  ([["Crane lifts","HIGH",C.red],["Elec. work","HIGH",C.orange],["Confined space","HIGH",C.orange],["Chemical handling","MED",C.amber],["Work at height","MED",C.amber]] as [string,string,string][]).forEach(([t,r,c],i)=>{
    const y=1.02+i*0.78;
    sl13.addShape("rect",{x:7.9,y,w:1.8,h:0.72,fill:{color:"f8fafc"},line:{color:"e2e8f0",width:1}});
    sl13.addText(t,{x:8.0,y:y+0.07,w:1.6,h:0.28,fontSize:10,bold:true,color:C.dark,fontFace:"Calibri"});
    sl13.addText(r,{x:8.0,y:y+0.4,w:1.6,h:0.22,fontSize:9,bold:true,color:c,fontFace:"Calibri"});
  });

  // ── Slide 16 — NEXT STEPS ────────────────────────────────────────────────────
  const sl14 = pres.addSlide();
  hdr(sl14,"Next Steps & Priorities","Actions to carry forward from this review",16);
  sl14.addShape("rect",{x:0,y:0.65,w:10,h:4.63,fill:{color:C.navy}});
  ([
    ["🔴","SIF prevention — immediate","Targeted reviews of the 4 SIF hazard types: crane picks, arc flash, chemical exposure, work-at-height. Implement or verify engineered controls before next period."],
    ["📋","Weekly overdue-CA review","Establish a weekly standing agenda item to review the 6 overdue + 17 pending-verification CAs. Assign a CA owner for each item today."],
    ["📊","Populate hours worked","Log total hours worked per period to unlock TRIR and DART rate calculations automatically. Without this, rate-based benchmarking cannot be reported."],
    ["🎓","Load training & audit records","Populate jobsite audit scores and employee training-completion records before the next management review. Mandatory ISO 45001 metrics currently showing as data gaps."],
  ] as [string,string,string][]).forEach(([ic,t,d],i)=>{
    const x=0.4+(i%2)*4.85; const y=0.83+Math.floor(i/2)*2.1;
    sl14.addShape("rect",{x,y,w:4.55,h:1.95,fill:{color:"162744"},line:{color:"1e3a5f",width:0.5}});
    sl14.addText(ic,{x:x+0.15,y:y+0.14,w:0.5,h:0.5,fontSize:18,fontFace:"Calibri"});
    sl14.addText(t, {x:x+0.15,y:y+0.67,w:4.22,h:0.3,fontSize:11,bold:true,color:C.white,fontFace:"Calibri"});
    sl14.addText(d, {x:x+0.15,y:y+1.03,w:4.22,h:0.78,fontSize:9.5,color:"aaaaaa",fontFace:"Calibri"});
  });

  // ── Agenda summary in footer of last slide ───────────────────────────────────
  const agendaCovered = `${checkedItems.size}/${AGENDA_ITEMS.length} agenda items reviewed`;
  sl14.addText(agendaCovered,{x:0.4,y:5.33,w:4,h:0.18,fontSize:7.5,color:C.faint,fontFace:"Calibri"});

  await pres.writeFile({ fileName: `safepredict-review-${REVIEW_SLUG}-${new Date().toISOString().split("T")[0] ?? "export"}.pptx` });
}
