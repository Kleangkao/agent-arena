// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
/// @notice Deterministic Arena rules used by the settlement registry.
contract ArenaRules {
 struct Fighter { uint8 position; uint8 hp; uint8 ammo; }
 struct State { uint8 step; Fighter blue; Fighter sand; uint8 result; }
 // Actions: wait=0, advance=1, attack=2, reload=3. Result: ongoing=0, blue=1, sand=2, draw=3.
 function transition(State memory s,uint8 a,uint8 b) public pure returns(State memory) {
  require(s.result==0 && a<=3 && b<=3,"invalid");
  uint8 distance=s.blue.position>s.sand.position?s.blue.position-s.sand.position:s.sand.position-s.blue.position;
  require(_legal(s.blue,a,distance)&&_legal(s.sand,b,distance),"illegal");
  uint8 oldBlue=s.blue.position;uint8 oldSand=s.sand.position;
  if(a==1)s.blue.position++; if(b==1)s.sand.position--;
  if(a==2){s.blue.ammo--;s.sand.hp=s.sand.hp<=25?0:s.sand.hp-25;}
  if(b==2){s.sand.ammo--;s.blue.hp=s.blue.hp<=25?0:s.blue.hp-25;}
  if(a==3)s.blue.ammo=3;if(b==3)s.sand.ammo=3;
  if(s.blue.position==s.sand.position){s.blue.position=oldBlue;s.sand.position=oldSand;}
  s.step++;
  if(s.blue.hp==0||s.sand.hp==0||s.step>=10) s.result=s.blue.hp==s.sand.hp?3:s.blue.hp>s.sand.hp?1:2;
  return s;
 }
 function simulate(uint8[2][] calldata actions) public pure returns(State memory s) {
  require(actions.length>0 && actions.length<=10,"length");
  s=State(0,Fighter(0,100,3),Fighter(6,100,3),0);
  for(uint256 i=0;i<actions.length;i++) s=transition(s,actions[i][0],actions[i][1]);
  require(s.result!=0,"nonterminal");
 }
 function _legal(Fighter memory f,uint8 a,uint8 d) private pure returns(bool){return a==0||(a==1&&d>1)||(a==2&&f.ammo>0&&d<=3)||(a==3&&f.ammo<3);}
}
