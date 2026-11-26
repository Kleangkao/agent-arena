import Phaser from 'phaser';

type Scenery = {key:string;left:number;top:number;foot:number};
const root='/assets/dust-yard/';
const props=['north-wall','west-freight','east-freight','front-freight','corner-pier'];

export function loadDustYard(scene:Phaser.Scene) {
 scene.load.json('dust-yard-anchors',root+'objects.json');
 scene.load.image('courtyard',root+'courtyard.png');
 for(const key of props)scene.load.image(key,root+key+'.png');
}

export function drawDustYard(scene:Phaser.Scene) {
 scene.add.image(0,0,'courtyard').setOrigin(0).setScale(2).setDepth(-2);
 const objects=scene.cache.json.get('dust-yard-anchors') as Scenery[];
 for(const {key,left,top,foot} of objects){
  scene.add.image(left*2,top*2,key).setOrigin(0).setScale(2).setDepth(foot*2);
 }
}

/** Visual anchors for the seven lane-v1 positions, on the flat courtyard. */
export const laneFoot=(position:number)=>({x:180+position*100,y:266+position*7});
