import type { MovementJourneyItem, MovementJourneyMaster } from "../../contracts";
export type MovementJourneyMasterReference = MovementJourneyMaster;
export interface MovementJourneySnapshot {
    findMaster(readId: () => string): MovementJourneyMasterReference | undefined;
    items(readId: () => string | undefined): MovementJourneyItem[];
}
export interface MovementJourneyStore {
    readCombined(): Promise<MovementJourneySnapshot>;
    readMasters(): Promise<MovementJourneyMasterReference[]>;
    readItems(masterId: string): Promise<MovementJourneyItem[]>;
    appendItem(readItem: () => MovementJourneyItem): Promise<void>;
    appendMaster(value: MovementJourneyMaster): Promise<void>;
    updateMaster(target: MovementJourneyMasterReference, value: MovementJourneyMaster): Promise<void>;
}
