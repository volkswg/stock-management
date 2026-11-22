/* eslint-disable @typescript-eslint/no-require-imports -- Test-only immutable predecessor reconstruction; never runtime compatibility. */
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
exports.beforeProductUat=(name,data=fs.existsSync(name)?fs.readFileSync(name):null)=>{
 data=require('./connection-pooling-history.cjs').beforePooling(name,data);
 const edit=JSON.parse(fs.readFileSync('tests/fixtures/product-master-uat-before.json')).edits[name];
 if(!edit)return data;
 const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
 assert.equal(data===null?null:hash(data),edit.afterSha256,name);
 assert.equal(hash(edit.before),edit.beforeSha256,name);
 return Buffer.from(edit.before);
};
