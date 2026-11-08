import {relative,resolve} from 'node:path';

const retired=specifier=>/(?:^|\/)features(?:\/|$)|^@\/feature(?:\/|$)/.test(specifier);
function literal(node){
  if(typeof node?.value==='string')return node.value;
  if(node?.type==='BinaryExpression'&&node.operator==='+'){
    const left=literal(node.left),right=literal(node.right);
    if(left!==undefined&&right!==undefined)return left+right;
  }
  if(node?.type==='TemplateLiteral'&&node.expressions.length===0)return node.quasis[0].value.cooked;
}
const rule={meta:{schema:[]},create(context){
  function check(node,value){if(typeof value==='string'&&retired(value.replaceAll('\\','/')))context.report({node,message:'The features compatibility directory is retired; use canonical modules or shared owners.'});}
  return {
    Program(node){if(relative(process.cwd(),resolve(context.filename)).replaceAll('\\','/').startsWith('src/features/'))context.report({node,message:'Do not recreate the retired features directory.'});},
    ImportDeclaration:node=>check(node,node.source.value),ExportNamedDeclaration:node=>check(node,node.source?.value),ExportAllDeclaration:node=>check(node,node.source.value),
    ImportExpression:node=>check(node,literal(node.source)),TSImportType:node=>check(node,node.argument?.literal?.value??node.argument?.value),
    TSImportEqualsDeclaration:node=>check(node,node.moduleReference?.expression?.value),
    CallExpression(node){if(node.callee.name==='require'||node.callee.object?.name==='require'&&(node.callee.property?.name??node.callee.property?.value)==='resolve')check(node,literal(node.arguments[0]));},
  };
}};
export const featuresRetirementBoundaries=[
  {plugins:{'features-retirement':{rules:{imports:rule}}}},
  {files:['src/**/*.{ts,tsx,mts,js,mjs}','tests/**/*.{ts,tsx,mts,mjs,js}'],rules:{'features-retirement/imports':'error'}},
];
