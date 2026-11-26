// Standalone Node commander. Its only game interface is the versioned JSON envelope.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const request=JSON.parse(readFileSync(0,'utf8'));
const {version,matchId,requestId,side,type}=request;
assert.equal(version,'arena-commander-stdio/v1');
const reply={version,matchId,requestId,side};
if(type==='finished'){
 assert.ok(['blue','sand','draw'].includes(request.outcome));
 process.stdout.write(JSON.stringify({...reply,type:'acknowledged',outcome:request.outcome}));
}else{
 assert.equal(type,'checkpoint');
 const {observation,previous,destinations}=request;
 const mode=observation.mode;
 const relay=previous&&previous.score.rival>previous.score.own?'South':'North';
 const sites=mode==='relay'?[relay]:mode==='bomb'?[relay]:['North','South'];
 const goals=destinations.options.filter(row=>sites.includes(row[4]));
 assert.ok(goals.length>=observation.own.length);
 const orders=observation.own.map(({hp,slot})=>{
  if(!hp)return '-';
  const goal=goals[slot][0];
  return mode==='bomb'?goal+(slot===0?'/link':'/pulse'):goal;
 });
 const intent=mode==='relay'?`Allocate the squad to ${relay} after checking the receipt.`:
  mode==='bomb'?`Assign the lead slot to link ${relay}.`:'Send units to five legal landing spots.';
 process.stdout.write(JSON.stringify({...reply,type:'orders',intent,orders,
  ...(mode==='tdm'?{pulseSlots:observation.own.filter(unit=>unit.hp>0).map(unit=>unit.slot)}:{})}));
}
