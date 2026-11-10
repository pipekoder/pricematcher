import { progressStages, type ProgressEvent } from "./progress";

export async function readComparisonStream<T>(response:Response,onProgress:(event:ProgressEvent)=>void):Promise<T>{
  if(!response.ok||!response.body)throw new Error("comparison_stream_unavailable");
  const reader=response.body.getReader();
  const decoder=new TextDecoder();
  let buffer="";let result:T|undefined;
  const consume=(block:string)=>{
    const lines=block.split("\n");const name=lines.find(line=>line.startsWith("event: "))?.slice(7);
    const payload=lines.find(line=>line.startsWith("data: "))?.slice(6);
    if(!payload)return;
    const data=JSON.parse(payload) as unknown;
    if(name==="progress"&&data&&typeof data==="object"){
      const event=data as ProgressEvent;
      if(progressStages.includes(event.stage)&&["running","completed","failed","skipped"].includes(event.status)&&Number.isFinite(event.elapsedMs))onProgress(event);
    }else if(name==="result")result=data as T;
    else if(name==="error")throw new Error("comparison_failed");
  };
  try{
    while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let end=buffer.indexOf("\n\n");while(end>=0){consume(buffer.slice(0,end));buffer=buffer.slice(end+2);end=buffer.indexOf("\n\n");}}
    if(result===undefined)throw new Error("comparison_interrupted");
    return result;
  }finally{reader.releaseLock();}
}
