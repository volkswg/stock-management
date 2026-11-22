// Disposable LOCAL UAT access adapter only. Never deployed or imported by the app.
import http from 'node:http';
const [listenPort,upstreamPort]=process.argv.slice(2).map(Number);
if(![listenPort,upstreamPort].every(p=>Number.isInteger(p)&&p>1024&&p<65536)||!process.env.STOCK_STAGING_AUTH_TOKEN)throw Error('Local UAT settings required');
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="300" height="220"><rect width="300" height="220" fill="#e0f2e9"/><path d="M90 60h120v85H90zm0 85v40m120-40v40" fill="none" stroke="#246e46" stroke-width="12"/><text x="25" y="210" font-size="16">Synthetic UAT product photo</text></svg>';
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:'+listenPort);
 if(req.headers.host!=='127.0.0.1:'+listenPort|| (req.headers.origin&&req.headers.origin!=='http://127.0.0.1:'+listenPort)){res.writeHead(403);res.end();return;}
 if(url.pathname==='/product-uat-demo.svg'){res.writeHead(200,{'content-type':'image/svg+xml','cache-control':'no-store'});res.end(svg);return;}
 const safeRead=/^(\/api\/orders(?:\/[^/]+)?|\/api\/shipments|\/api\/products|\/api\/orders\/[^/]+\/items\/[^/]+\/product)$/.test(url.pathname);
 const safeWrite=/^\/api\/(orders\/[^/]+\/items\/[^/]+\/product|products\/[1-9][0-9]*)$/.test(url.pathname);
 if(url.pathname.startsWith('/api/')&&!(req.method==='GET'?safeRead:safeWrite&&['POST','PATCH','DELETE'].includes(req.method))){res.writeHead(403,{'content-type':'application/json'});res.end('{"error":"Provider and unrelated writes are disabled in local product UAT."}');return;}
 const headers={...req.headers,host:'127.0.0.1:'+upstreamPort,authorization:'Bearer '+process.env.STOCK_STAGING_AUTH_TOKEN};
 const upstream=http.request({host:'127.0.0.1',port:upstreamPort,path:req.url,method:req.method,headers},reply=>{res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);});
 upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});req.pipe(upstream);
}).listen(listenPort,'127.0.0.1',()=>console.log('Local synthetic UAT: http://127.0.0.1:'+listenPort+'/orders/UAT-PRODUCT-ORDER'));
