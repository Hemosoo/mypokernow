import test from 'node:test';
import assert from 'node:assert/strict';
import { parseChips } from '../src/adapter/pokernow/table-state';
import { diffTable, winTier } from '../src/stage/actions';
import { validateLibrary, validateTheme } from '../src/themes/schema';
import { createDefaultLibrary, createDefaultTheme } from '../src/themes/defaults';
import type { TableState, SeatState } from '../src/adapter/pokernow/table-state';
const rect = { x: 10, y: 10, width: 50, height: 40 };
const seat = (patch: Partial<SeatState> = {}): SeatState => ({ position:1, plate:rect, you:true, deciding:false, winner:false, folded:false, allIn:false, check:false, urgent:false, cards:[], ...patch });
const state = (seats: SeatState[], pot = 0): TableState => ({ table:rect, boardCount:0, pot, seats });
test('chip reader handles visible monetary notation without guessing missing values', () => {
 for (const [text, expected] of [['1,250',1250],['12.50',12.5],['3.4k',3400],['2M',2000000]] as const) assert.equal(parseChips(text),expected);
 assert.equal(parseChips('All In'),undefined); assert.equal(parseChips(''),undefined);
});
test('bets, collection, split awards and tiers describe consecutive observations only', () => {
 assert.deepEqual(diffTable(state([seat()]),state([seat({bet:20})])),[{type:'bet',position:1,amount:20,added:20,first:true}]);
 const before=state([seat({bet:20,betRect:rect}),seat({position:2,bet:20,betRect:rect,allIn:true})],100);
 const after=state([seat({winner:true}),seat({position:2,winner:true})],140);
 const actions=diffTable(before,after);
 assert.equal(actions.filter(a=>a.type==='collect').length,1);
 assert.deepEqual(actions.find(a=>a.type==='award'),{type:'award',winners:[1,2],pot:140,allIn:true});
 assert.deepEqual(diffTable(after,after),[]);
 assert.equal(winTier(5,false),'small');assert.equal(winTier(20,false),'medium');assert.equal(winTier(40,true),'big');
});
test('v1 migration adds new materials and effects while preserving a custom room', () => {
 const theme=createDefaultTheme(); const { trimColor, inscription, emblem, ...oldTable }=theme.table;
 const old={...theme,id:'my-room',version:1,table:oldTable};
 const migrated=validateTheme(old); assert.equal(migrated.version,2);assert.equal(migrated.table.feltColor,theme.table.feltColor);
 assert.throws(()=>validateTheme({...old,code:'bad'}));
 const library=createDefaultLibrary(); const {effects,...oldSettings}=library.settings;
 const result=validateLibrary({version:1,themes:[old],settings:{...oldSettings,activeThemeId:'my-room'}});
 assert.equal(result.settings.activeThemeId,'my-room');assert.equal(result.settings.effects.chips,true);
});
