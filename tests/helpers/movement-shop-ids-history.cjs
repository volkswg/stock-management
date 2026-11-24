/* eslint-disable @typescript-eslint/no-require-imports -- Exact test-only source inverse, never runtime fallback. */
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
exports.beforeMovementShopIds=(name,data=fs.existsSync(name)?fs.readFileSync(name):null)=>{
 data=require('./order-seller-history.cjs').beforeSeller(name,data);
 const edit=JSON.parse(fs.readFileSync('tests/fixtures/movement-shop-ids-before.json')).edits[name];if(!edit)return data;
 const hash=value=>crypto.createHash('sha256').update(value).digest('hex');assert.equal(data===null?null:hash(data),edit.afterSha256,name);assert.equal(hash(edit.before),edit.beforeSha256,name);return Buffer.from(edit.before);
};
