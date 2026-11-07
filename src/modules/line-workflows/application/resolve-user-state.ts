import type { LineEvent } from "@/shared/types/line-protocol";
import type { UserStateFlowName, UserState } from "../contracts";
import type { WorkflowContext } from "./ports/workflows";
export async function resolveUserState({ event, flowname, getContext, resolvedUserStates, }: {
    event: LineEvent;
    flowname: UserStateFlowName;
    getContext: () => WorkflowContext;
    resolvedUserStates: Map<LineEvent, UserState>;
}): Promise<UserState | undefined> {
    const resolvedUserState = resolvedUserStates.get(event);
    if (resolvedUserState?.flowname === flowname) {
        return resolvedUserState;
    }
    const lineUserId = event.source?.userId;
    if (!lineUserId) {
        return undefined;
    }
    const latestUserState = await getContext().sessions.findLatest(lineUserId, flowname);
    if (latestUserState) {
        resolvedUserStates.set(event, latestUserState);
    }
    return latestUserState;
}
