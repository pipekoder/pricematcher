export const progressStages=["channel3","agent-a","agent-b","policy","authorization"] as const;
export type ProgressStage=typeof progressStages[number];
export type ProgressStatus="pending"|"running"|"completed"|"failed"|"skipped";
export type ProgressEvent={stage:ProgressStage;status:Exclude<ProgressStatus,"pending">;elapsedMs:number;offerCount?:number;category?:"unavailable"|"invalid"|"budget"|"timeout"};
export type ProgressReporter=(event:ProgressEvent)=>void;
