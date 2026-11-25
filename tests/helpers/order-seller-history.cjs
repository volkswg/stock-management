/* eslint-disable @typescript-eslint/no-require-imports -- Hash-bound historical test source, never a runtime fallback. */
const fs=require('node:fs'),{createHash}=require('node:crypto'),assert=require('node:assert/strict');
exports.beforeSeller=(name,data=fs.existsSync(name)?fs.readFileSync(name):null)=>{
 const cleanup=JSON.parse(fs.readFileSync('tests/fixtures/raw-test-evidence-before.json')).edits[name];
 if(cleanup){
  const hash=value=>createHash('sha256').update(value).digest('hex');assert.equal(data===null?null:hash(data),cleanup.afterSha256,name);
  const lines=data.toString().split(/(?<=\n)/);for(const delta of [...cleanup.inverse].reverse())lines.splice(delta.start,delta.count,delta.before);
  data=Buffer.from(lines.join(''));assert.equal(hash(data),cleanup.beforeSha256,name);
 }
 const edit=JSON.parse(fs.readFileSync('tests/fixtures/order-seller-before.json')).edits[name];if(!edit)return data;
 const hash=value=>createHash('sha256').update(value).digest('hex');assert.equal(data===null?null:hash(data),edit.afterSha256,name);
 const lines=data.toString().split(/(?<=\n)/);for(const delta of [...edit.inverse].reverse())lines.splice(delta.start,delta.count,delta.before);
 const before=Buffer.from(lines.join(''));assert.equal(hash(before),edit.beforeSha256,name);return before;
};
