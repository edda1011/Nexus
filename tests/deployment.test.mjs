import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentConfig} from '../deployment.mjs';
test('deployment accepts only configured HTTPS hosts and trusts proxy IPs only on Vercel',()=>{
  const req={headers:{host:'nexus.example','x-forwarded-for':'203.0.113.1, 10.0.0.1'},socket:{remoteAddress:'127.0.0.1'}};
  assert.throws(()=>deploymentConfig({VERCEL:'1'}),/Production requires/);
  assert.throws(()=>deploymentConfig({NODE_ENV:'production',DATABASE_URL:'configured',NEXUS_SIGNING_KEY:'configured',NEXUS_PUBLIC_ORIGIN:'http://nexus.example'}),/HTTPS/);
  const cloud=deploymentConfig({VERCEL:'1',DATABASE_URL:'configured',NEXUS_SIGNING_KEY:'configured',VERCEL_URL:'preview.vercel.app',VERCEL_PROJECT_PRODUCTION_URL:'nexus.example'});
  assert.equal(cloud.originFor(req),'https://nexus.example');assert.equal(cloud.clientAddress(req),'203.0.113.1');assert.equal(cloud.originFor({...req,headers:{host:'attacker.example'}}),undefined);
  const local=deploymentConfig({PORT:'5173'});assert.equal(local.originFor({...req,headers:{host:'localhost:5173'}}),'http://localhost:5173');assert.equal(local.clientAddress(req),'127.0.0.1');
});
