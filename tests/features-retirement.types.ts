import type { LegacyMovementEventClassification as MovementEventClassification, LegacyLineEventClassification as LineEventClassification, classifyLineEvent, handleMovementEvent } from "../src/modules/line-workflows/server";
import type { MovementImageUploadProgress } from "../src/modules/line-workflows/contracts";
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
export type RetiredTypeContracts=[
  Assert<Equal<Awaited<ReturnType<typeof classifyLineEvent>>,LineEventClassification>>,
  Assert<Equal<Parameters<typeof handleMovementEvent>[0]['event'],MovementEventClassification['event']>>,
  Assert<Equal<Parameters<typeof handleMovementEvent>[0]['session'],MovementEventClassification['session']>>,
  Assert<Equal<Exclude<Parameters<typeof handleMovementEvent>[0]['imageUpload'],undefined>,MovementImageUploadProgress>>,
];
