import {readPostgresHistory} from "./postgres-history.mjs";
import {featureFiles,featuresHistory,restoreFeatureSource} from "./features-retirement-history.mjs";
import assert from 'node:assert/strict';
import {accountNewFiles,accountChanged,restoreAccountSource} from './loyverse-accounts-history.mjs';
import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,relative,posix} from 'node:path';
export const retirement=JSON.parse(readFileSync('tests/fixtures/externals-retirement-before.json','utf8'));
export const archivedFiles={...retirement.files,...featureFiles};
export const retirementNewFiles=[retirement.contract,...accountNewFiles];
export const retirementChanged=new Set([...Object.keys(retirement.edits),...accountChanged]);
const hash=s=>createHash('sha256').update(s).digest('hex');
export const registryProjection='canonical-export-contract:google-registry';
export const worksheetProjection='canonical-export-contract:worksheets';
export function canonicalPath(file){const e=retirement.files[file];return e?.canonical??(e?.runtimeKeys?(file.endsWith('/sheets/index.ts')?worksheetProjection:registryProjection):file);}
export function resolveEvidence(file){if(file.endsWith('.ts')||file.endsWith('.tsx'))return file;if(Object.hasOwn(archivedFiles,file+'.ts')||existsSync(file+'.ts'))return file+'.ts';return file+'/index.ts';}
export function restoreRetirementSource(file,source){
 if(featureFiles[file])return restoreFeatureSource(file,source);
 if(!retirement.files[file])source=restoreFeatureSource(file,source);
 if(!retirement.files[file])source=restoreAccountSource(file,source);
 const rule=retirement.lintEdits?.[file];if(rule){assert.equal(hash(restoreAccountSource(file,restoreFeatureSource(file))),rule.afterHash,file);source??=readFileSync(file,'utf8');if(hash(source)===rule.beforeHash)return source;assert.equal(hash(source),rule.afterHash,file);for(const c of rule.changes.toReversed()){assert.equal(source.slice(c.afterStart,c.afterStart+c.after.length),c.after,file);source=source.slice(0,c.afterStart)+c.before+source.slice(c.afterStart+c.after.length);}assert.equal(hash(source),rule.beforeHash,file);return source;}

 const removed=retirement.files[file];if(removed){assert.equal(existsSync(file),false,`Retired file reintroduced: ${file}`);assert.equal(hash(removed.source),removed.sha256,file);return source??removed.source;}
 if(source===undefined)source=readFileSync(file,'utf8');const e=retirement.edits[file];if(!e)return source;
 assert.equal(hash(restoreAccountSource(file,restoreFeatureSource(file))),e.afterHash,file);
 if(hash(source)===e.beforeHash)return source;
 // A later inverse can pass an earlier immutable source version through again.
 if(!source.includes(e.to))return source;
 const restored=source.replaceAll(e.to,e.from);assert.equal(hash(restored),e.beforeHash,file);return restored;
}
// Used only by historical source/hash assertions and archived graph overlays.
// Current executable loaders use node:fs directly and canonical owners.
export function readEvidence(file,options){const path=typeof file==='string'?file:undefined;if(!path?.startsWith('src/')&&!retirement.lintEdits?.[path]&&!featuresHistory.edits[path])return readPostgresHistory(file,options);const source=restoreRetirementSource(path);return typeof options==='string'||options?.encoding?source:Buffer.from(source);}
export function evidenceHost(sys,overrides={}){const paths=[...Object.keys(archivedFiles),...Object.keys(overrides)];return {...sys,fileExists:f=>paths.includes(relative(process.cwd(),f))||sys.fileExists(f),directoryExists:d=>paths.some(f=>resolve(f).startsWith(resolve(d)+'/'))||sys.directoryExists(d),readFile:f=>{const p=relative(process.cwd(),f);return overrides[p]??archivedFiles[p]?.source??sys.readFile(f);}};}
export function canonicalExports(archiveFile,load){const saved=retirement.files[archiveFile];assert.ok(saved?.runtimeKeys,'Only the two archived Sheets export contracts may be projected');const values={};for(const name of saved.runtimeKeys){const e=saved.exports.find(e=>e.name===name&&!e.typeOnly);assert.ok(e,name);values[name]=load(e.module)[e.imported];assert.notEqual(values[name],undefined,`${name}: missing canonical export`);}return values;}
export function archivedRelative(file,spec){return resolveEvidence(spec.startsWith('@/')?'src/'+spec.slice(2):posix.normalize(posix.dirname(file)+'/'+spec));}
// Helpers for historical graph inventories; deleted files are not current roots.
export const currentSourceFiles=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?currentSourceFiles(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
// Archived deleted leaves may be read as evidence, never as current modules.
export function readArchive(file,options){if(typeof file==='string'&&archivedFiles[file]){const source=restoreRetirementSource(file);return typeof options==='string'||options?.encoding?source:Buffer.from(source);}return readPostgresHistory(file,options);}
