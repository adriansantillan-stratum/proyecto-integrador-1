/** Local development provisioning. Preserves existing users, passwords and realm data. */
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const env=Object.fromEntries(fs.readFileSync('.env','utf8').split(/\r?\n/).filter(line=>line.includes('=')&&!line.startsWith('#')).map(line=>[line.slice(0,line.indexOf('=')),line.slice(line.indexOf('=')+1).trim()]));
const secret=env.KEYCLOAK_ADMIN_CLIENT_SECRET;
if(!secret) throw new Error('Configure KEYCLOAK_ADMIN_CLIENT_SECRET in the ignored .env before provisioning');
const command=(args,input)=>execFileSync('docker',['exec',...(input?['-i']:[]),'ecoroute-keycloak','/opt/keycloak/bin/kcadm.sh',...args],{input:input?JSON.stringify(input):undefined,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:30000});
command(['config','credentials','--server','http://localhost:8080','--realm','master','--user',env.KEYCLOAK_BOOTSTRAP_ADMIN||'admin','--password',env.KEYCLOAK_BOOTSTRAP_PASSWORD||'admin']);
const clients=JSON.parse(command(['get','clients','-r','ecoroute','-q','clientId=ecoroute-operations-service']));
const data={clientId:'ecoroute-operations-service',enabled:true,publicClient:false,serviceAccountsEnabled:true,standardFlowEnabled:false,directAccessGrantsEnabled:false,secret};
if(clients.length) command(['update',`clients/${clients[0].id}`,'-r','ecoroute','-f','-'],data);
else command(['create','clients','-r','ecoroute','-f','-'],data);
for(const role of ['manage-users','view-users','view-realm'])
 command(['add-roles','-r','ecoroute','--uusername','service-account-ecoroute-operations-service','--cclientid','realm-management','--rolename',role]);
const mobiles=JSON.parse(command(['get','clients','-r','ecoroute','-q','clientId=mobile-app']));
if(mobiles.length) command(['update',`clients/${mobiles[0].id}`,'-r','ecoroute','-f','-'],{attributes:{...mobiles[0].attributes,'access.token.lifespan':'600'}});
console.log(JSON.stringify({client:'ecoroute-operations-service',realm:'ecoroute',roles:['manage-users','view-users','view-realm'],mobileAccessTokenSeconds:600,existingUsersPreserved:true,secretPrinted:false}));
