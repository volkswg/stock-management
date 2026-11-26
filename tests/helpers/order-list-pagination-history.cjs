/* eslint-disable @typescript-eslint/no-require-imports -- Hash-bound historical test source, never a runtime fallback. */
const fs=require('node:fs'),{createHash}=require('node:crypto'),assert=require('node:assert/strict');
exports.beforeOrderPagination=(name,data=fs.existsSync(name)?fs.readFileSync(name):null)=>{
 const mobile=JSON.parse(fs.readFileSync('tests/fixtures/mobile-order-pagination-before.json')).edits[name];
 if(mobile){
  const hash=value=>createHash('sha256').update(value).digest('hex');assert.equal(data===null?null:hash(data),mobile.afterSha256,name);
  const lines=data.toString().split(/(?<=\n)/);for(const delta of [...mobile.inverse].reverse())lines.splice(delta.start,delta.count,delta.before);
  data=Buffer.from(lines.join(''));assert.equal(hash(data),mobile.beforeSha256,name);
 }
 const persistence=JSON.parse(fs.readFileSync('tests/fixtures/order-page-size-persistence-before.json')).edits[name];
 if(persistence){
  const hash=value=>createHash('sha256').update(value).digest('hex');assert.equal(data===null?null:hash(data),persistence.afterSha256,name);
  const lines=data.toString().split(/(?<=\n)/);for(const delta of [...persistence.inverse].reverse())lines.splice(delta.start,delta.count,delta.before);
  data=Buffer.from(lines.join(''));assert.equal(hash(data),persistence.beforeSha256,name);
 }
 const sizeEdit=JSON.parse(fs.readFileSync('tests/fixtures/order-page-size-before.json')).edits[name];
 if(sizeEdit){
  const hash=value=>createHash('sha256').update(value).digest('hex');assert.equal(hash(data),sizeEdit.afterSha256,name);
  const lines=data.toString().split(/(?<=\n)/);for(const delta of [...sizeEdit.inverse].reverse())lines.splice(delta.start,delta.count,delta.before);
  data=Buffer.from(lines.join(''));assert.equal(hash(data),sizeEdit.beforeSha256,name);
 }
 const edit=JSON.parse(fs.readFileSync('tests/fixtures/order-list-pagination-before.json')).edits[name];if(!edit)return data;
 const hash=value=>createHash('sha256').update(value).digest('hex');assert.equal(data===null?null:hash(data),edit.afterSha256,name);
 const lines=data.toString().split(/(?<=\n)/);for(const delta of [...edit.inverse].reverse())lines.splice(delta.start,delta.count,delta.before);
 const before=Buffer.from(lines.join(''));assert.equal(hash(before),edit.beforeSha256,name);return before;
};
