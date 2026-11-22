/* eslint-disable @typescript-eslint/no-require-imports -- Local test process preload only. */
// Preloaded only by the disposable local UAT launcher, never runtime production.
const allowed=url=>['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname);
const original=global.fetch;
global.fetch=(input,options)=>{const url=typeof input==='string'||input instanceof URL?input:input.url;if(!allowed(url))throw Error('External provider access is disabled in local UAT');return original(input,options);};
for(const name of ['http','https']){
 const transport=require('node:'+name),request=transport.request;
 transport.request=function(input,...args){const host=typeof input==='string'||input instanceof URL?new URL(input).hostname:input.hostname||input.host;if(!['localhost','127.0.0.1','::1'].includes(host))throw Error('External provider access is disabled in local UAT');return request.call(this,input,...args);};
 transport.get=function(...args){const req=this.request(...args);req.end();return req;};
}
