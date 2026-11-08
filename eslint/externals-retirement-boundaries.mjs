import {resolve,relative} from 'node:path';
const legacy = spec => /(?:^|\/)externals(?:\/|$)/.test(spec);
function literal(node) {
 if (typeof node?.value === 'string') return node.value;
 if (node?.type === 'BinaryExpression' && node.operator === '+') {
  const left = literal(node.left), right = literal(node.right);
  if (left !== undefined && right !== undefined) return left + right;
 }
 if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
}
const forbidden = {meta:{schema:[]},create(context){
 function check(node,value){if(typeof value==='string'&&legacy(value))context.report({node,message:'The retired external namespace has no live modules; import canonical infrastructure, contracts or composition.'});}
 return {
  Program(node){const path=relative(process.cwd(),resolve(context.filename)).replaceAll('\\','/');if(path.startsWith('src/externals/'))context.report({node,message:'The retired directory must not be recreated.'});},
  ImportDeclaration:n=>check(n,n.source.value),ExportNamedDeclaration:n=>check(n,n.source?.value),ExportAllDeclaration:n=>check(n,n.source.value),
  ImportExpression:n=>check(n,literal(n.source)),TSImportType:n=>check(n,n.argument?.literal?.value??n.argument?.value),
  TSImportEqualsDeclaration:n=>check(n,n.moduleReference?.expression?.value),
  CallExpression(n){if(n.callee.name==='require'||n.callee.object?.name==='require'&&n.callee.property?.name==='resolve')check(n,literal(n.arguments[0]));},
 };
}};
const pure = {meta:{schema:[]},create(context){return {Program(node){for(const statement of node.body){
 const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
 const allowed = ['TSInterfaceDeclaration','TSTypeAliasDeclaration'].includes(declaration?.type)
  || statement.type === 'ImportDeclaration' && statement.importKind === 'type' && statement.specifiers.every(s=>s.type==='ImportSpecifier')
  || statement.type === 'ExportNamedDeclaration' && statement.exportKind === 'type' && !statement.declaration;
 if(!allowed)context.report({node:statement,message:'Service contracts contain only erased named types and interfaces.'});
}},ImportExpression(node){context.report({node,message:'Service contracts cannot load providers.'});},TSImportType(node){context.report({node,message:'Use the explicit generic row type import only.'});}};}};
export const externalsRetirementBoundaries=[{plugins:{retirement:{rules:{'no-legacy-import':forbidden,'pure-service-contracts':pure}}}},
 {files:['src/**/*.{ts,tsx,mts,js,mjs}','tests/**/*.{ts,mjs,mts,js}'],rules:{'retirement/no-legacy-import':'error'}},
 {files:['src/infrastructure/persistence/google-sheets/service-contracts.ts'],rules:{
  'retirement/pure-service-contracts':'error',
  'no-restricted-imports':['error',{patterns:[{regex:'^(?!@/infrastructure/persistence/google-sheets/types$).+',message:'Service contracts are pure and depend only on generic row protocols.'}]}],
  'no-restricted-globals':['error','process','Buffer','fetch','Date'],
 }},
];
