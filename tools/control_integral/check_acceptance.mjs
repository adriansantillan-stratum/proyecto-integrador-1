import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),folder=path.join(root,'docs/control_integral_20261022');
const input=JSON.parse(fs.readFileSync(path.join(folder,'aceptacion.json'),'utf8'));
const inventory=JSON.parse(fs.readFileSync(path.join(folder,'inventario_base.json'),'utf8'));
const validIds=new Set(inventory.uatTests.map(test=>test.id));
const issues=[];
for(const key of ['name','position','organization'])if(!input.validator?.[key]?.trim())issues.push('Falta validator.'+key);
if(!/^\d{4}-\d{2}-\d{2}$/.test(input.decisionDate??''))issues.push('Falta fecha de decisión');
if(!['ACCEPTED','ACCEPTED_WITH_RESERVATIONS','REJECTED'].includes(input.decision))issues.push('Falta decisión empresarial explícita');
for(const id of input.acceptedUatIds??[])if(!validIds.has(id))issues.push('Caso desconocido '+id);
if(new Set(input.acceptedUatIds??[]).size!==(input.acceptedUatIds??[]).length)issues.push('Casos repetidos');
if(input.decision==='ACCEPTED'&&(input.acceptedUatIds??[]).length!==validIds.size)issues.push('Aceptación global sin los 96 casos identificados');
if(input.decision==='ACCEPTED_WITH_RESERVATIONS'&&!input.reservations?.length)issues.push('Faltan reservas de la aceptación condicionada');
if(!input.evidence?.length)issues.push('Falta evidencia de la decisión');
for(const attachment of input.evidence??[]){
 const file=path.resolve(folder,attachment.path??'');
 if(!file.startsWith(folder+path.sep)||!fs.existsSync(file)){issues.push('Evidencia inexistente o fuera del expediente');continue;}
 if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==attachment.sha256)issues.push('Hash de evidencia distinto');
}
const result={at:new Date().toISOString(),acceptanceRecorded:issues.length===0,decision:issues.length?null:input.decision,acceptedCases:issues.length?0:input.acceptedUatIds.length,issues,
 scope:'Valida integridad documental declarada; no autentica una firma ni prueba por sí solo que la persona tenga poderes de representación.'};
fs.writeFileSync(path.join(folder,'validacion_aceptacion.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
if(issues.length&&process.argv.includes('--require-accepted'))process.exitCode=1;
