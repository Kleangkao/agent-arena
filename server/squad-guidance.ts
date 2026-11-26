import {z} from 'zod';

export const squadStrategy=z.enum(['proactive','balanced','patient','custom']);
export const squadAutonomy=z.enum(['coach-led','adaptive','independent']);

const strategyText:Record<z.infer<typeof squadStrategy>,string>={
 proactive:'Look for opportunities to take initiative and make progress early when the board supports it.',
 balanced:'Weigh progress and team safety together, then adjust to the current board.',
 patient:'Favor preserving options and committing when the board offers a good opportunity.',
 custom:'Use the coach’s own instructions to understand their strategic preferences.',
};
const autonomyText:Record<z.infer<typeof squadAutonomy>,string>={
 'coach-led':'Give the coach’s guidance strong weight where practical. Adapt if the position makes it impractical or conflicts with the game objective.',
 adaptive:'Use the coach’s guidance as your starting preference and reconsider it when the board changes.',
 independent:'Treat the coach’s guidance as background. Use your own judgment about the current board to choose priorities.',
};

export function lockSquadGuidance(strategy:z.infer<typeof squadStrategy>,autonomy:z.infer<typeof squadAutonomy>,coaching:string){
 return {strategy,autonomy,prompt:{strategy:strategyText[strategy],autonomy:autonomyText[autonomy],coaching}};
}

export type SquadGuidance=ReturnType<typeof lockSquadGuidance>;
