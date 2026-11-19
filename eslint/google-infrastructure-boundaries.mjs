import { noDynamicServerBypass } from "./orders-boundaries.mjs";

const auth="src/infrastructure/external/google-auth/", drive="src/infrastructure/files/google-drive/";
const imports={
 [auth+"GoogleAccessTokenProvider.ts"]:["./const","./types"],
 [auth+"GoogleOAuthRefreshTokenAuth.ts"]:["./GoogleAccessTokenProvider","./types"],
 [auth+"GoogleServiceAccountAuth.ts"]:["./const","./types","./GoogleAccessTokenProvider","./utils/jwt"],
 [auth+"const.ts"]:[],[auth+"types.ts"]:[],
 [auth+"utils/jwt.ts"]:["node:crypto"],
 [drive+"GoogleDriveService.ts"]:["./const","./types"],
 [drive+"createGoogleDriveServiceFromConfig.ts"]:["../../../config","../../external/google-auth/GoogleOAuthRefreshTokenAuth","../../external/google-auth/GoogleServiceAccountAuth","../../external/google-auth/types","./const","./GoogleDriveService"],
 [drive+"types.ts"]:["../../external/google-auth/types"],
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
