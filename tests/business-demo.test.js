import { describe,it,expect } from 'vitest';
import { initialState,roll,upgrade,remaining,UPGRADES,TILES,EVENTS } from '../demo/model.js';
import { scene } from '../demo/scene.js';
describe('separate growing business concept',()=>{
 it('starts close to a visible first upgrade',()=>{expect(remaining(initialState())).toBe(8);});
 it('rejects invalid dice',()=>{for(const n of [0,7,1.5,NaN])expect(()=>roll(initialState(),n)).toThrow();});
 it('moves consistently and awards the actual landing event',()=>{for(let p=0;p<TILES.length;p++)for(let d=1;d<=6;d++){const s={...initialState(),position:p};const n=roll(s,d);expect(n.position).toBe((p+d)%12);expect(n.points-s.points).toBe(EVENTS[TILES[n.position]].points);expect(s.rolls).toBe(0);}});
 it('does not let a player build before they have enough',()=>{const s=initialState();expect(upgrade(s)).toBe(s);});
 it('requires a genuine visual choice at stage two',()=>{const s={...initialState(),points:24,level:1};expect(upgrade(s)).toBe(s);expect(upgrade(s,'bogus')).toBe(s);for(const style of ['terrace','takeaway'])expect(upgrade(s,style)).toMatchObject({level:2,points:0,style});});
 it('charges exactly the shown points and carries leftovers',()=>{const s={...initialState(),points:15};expect(upgrade(s)).toMatchObject({level:1,points:3});});
 it('all die paths reach the replayable finite ending without buying or waiting',()=>{for(let d=1;d<=6;d++){let s=initialState();for(let i=0;i<30&&s.level<3;i++){s=roll(s,d);if(remaining(s)===0)s=upgrade(s,'terrace');}expect(s.level).toBe(3);expect(roll(s,d)).toBe(s);expect(upgrade(s)).toBe(s);}});
 it('provides visibly different building stages and both style options',()=>{const images=[scene(0),scene(1),scene(2,'terrace'),scene(2,'takeaway'),scene(3,'terrace')];expect(new Set(images).size).toBe(5);expect(images.every(x=>x.includes('role="img"'))).toBe(true);expect(UPGRADES.map(x=>x.cost)).toEqual([12,24,36]);});
});
