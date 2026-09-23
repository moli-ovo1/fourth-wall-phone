import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require=createRequire(import.meta.url);
const plugin=require('../server-plugin/index.js');
const http=require('node:http');

function response(){return {statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}

test('server plugin only accepts named operations and requires a pairing token',async()=>{
  const routes={};await plugin.init({get:(path,handler)=>{routes[`GET ${path}`]=handler;},post:(path,handler)=>{routes[`POST ${path}`]=handler;}});
  const invalid=response();await routes['POST /call']({body:{operation:'arbitrary-url',body:{scopeKey:'x'}},get:()=>''},invalid);
  assert.equal(invalid.statusCode,400);
  const unpaired=response();await routes['POST /call']({body:{operation:'lease-get',body:{scopeKey:'x'}},get:()=>''},unpaired);
  assert.equal(unpaired.statusCode,401);
});

test('server plugin forwards an allowlisted operation only to fixed loopback Bridge',async()=>{
  const routes={};await plugin.init({get:(path,handler)=>{routes[`GET ${path}`]=handler;},post:(path,handler)=>{routes[`POST ${path}`]=handler;}});
  const original=http.request;let forwarded;
  http.request=(options,callback)=>{
    forwarded=options;
    const request=new EventEmitter();request.setTimeout=()=>{};request.write=()=>{};
    request.end=()=>{
      const upstream=new EventEmitter();upstream.statusCode=200;callback(upstream);
      queueMicrotask(()=>{upstream.emit('data',Buffer.from('{}'));upstream.emit('end');});
    };
    return request;
  };
  try {
    const result=response();await routes['POST /call']({body:{operation:'lease-get',body:{scopeKey:'character:1'}},get:()=> 'pairing'},result);
    assert.equal(result.statusCode,200);assert.deepEqual(result.body,{status:200,body:{}});
    assert.equal(forwarded.hostname,'127.0.0.1');assert.equal(forwarded.port,17463);
    assert.equal(forwarded.path,'/v1/lease?scopeKey=character%3A1');assert.equal(forwarded.headers['X-Moli-Pairing-Token'],'pairing');
  } finally { http.request=original; }
});
