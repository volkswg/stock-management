import "server-only";
import { executeCommand, hashIntent } from "@/infrastructure/persistence/postgres/commands";
import { executeUploadCommand, observeUpload } from "@/infrastructure/persistence/postgres/uploads";
import { attemptEffectOnce } from "@/infrastructure/persistence/postgres/effects";
import { requireMutation, PersistenceFailure } from "@/infrastructure/persistence/postgres/database";
import { processWebhookEvents } from "../../application/webhook";
import type { LineReplyMessage } from "@/shared/types/line-protocol";

export async function processPostgresWebhook<Bytes>(input: Parameters<typeof processWebhookEvents<Bytes>>[0]) {
  type Result = Awaited<ReturnType<typeof processWebhookEvents<Bytes>>>;
  type Counts = ReturnType<Result['imageCounts']>;
  type EventResult = { movementFailed: boolean; counts: Counts; images: Result['imageUploads']; replies: Array<{ token: string | undefined; messages: LineReplyMessage[] }> };
  class RolledBackEvent extends Error {
    constructor(readonly result: EventResult) { super("LINE business work was rolled back."); }
  }
  const counts: Counts = { scope:"movement",received:0,routedToMovement:0,otherFlows:0,unprocessed:0,failedBeforeRouting:0,uploaded:0,saved:0,alreadySaved:0,completed:0,failed:0,ignored:0,saveUncertain:0 };
  const imageUploads: Result['imageUploads'] = [];
  let movementFailed=false;
  for (const event of input.events || []) {
    const key=event.webhookEventId;
    if (!key) throw new PersistenceFailure(428,"LINE webhookEventId is required for PostgreSQL persistence.");
    // Reply tokens and redelivery flags may change; the durable event intent may not.
    const intent=Object.fromEntries(Object.entries(event).filter(([name])=>!["replyToken","deliveryContext"].includes(name)));
    const execute=event.message?.type === "image" ? executeUploadCommand : executeCommand;
    let result: EventResult;
    try { result=await execute("LINE",key,hashIntent(intent),async () => {
      await requireMutation().query("SAVEPOINT event_business");
      const replies: Array<{token: string | undefined; messages: LineReplyMessage[]}> = [];
      let failed=false;
      const run=await processWebhookEvents<Bytes>({ ...input,events:[event],
        getImages:()=>{
          const drive=input.getImages();
          if (!drive) return undefined;
          return { uploadImage:upload=>observeUpload(()=>drive.uploadImage(upload),async id=>{
            const cleanup=drive as typeof drive & { deleteFile?: (id:string)=>Promise<void> };
            if (!cleanup.deleteFile) throw new PersistenceFailure(503,"Upload cleanup requires reconciliation.");
            await cleanup.deleteFile(id);
          }) };
        },
        lineBotService: { downloadMessageContent:id=>input.lineBotService.downloadMessageContent(id),sendReply:async (token,messages)=>{replies.push({token,messages});} },
        runtime:{ ...input.runtime,error:(label,details)=>{failed=true;input.runtime.error(label,details);} },
      });
      if (failed || run.movementFailed || run.imageUploads.some(image=>image.failed || image.saveUncertain)) {
        await requireMutation().query("ROLLBACK TO SAVEPOINT event_business");
        for (const image of run.imageUploads) { image.saved=false; image.completed=false; image.failed=true; }
        // Roll back the command as well as its business rows, then preserve the
        // existing failed-batch counters outside that transaction. Failure
        // replies are not claimed under the later successful event's effect key.
        throw new RolledBackEvent({ movementFailed:true, counts:run.imageCounts(), images:run.imageUploads, replies:[] });
      }
      await requireMutation().query("RELEASE SAVEPOINT event_business");
      return { movementFailed:run.movementFailed, counts:run.imageCounts(),images:run.imageUploads,replies };
    }); } catch (error) {
      if (!(error instanceof RolledBackEvent)) throw error;
      result=error.result;
    }
    for (const [index,reply] of result.replies.entries()) {
      await attemptEffectOnce(`LINE:${key}:reply:${index}`,()=>input.lineBotService.sendReply(reply.token,reply.messages));
    }
    imageUploads.push(...result.images);
    for (const name of Object.keys(counts) as Array<keyof Counts>) if (name!=="scope") counts[name]+=result.counts[name];
    movementFailed ||= result.movementFailed;
    if (movementFailed) break;
  }
  const received=(input.events || []).filter(event=>event.message?.type === "image").length;
  counts.unprocessed += received-counts.received;
  counts.received=received;
  return { movementFailed,imageCounts:()=>counts,imageUploads };
}
