/* eslint-disable @typescript-eslint/no-require-imports -- Hash-pinned source inverse for earlier immutable witnesses only. */
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
exports.beforeBillIdentity=(name,data=fs.existsSync(name)?fs.readFileSync(name):null)=>{
 const hash=v=>crypto.createHash('sha256').update(v).digest('hex');
 const session=JSON.parse(fs.readFileSync('tests/fixtures/user-state-identity-before.json')).edits[name];
 if(session){assert.equal(data===null?null:hash(data),session.afterSha256,name);assert.equal(hash(session.before),session.beforeSha256,name);data=Buffer.from(session.before);}
 const latest=JSON.parse(fs.readFileSync('tests/fixtures/bill-revision-before.json')).edits[name];
 if(latest){assert.equal(data===null?null:hash(data),latest.afterSha256,name);assert.equal(hash(latest.before),latest.beforeSha256,name);data=Buffer.from(latest.before);}
 const edit=JSON.parse(fs.readFileSync('tests/fixtures/bill-identity-before.json')).edits[name];
 if(!edit)return data;
 assert.equal(data===null?null:hash(data),edit.afterSha256,name);assert.equal(hash(edit.before),edit.beforeSha256,name);
 return Buffer.from(edit.before);
};
