import {dirname, relative, resolve} from 'node:path';
import {noDynamicServerBypass} from './orders-boundaries.mjs';

const composition='src/composition/loyverse-accounts.ts';
const reader='src/infrastructure/configuration/google-sheets/loyverse-accounts.ts';
const config='src/config/index.ts';
const legacy='src/infrastructure/external/loyverse/createLoyverseServiceFromConfig.ts';
const metadata='src/shared/types/loyverse-account.ts';
const property=node=>node?.computed?node.property?.value:node?.property?.name;
const rule={meta:{schema:[]},create(context){
  const file=relative(process.cwd(),context.filename).replaceAll('\\','/');
  function check(node,spec){
    if(typeof spec!=='string')return;
    const target=spec.startsWith('@/')?resolve('src',spec.slice(2)):spec.startsWith('.')?resolve(dirname(context.filename),spec):undefined;
    if(target&&relative(process.cwd(),target).replaceAll('\\','/').replace(/\.ts$/,'')===reader.slice(0,-3)&&file!==composition){
      context.report({node,message:'Private credential storage is accessible only through server account composition.'});
    }
  }
  return {
    Program(node){
      if([composition,reader].includes(file)&&!node.body.some(n=>n.type==='ImportDeclaration'&&n.source.value==='server-only'))context.report({node,message:'Account storage and credential composition require server-only.'});
      if(file===metadata){
        const statement=node.body[0],alias=statement?.declaration,members=alias?.typeAnnotation?.members;
        if(node.body.length!==1||statement?.type!=='ExportNamedDeclaration'||alias?.type!=='TSTypeAliasDeclaration'||alias.id.name!=='LoyverseAccountMetadata'||members?.length!==2||!members.every((member,index)=>member.type==='TSPropertySignature'&&member.key.name===['id','shopName'][index]&&!member.optional&&member.typeAnnotation?.typeAnnotation?.type==='TSStringKeyword'))context.report({node,message:'Public account metadata contains exactly id and shopName string fields.'});
      }
    },
    MemberExpression(node){
      if(property(node)==='accounts'&&property(node.object)==='loyverse'&&![config,composition,legacy].includes(file))context.report({node,message:'Use the account metadata reader; never read credential-bearing configuration in consumers.'});
      if(/^LOYVERSE_(?:ACCOUNT_SOURCE|ACCOUNTS_JSON|ACCOUNTS_SPREADSHEET_ID)$/.test(String(property(node)))&&file!==config)context.report({node,message:'Read account environment settings only through server configuration.'});
    },
    ImportDeclaration(node){check(node,node.source.value);if(node.specifiers.some(s=>s.imported?.name==='createLoyverseAccountsFromConfig'))context.report({node,message:'Active consumers use the asynchronous server account reader, supporting both sources.'});},
    ExportNamedDeclaration:node=>check(node,node.source?.value),ExportAllDeclaration:node=>check(node,node.source.value),
    ImportExpression:node=>check(node,node.source?.value),TSImportType:node=>check(node,node.argument?.literal?.value??node.argument?.value),
    TSImportEqualsDeclaration:node=>check(node,node.moduleReference?.expression?.value),
    CallExpression(node){if(node.callee.name==='require')check(node,node.arguments[0]?.value);},
  };
}};
const only=paths=>['error',{patterns:[{regex:`^(?!(?:${paths.map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})$).+`,message:'Keep private account dependencies explicit and server-owned.'}]}];
export const loyverseAccountsBoundaries=[
  {plugins:{'loyverse-accounts':{rules:{boundary:rule}}}},
  {files:['src/**/*.{ts,tsx,mts}'],rules:{'loyverse-accounts/boundary':'error'}},
  {files:[composition],rules:{'no-restricted-imports':only(['server-only','@/config','@/shared/types/loyverse-account','@/infrastructure/persistence/google-sheets/google-auth/GoogleServiceAccountAuth','@/infrastructure/persistence/google-sheets/client/GoogleSheetsClient','@/infrastructure/configuration/google-sheets/loyverse-accounts','@/infrastructure/external/loyverse']),'no-restricted-syntax':[...noDynamicServerBypass,{selector:'ExportAllDeclaration',message:'Expose only named account operations.'}],'no-restricted-globals':['error','process','console','fetch']}},
  {files:[reader],rules:{'no-restricted-imports':only(['server-only','@/config','@/infrastructure/persistence/google-sheets/client/GoogleSheetsClient']),'no-restricted-syntax':[...noDynamicServerBypass,{selector:"ImportDeclaration[source.value!='server-only']:not([importKind='type'])",message:'The reader receives its read-only Sheets client.'}],'no-restricted-globals':['error','process','console','fetch']}},
  {files:[metadata],rules:{'no-restricted-imports':only([]),'no-restricted-syntax':[...noDynamicServerBypass,{selector:'ExportAllDeclaration',message:'Account metadata is an erased DTO only.'},{selector:'ExportNamedDeclaration[declaration.type!="TSTypeAliasDeclaration"]',message:'Account metadata contains no runtime credentials or values.'}] }},
];
