import {readFileSync,writeFileSync} from 'node:fs';
const source=JSON.parse(readFileSync('evidence/ai-match-2026-11-25T16-33-49-909Z.json','utf8'));
const replay={version:1,rulesVersion:'lane-v1',mapVersion:'dust-yard-prototype-v1',label:'Historical Gemini match',initialState:source.initialState,events:source.events.map(({step,actions,state})=>({step,actions,state})),result:source.result};
writeFileSync('src/fixtures/historical-gemini.json',JSON.stringify(replay,null,2)+'\n');
