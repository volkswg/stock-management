import {canonicalPath} from "./retirement-history.mjs";
import vm from "node:vm";
import ts from "typescript";
import {loadSource,plain} from "./load-source.mjs";
import {shipmentServices,fakeShipmentSheets,ShipmentClock} from "./shipments.mjs";
import {shipmentHttpBefore} from "./shipments-http-history.mjs";
const routes={collection:"src/app/api/shipments/route.ts",detail:"src/app/api/shipments/[id]/route.ts",links:"src/app/api/shipments/[id]/orders/route.ts"};
// Exact three-route historical/current wiring, actual composed operations and
// synthetic factories/worksheets only. No provider/config code is evaluated.
export async function runShipmentHttpCase(example,{original=false}={}){
 const trace=[],errors=[],logger={error:(...args)=>errors.push(plain(args))};
 const {load,services}=shipmentServices({globals:{console:logger}}),fake=fakeShipmentSheets(example.rows,example.fail);
 for(const [name,sheet]of Object.entries(fake.sheets))for(const [method,fn]of Object.entries(sheet))sheet[method]=(...args)=>{trace.push([method,name,...plain(args)]);return fn(...args);};
 const drive={uploadImage:async input=>{trace.push(["upload",input.fileName,input.contentType,input.bytes.length]);if(example.drive==="upload-failure")throw new Error("synthetic upload failure");return{id:"bill/id",webViewLink:" url "};},deleteFile:async id=>{trace.push(["delete",id]);if(example.drive==="delete-failure")throw new Error("synthetic cleanup failure");}};
 const imports={"next/server":{NextResponse:Response},"@/config":{getConfig:()=>{trace.push(["config"]);return{};}},
  "@/externals/google/sheet":{createGoogleSheetsServiceFromConfig:()=>{trace.push(["sheets"]);return fake.sheets;}},
  "@/externals/google/drive":{createGoogleDriveServiceFromConfig:()=>{trace.push(["drive"]);return example.drive==="unavailable"?undefined:drive;}},
  "@/services/shipments":services,"@/modules/shipments/server":load("src/modules/shipments/server.ts"),"@/modules/shipments/contracts":load("src/modules/shipments/contracts.ts"),
  "@/features/backend/shared/utils":load("src/features/backend/shared/utils.ts"),"@/features/backend/shipments/utils":load("src/features/backend/shipments/utils.ts")};
 const globals={Date:ShipmentClock,Error,File,console:logger};
 function route(name){const file=routes[name];if(!original)return loadSource(canonicalPath(file),{imports,globals});
  const exports={},output=ts.transpileModule(shipmentHttpBefore.sources[file].source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new vm.Script(output,{filename:file}).runInNewContext({exports,Buffer,URL,URLSearchParams,...globals,require:specifier=>{if(!Object.hasOwn(imports,specifier))throw new Error(`Unapproved historical route import ${specifier}`);return imports[specifier];}});return exports;
 }
 const responses=[];
 for(const spec of example.requests){const url=spec.url??"https://example.test/api/shipments",init={method:spec.method};
  if(spec.bill){const form=new FormData();for(const [key,value]of Object.entries(spec.body??{}))form.set(key,String(value));form.set("shippingBill",new File([new Uint8Array(4)],"synthetic.pdf",{type:"application/pdf"}));init.body=form;}
  else if(spec.body!==undefined){init.headers={"Content-Type":"application/json"};init.body=JSON.stringify(spec.body);}
  const response=await route(spec.route)[spec.method](new Request(url,init),{params:Promise.resolve({id:spec.id??"s/1"})});responses.push({status:response.status,body:await response.json()});
 }
 return{responses,trace,errors};
}
