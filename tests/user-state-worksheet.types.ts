import type { UserStateSheet as Physical } from '../src/modules/line-workflows/infrastructure/google-sheets/user-state/UserStateSheet';
import type { UserStateSheet as Legacy } from "@/modules/line-workflows/infrastructure/google-sheets/user-state/UserStateSheet";
import type { UserStateSheet as Index } from "@/modules/line-workflows/infrastructure/google-sheets/user-state/UserStateSheet";
import type { UserStateSheet as Public } from "@/modules/line-workflows/infrastructure/google-sheets/user-state/UserStateSheet";
import type { USER_STATE_SHEET_HEADERS as Headers } from '../src/modules/line-workflows/infrastructure/google-sheets/user-state/const';
import type { USER_STATE_SHEET_HEADERS as LegacyHeaders } from "@/modules/line-workflows/infrastructure/google-sheets/user-state/const";
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true> = T;
export type UserStateCompatibility = [Assert<Equal<Physical,Legacy>>,Assert<Equal<typeof Physical,typeof Legacy>>,Assert<Equal<typeof Physical,typeof Index>>,Assert<Equal<typeof Physical,typeof Public>>,Assert<Equal<typeof Headers,typeof LegacyHeaders>>,Assert<Equal<Parameters<Physical['deleteRow']>,[rowNumber:number]>>,Assert<Equal<ReturnType<Physical['deleteRow']>,Promise<void>>>];
