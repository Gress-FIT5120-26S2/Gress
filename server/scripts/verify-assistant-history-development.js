import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import '../src/env.js';

assert.equal(new URL(process.env.SUPABASE_URL).hostname,'thmbtsssvnslotoexntz.supabase.co');
assert.notEqual(process.env.NODE_ENV,'production');
const probe=createServer();probe.listen(0,'127.0.0.1');await once(probe,'listening');const port=probe.address().port;
await new Promise(resolve=>probe.close(resolve));
// Arthur: NarIyirm
// 中文：旧冰箱助手回归只连接本轮临时开发服务，不使用可能指向其他环境的既有端口。
// EN: Regress the original fridge assistant against this run's temporary development service, never a pre-existing port with an unknown environment.
const child=spawn(process.execPath,['scripts/start-learning-development.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:String(port)},windowsHide:true,stdio:['ignore','pipe','pipe']});
let exit=null;child.once('exit',code=>{exit=code;});
try{
  const until=Date.now()+30000;let ready=false;
  while(Date.now()<until){
    if(exit!==null)throw new Error('Development service exited before readiness.');
    try{const response=await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(3000)});ready=response.ok;}catch{}
    if(ready)break;await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert.ok(ready,'Temporary development service must be ready.');
  const test=spawn(process.execPath,['scripts/verify-assistant-history.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,ASSISTANT_HISTORY_TEST_API_URL:`http://127.0.0.1:${port}`},windowsHide:true,stdio:'inherit'});
  const [code]=await once(test,'exit');assert.equal(code,0,'Original assistant history regression failed.');
}finally{child.kill();await once(child,'exit').catch(()=>undefined);}
