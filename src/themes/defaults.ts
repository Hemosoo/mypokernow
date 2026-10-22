import type { Library, Theme } from '../types';
const timestamp = '2026-10-22T00:00:00.000Z';
export function createDefaultTheme(): Theme {
  return {
    version: 1, id: 'theme-aurora', name: 'After Hours', createdAt: timestamp, updatedAt: timestamp,
    card: {face: 'modern', back: 'crosshatch', backColor: '#7770df', faceColor: '#faf8f2', redColor: '#d35165', blackColor: '#22293a', borderColor: '#dcd9ef', borderRadius: 8, shadow: 0.45},
    table: {feltColor: '#234b43', railColor: '#2a2b35', backgroundColor: '#14171f'},
    board: {color: '#173b35', highlight: '#9791f0', spacing: 12, shadow: 0.4},
    animations: {deal: {preset: 'deal.orbit', parameters: {}}, flop: {preset: 'flop.triple-spread', parameters: {}}, turn: {preset: 'reveal.slam', parameters: {}}, river: {preset: 'reveal.crystallization', parameters: {}}},
  };
}
const midnight = createDefaultTheme();
midnight.id = 'theme-midnight'; midnight.name = 'Midnight Circuit';
midnight.card = {...midnight.card, face:'midnight', faceColor:'#181c2c', redColor:'#fd8b9a', blackColor:'#dcdafa', backColor:'#4c6f96', borderColor:'#626a87'};
midnight.table = {...midnight.table, feltColor:'#263047', railColor:'#33313f'};
midnight.board = {...midnight.board, color:'#1b2338', highlight:'#70cbe4'};
const rose = createDefaultTheme();
rose.id = 'theme-velvet'; rose.name = 'Velvet Room';
rose.card = {...rose.card, backColor:'#9c536f', back:'diamonds'};
rose.table = {...rose.table, feltColor:'#563441', railColor:'#3c3039'};
rose.board = {...rose.board, color:'#412432', highlight:'#efacb9'};
export const builtInThemes: Theme[] = [createDefaultTheme(), midnight, rose];
export function createDefaultLibrary(): Library { return {version:1, settings:{enabled:true, reducedMotion:false, speed:1, activeThemeId:'theme-aurora'}, themes:structuredClone(builtInThemes)}; }
