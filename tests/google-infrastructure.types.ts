import type * as Legacy from "@/infrastructure/persistence/google-sheets/service-contracts";
import type * as Root from "../src/infrastructure/persistence/google-sheets/types";
import { GoogleSheetsClient as OldClient } from "@/infrastructure/persistence/google-sheets/client/index";
import { GoogleSheetsClient as NewClient } from "../src/infrastructure/persistence/google-sheets/client";
import { GoogleServiceAccountAuth as OldAuth } from "@/infrastructure/persistence/google-sheets/google-auth/GoogleServiceAccountAuth";
import { GoogleServiceAccountAuth as NewAuth } from "../src/infrastructure/persistence/google-sheets/google-auth/GoogleServiceAccountAuth";
import { GoogleDriveService as OldDrive, createGoogleDriveServiceFromConfig as oldFactory } from "@/infrastructure/files/google-drive/index";
import { GoogleDriveService as NewDrive, createGoogleDriveServiceFromConfig as newFactory } from "../src/infrastructure/files/google-drive";
type Equal<A,B> = (<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true> = T;
export type Compatibility = [
 Assert<Equal<Legacy.GoogleSheetCellValue,Root.GoogleSheetCellValue>>,
 Assert<Equal<Legacy.GoogleSheetRow,Root.GoogleSheetRow>>,
 Assert<Equal<Legacy.GoogleSheetRangeUpdate,Root.GoogleSheetRangeUpdate>>,
 Assert<Equal<Legacy.IGoogleSheet,Root.IGoogleSheet>>,
 Assert<Equal<Legacy.IGoogleRowsSheet,Root.IGoogleRowsSheet>>,
 Assert<Equal<Legacy.IGoogleBatchRowsSheet,Root.IGoogleBatchRowsSheet>>,
 Assert<Equal<typeof OldClient,typeof NewClient>>,
 Assert<Equal<OldClient,NewClient>>,
 Assert<Equal<typeof OldAuth,typeof NewAuth>>,
 Assert<Equal<OldAuth,NewAuth>>,
 Assert<Equal<typeof OldDrive,typeof NewDrive>>,
 Assert<Equal<OldDrive,NewDrive>>,
 Assert<Equal<typeof oldFactory,typeof newFactory>>
];
