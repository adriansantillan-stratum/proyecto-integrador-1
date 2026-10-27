import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'../..');
const runName=process.env.ECOROUTE_VIDEO_RUN;
if(!/^ecoroute_[a-z0-9_]+$/.test(runName??''))throw Error('Isolated video run required');
const out=path.join(root,'docs/videos',runName),raw=path.join(out,'raw');fs.mkdirSync(raw,{recursive:true});
const adb='C:/Users/USUARIO/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const run=(...args)=>execFileSync(adb,['-s','emulator-5556',...args],{timeout:45000,windowsHide:true,maxBuffer:2e6}).toString();
if(!run('emu','avd','name').includes('EcoRoute_QA'))throw Error('Not the QA emulator');
const [action,name]=process.argv.slice(2),stateFile=path.join(out,'recorder.json');
const getPids=()=>{try{return run('shell','pidof','screenrecord').trim();}catch{return '';}};
if(action==='recover'){
 if(!/^[a-z0-9_]+$/.test(name??''))throw Error('Invalid clip name');
 const pid=getPids();if(!/^\d+$/.test(pid))throw Error('No unique recording to recover');
 const remote='/sdcard/ecoroute_video_'+name+'.mp4';
 const command=run('shell','cat','/proc/'+pid+'/cmdline');
 if(!command.includes(remote))throw Error('Existing recorder does not match own requested output');
 const state={active:true,name,remote,pid:Number(pid),startedAt:new Date().toISOString(),serial:'emulator-5556',file:'raw/'+name+'.mp4',recoveredAfter:'PID query quoting error, before any business action'};
 fs.writeFileSync(stateFile,JSON.stringify(state,null,2));console.log(JSON.stringify(state));
}else
if(action==='start'){
 if(!/^[a-z0-9_]+$/.test(name??''))throw Error('Invalid clip name');
 if(fs.existsSync(stateFile)&&JSON.parse(fs.readFileSync(stateFile)).active)throw Error('Recorder already active');
 const pids=getPids();if(pids)throw Error('Another native recorder exists; not touching it');
 const remote='/sdcard/ecoroute_video_'+name+'.mp4';
 const log=fs.openSync(path.join(raw,name+'_recorder.log'),'a');
 const child=spawn(adb,['-s','emulator-5556','shell','screenrecord','--size','720x1600','--bit-rate','2500000','--time-limit','0',remote],{detached:true,windowsHide:true,stdio:['ignore',log,log]});child.unref();fs.closeSync(log);
 await new Promise(r=>setTimeout(r,1800));
 const pid=getPids();if(!/^\d+$/.test(pid))throw Error('Could not identify own native recording process');
 const state={active:true,name,remote,pid:Number(pid),hostPid:child.pid,startedAt:new Date().toISOString(),serial:'emulator-5556',file:'raw/'+name+'.mp4'};
 fs.writeFileSync(stateFile,JSON.stringify(state,null,2));console.log(JSON.stringify(state));
}else if(action==='stop'){
 const state=JSON.parse(fs.readFileSync(stateFile));if(!state.active||state.serial!=='emulator-5556')throw Error('No active owned recording');
 const pid=getPids();if(pid!==String(state.pid))throw Error('Recording PID changed; refuse signal');
 run('shell','kill','-2',String(state.pid));await new Promise(r=>setTimeout(r,1800));
 run('pull',state.remote,path.join(out,state.file));
 state.active=false;state.stoppedAt=new Date().toISOString();state.bytes=fs.statSync(path.join(out,state.file)).size;
 if(state.bytes<10000)throw Error('Recording is unexpectedly small');
 fs.writeFileSync(path.join(raw,state.name+'_recording.json'),JSON.stringify(state,null,2));fs.writeFileSync(stateFile,JSON.stringify(state,null,2));console.log(JSON.stringify(state));
}else throw Error('Use start NAME or stop');
