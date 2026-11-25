import test from 'node:test';
import {request as httpRequest} from 'node:http';
import assert from 'node:assert/strict';
import {createCoarena} from '../scripts/coarena.mjs';
import {createApp} from '../scripts/server.mjs';

test('adapter sends fixed model, system boundary and returns only public response fields',async()=>{
  let sent;
  const client=createCoarena({key:'test-secret',fetchImpl:async(url,options)=>{
    sent={url,...options};return Response.json({id:'reply-1',choices:[{message:{content:'Um passo por dia.'}}],private:'secret'});
  }});
  assert.deepEqual(await client.chat('  Ajude com uma meta  '),{id:'reply-1',content:'Um passo por dia.',model:'gpt-6-luna'});
  assert.equal(sent.url,'https://coarena.ai/api/v1/chat/completions');
  assert.equal(sent.headers.Authorization,'Bearer test-secret');
  const body=JSON.parse(sent.body);assert.equal(body.messages.length,2);assert.equal(body.messages[1].content,'Ajude com uma meta');
  assert.equal(body.model,'gpt-6-luna');assert.equal(sent.redirect,'error');
});
test('adapter validates input and redacts upstream errors',async()=>{
  const client=createCoarena({key:'test-secret',fetchImpl:async()=>new Response('test-secret',{status:401})});
  for(const message of ['',null,{},'x'.repeat(4001)]) await assert.rejects(()=>client.chat(message),{status:400});
  await assert.rejects(()=>client.chat('hello'),err=>err.status===502&&!err.message.includes('test-secret'));
  await assert.rejects(()=>createCoarena().chat('hello'),{status:503});
  const limited=createCoarena({key:'x',fetchImpl:async()=>new Response('',{status:429})});
  await assert.rejects(()=>limited.chat('hello'),{status:429});
});
test('feedback forwards rating and supports removal',async()=>{
  const requests=[];const client=createCoarena({key:'x',fetchImpl:async(url,o)=>{requests.push([url,JSON.parse(o.body)]);return Response.json({});}});
  await client.feedback('reply-1','down');await client.feedback('reply-1',null);
  assert.deepEqual(requests[0],['https://coarena.ai/api/v1/feedback',{request_id:'reply-1',rating:'down'}]);
  assert.equal(requests[1][1].rating,null);
  await assert.rejects(()=>client.feedback('reply-1','good'),{status:400});
});
test('HTTP API enforces origin, session ownership, size limits, and static isolation',async t=>{
  let feedbackCalls=0;
  const server=createApp({key:'server-secret',client:{chat:async()=>({id:'reply-1',content:'Olá',model:'gpt-6-luna'}),feedback:async()=>{feedbackCalls++;return {ok:true};}}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=(path,body,headers={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...headers},body:JSON.stringify(body)});
  const status=await fetch(base+'/api/ai/status');assert.equal(status.headers.get('cache-control'),'no-store');
  assert.deepEqual(await status.json(),{available:true,model:'gpt-6-luna'});
  assert.equal((await request('/api/ai/chat',{message:'hi'},{Origin:'https://evil.example'})).status,403);
  const badHost = await new Promise(resolve => {const req=httpRequest(base+'/api/ai/status',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.end();});
  assert.equal(badHost,403);
  assert.equal((await request('/api/ai/chat',{message:'x'.repeat(21000)})).status,413);
  const chat=await request('/api/ai/chat',{message:'hi'});assert.equal(chat.status,200);
  const cookie=chat.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/ai/feedback',{id:'reply-1',rating:'up'})).status,403);
  assert.equal((await request('/api/ai/feedback',{id:'reply-1',rating:'up'},{Cookie:cookie})).status,200);
  assert.equal(feedbackCalls,1);
  assert.equal((await fetch(base+'/.env')).status,404);
  assert.equal((await fetch(base+'/scripts/coarena.mjs')).status,404);
  assert.equal((await fetch(base+'/')).status,200);
  for(let i=0;i<6;i++)assert.equal((await request('/api/ai/chat',{message:'hi'},{Cookie:cookie})).status,200);
  assert.equal((await request('/api/ai/chat',{message:'hi'},{Cookie:cookie})).status,429);
});
