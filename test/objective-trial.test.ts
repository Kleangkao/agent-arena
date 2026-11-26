import {expect,it} from 'vitest';
import {nextObjectiveIntent,objectivePrompt,readObjectivePlan} from '../server/objective-trial';
import {advance,configure,initial,settings} from '../src/v24/objective';
it('keeps private data out, validates bounded model plans, and applies only eligible explicit choices', () => {
  const config=configure(1,1,['guest-blue','guest-sand']);
  let state=initial(config);
  const prompt=objectivePrompt(config,state,1,{text:'Prefer short routes',revision:'r1',
    memory:{rulesVersion:'arcade-v2.3',revision:2,lessons:['private earlier rules']}});
  expect(prompt).toMatchObject({participant:'guest-sand',memory:null,observation:{role:'Activator',contact:{status:'unknown'}}});
  expect(JSON.stringify(prompt)).not.toContain('guest-blue');
  expect(() => readObjectivePlan('{"intents":[{"kind":"interact","force":true}]}')).toThrow();
  expect(() => readObjectivePlan('{"intents":[{"kind":"observe"},{"kind":"reload"},{"kind":"attack"}]}')).toThrow();
  const x=settings.position.x+2000,y=settings.position.y;
  const plan=readObjectivePlan(JSON.stringify({intents:[{kind:'move',mode:'run',to:{x,y}},{kind:'interact'}]}));
  state=advance(config,state,[null,nextObjectiveIntent(config,state,1,plan)]).state;
  expect(nextObjectiveIntent(config,state,1,plan)).toBeNull();
  while(state.fighters[1].motion)state=advance(config,state,[null,null]).state;
  const input=nextObjectiveIntent(config,state,1,plan);
  expect(input).toEqual({kind:'interact'});
  expect(advance(config,state,[null,input]).state.core.interaction?.side).toBe(1);
  expect(plan).toEqual([]);
});
