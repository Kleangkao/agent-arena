import assert from 'node:assert/strict';
import {canonical} from '../src/v25/game.js';
import {second} from '../src/v26/config.js';
import {matches} from '../src/v26/controller.js';
import {observation, type Packet} from '../src/v26/game.js';
import {load} from '../src/v26/replay.js';
import {digest} from './gameplay-v26-behavior.js';
import type {AuthorizationTrace,runTrial} from './gameplay-v26.js';

type Trial=Awaited<ReturnType<typeof runTrial>>;

/** Verify the evidence against the authoritative transcript and accepted authorizations. */
export function verifyAuthorizationTrace({recording,participants,upstream}:Trial) {
  assert(upstream);
  assert.equal(upstream.replay,digest(recording));
  assert.equal(upstream.match,digest({matchId:upstream.matchId,config:recording.config}));
  const {frames}=load(recording);
  const revisions=participants.map(p=>p.requests.filter(r=>r.status==='accepted'));
  let cursor=0, authored=0, maintenance=0, rejected=0, packetsAcrossLives=0;
  const reusedLives=new Set<string>();
  for(const [tick,packets] of recording.transcript) for(const side of [0,1] as const) {
    const packet=packets[side];
    if(packet===null) continue;
    const row:AuthorizationTrace=upstream.provenance[cursor++];
    const prior=frames[tick-2]?.state??recording.initialState;
    const v=observation(recording.config,prior,side);
    assert(row);
    assert.equal(row.tick,tick-1);
    assert.equal(row.side,side);
    assert.equal(row.origin,recording.source);
    assert.equal(canonical(row.packet),canonical(packet));
    assert.equal(canonical(row.receipts),canonical(frames[tick-1].receipts[side]));
    rejected+=row.receipts.filter(r=>!r.accepted).length;
    if(row.leaseMovement==='release') {
      assert.equal(packet.movement?.kind,'stop');
      assert(v.agent.moving);
      maintenance++;
    }
    if(row.decision==='lease-release') {
      assert.equal(row.leaseMovement,'release');
      assert.equal(row.ref,undefined);
      assert.equal(canonical(packet),canonical({movement:{kind:'stop'}}));
      continue;
    }
    const ref=row.ref;
    assert(ref);
    const revision=revisions[side][ref.revision-1];
    const spec=revision?.behavior??revision?.plan;
    assert(spec&&digest(spec)===ref.contract);
    assert.equal(ref.side,side);
    assert.equal(ref.match,upstream.match);
    assert(revision.tick<=row.tick&&!(revisions[side][ref.revision]?.tick<=row.tick));
    const accepted=frames[revision.tick-1]?.state??recording.initialState;
    assert.equal(ref.expires,accepted.time+spec.expiresInMs*second/1000);
    assert.equal(ref.acceptedLife,accepted.fighters[side].life);
    assert.equal(ref.life,v.agent.life);
    assert(v.agent.hp>0&&v.time<ref.expires);
    assert.equal(ref.scope,revision.behavior?.scope.kind??'life');
    if(ref.life!==ref.acceptedLife) {
      assert.equal(ref.scope,'match');
      packetsAcrossLives++;
      reusedLives.add(side+':'+ref.revision+':'+ref.life);
    }
    const b=revision.behavior;
    if(b?.revokeWhen) assert(!matches(b.revokeWhen,v));
    const step=ref.step;
    const stageIndex=Number(step?.replace(/^stage-/,''));
    const leaf=b?.kind==='behavior-tree'?b.nodes.find(n=>n.id===step):undefined;
    const stage=b?.kind==='state-machine'?b.states.find(s=>s.id===step)?.action:
      leaf?.kind==='action'?leaf.action:leaf?.kind==='wait'?{packet:{},when:undefined,alternative:undefined}:
        b?.kind==='ordered'?b.stages[stageIndex]:revision.plan?.stages[stageIndex];
    assert(stage);
    const expected=stage.when&&!matches(stage.when,v)?'alternative':'primary';
    assert.equal(ref.branch,expected);
    const authorized:Packet|undefined=expected==='primary'?stage.packet:stage.alternative;
    assert(authorized);
    if(row.decision==='lease-resume') assert.deepEqual(Object.keys(packet),['movement']);
    for(const key of Object.keys(packet) as (keyof Packet)[]) {
      if(key==='movement'&&row.leaseMovement==='release') continue;
      assert(authorized[key]!==undefined&&canonical(authorized[key])===canonical(packet[key]),
        `Unauthorized ${key} at tick ${tick} side ${side}: ${JSON.stringify({row,authorized})}`);
    }
    authored++;
  }
  assert.equal(cursor,upstream.provenance.length);
  return {packets:cursor,authored,maintenance,rejected,reusedLives:reusedLives.size,packetsAcrossLives,unauthorized:0};
}
