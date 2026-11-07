import { noDynamicServerBypass } from "./orders-boundaries.mjs";

const sheets="src/infrastructure/persistence/google-sheets/", drive="src/infrastructure/files/google-drive/";
const imports={
 [sheets+"google-auth/GoogleAccessTokenProvider.ts"]:["./const","./types"],
 [sheets+"google-auth/GoogleOAuthRefreshTokenAuth.ts"]:["./GoogleAccessTokenProvider","./types"],
 [sheets+"google-auth/GoogleServiceAccountAuth.ts"]:["./const","./types","./GoogleAccessTokenProvider","./utils/jwt"],
 [sheets+"google-auth/const.ts"]:[],[sheets+"google-auth/types.ts"]:[],
 [sheets+"google-auth/utils/jwt.ts"]:["node:crypto"],
 [sheets+"client/GoogleSheetsClient.ts"]:["../const","../google-auth/GoogleServiceAccountAuth","../types"],
 [sheets+"client/index.ts"]:["./GoogleSheetsClient"],
 [sheets+"sheets/RecordsSheet.ts"]:["./BaseGoogleSheet","../types"],
 [sheets+"sheets/BaseGoogleSheet.ts"]:["../client","../types"],
 [sheets+"const.ts"]:[],[sheets+"types.ts"]:[],
 [drive+"GoogleDriveService.ts"]:["./const","./types"],
 [drive+"createGoogleDriveServiceFromConfig.ts"]:["../../../config","../../persistence/google-sheets/google-auth/GoogleOAuthRefreshTokenAuth","../../persistence/google-sheets/google-auth/GoogleServiceAccountAuth","../../persistence/google-sheets/google-auth/types","./const","./GoogleDriveService"],
 [drive+"types.ts"]:["../../persistence/google-sheets/google-auth/types"],
 [drive+"const.ts"]:[],
 [drive+"index.ts"]:["./GoogleDriveService","./createGoogleDriveServiceFromConfig","./const","./types"],
};
export const googleInfrastructureBoundaries=Object.entries(imports).map(([file,paths])=>({
 files:[file],rules:{
  "no-restricted-imports":["error",{patterns:[{regex:paths.length?`^(?!(?:${paths.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|")})$).+`:".+",message:"Root Google infrastructure uses only its explicit transport dependencies; no legacy or feature implementations."}]}],
  "no-restricted-syntax":[...noDynamicServerBypass,
   {selector:"ExportAllDeclaration",message:"Keep named compatibility exports."},
   {selector:"ImportDeclaration[source.value='../../../config']:not([importKind='type'])",message:"Configuration is an erased factory input type only."},
  ],
  "no-restricted-globals":["error","process"],
 }
}));
