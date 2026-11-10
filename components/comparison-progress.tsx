"use client";

import { useEffect,useState } from "react";
import { progressStages,type ProgressEvent,type ProgressStage } from "@/lib/ai-offers/progress";

const labels:Record<ProgressStage,{name:string;activity:string}>={
  channel3:{name:"Channel3 API",activity:"Searching competitor product offers"},
  "agent-a":{name:"Meta Muse Spark 1.3 — Agent A",activity:"Analyzing inventory, sales and pricing strategy"},
  "agent-b":{name:"Meta Muse Spark 1.3 — Agent B",activity:"Generating a competitive offer"},
  policy:{name:"Deal Engine Policy Validator",activity:"Checking merchant pricing rules and offer eligibility"},
  authorization:{name:"Deal Engine",activity:"Preparing the authorized offer"},
};
export const elapsedText=(ms:number)=>`${String(Math.floor(ms/60000)).padStart(2,"0")}:${String(Math.floor(ms/1000)%60).padStart(2,"0")}`;

export function ComparisonProgress({startedAt,finishedAt,events,running,outcome}:{startedAt:number;finishedAt?:number;events:ProgressEvent[];running:boolean;outcome?:"completed"|"fallback"|"failed"}){
  const [elapsed,setElapsed]=useState(()=>Date.now()-startedAt);
  useEffect(()=>{if(!running)return;const tick=()=>setElapsed(Math.max(0,Date.now()-startedAt));tick();const timer=window.setInterval(tick,1000);return()=>window.clearInterval(timer);},[startedAt,running]);
  const last=events.at(-1);
  const duration=running?elapsed:Math.max(0,(finishedAt??startedAt+elapsed)-startedAt,last?.elapsedMs??0);
  return <section className="deal-progress" aria-label="Deal Engine execution progress" aria-live="polite">
    <strong>{running?"Deal Engine is working":outcome==="completed"?`Deal Engine completed · ${elapsedText(duration)}`:outcome==="fallback"?"Deal Engine finished · Original price remains available":"Deal Engine status unavailable"}</strong>
    <p>Analyzing your best offer · {elapsedText(duration)} elapsed</p>
    <div className="deal-progress-track" role="progressbar" aria-label="Deal Engine running" aria-valuetext={running?"In progress":outcome??"Status unavailable"}><span className={running?"deal-progress-indeterminate":"deal-progress-finished"}/></div>
    <ol className="deal-progress-stages">{progressStages.map(stage=>{const event=[...events].reverse().find(item=>item.stage===stage);return <li key={stage} data-status={event?.status??"pending"}><span>{labels[stage].name}</span><small>{event?.status??"pending"} · {labels[stage].activity}</small></li>;})}</ol>
    <strong className="deal-progress-activity">Activity</strong>
    <ol className="deal-progress-log">{events.map((event,index)=><li key={`${event.stage}-${event.status}-${index}`}><time>{elapsedText(event.elapsedMs)}</time> — {labels[event.stage].name} · {event.status}{event.offerCount!==undefined?` · ${event.offerCount} market offers`:""}{event.category?` · ${event.category}`:""}</li>)}</ol>
  </section>;
}
