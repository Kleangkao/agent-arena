import {readFileSync} from 'node:fs';
import {replay} from '../src/game';
import {validateReplay} from '../src/replay';
const path=process.argv[2];if(!path)throw Error('Provide a report path');
const report=JSON.parse(readFileSync(path,'utf8'));
if(report.replay){
 const validated=validateReplay(report.replay);
 console.log(`Replay valid: ${validated.events.length} steps, result ${validated.result}, model ${report.attempts?.find((attempt:{model?:string})=>attempt.model)?.model??'unreported'}`);
 process.exit(0);
}
if(report.status!=='completed')throw Error('Match is not completed');
const computed=replay(report.events.map((e:any)=>e.actions));
if(JSON.stringify(computed)!==JSON.stringify(report.events.at(-1)?.state)||computed.result!==report.result)throw Error('Replay mismatch');
console.log(`Replay valid: ${report.events.length} steps, result ${computed.result}, model ${report.requestedModel}`);
