import { z } from 'zod';
import type { Library, Street, Theme } from '../types';
import { getPreset } from '../animation/registry';
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
const asset = z.string().regex(/^asset:[a-zA-Z0-9-]{1,80}$/).optional();
const finite = (min: number, max: number) => z.number().finite().min(min).max(max);
const assignment = z.object({preset:z.string().min(1).max(80), parameters:z.record(z.string().min(1).max(60),finite(-10000,10000)).refine(v=>Object.keys(v).length<=40,'Too many parameters')}).strict();
export const themeSchema = z.object({
 version:z.literal(1), id:z.string().regex(/^[a-zA-Z0-9-]{1,100}$/), name:z.string().trim().min(1).max(80), createdAt:z.string().datetime(), updatedAt:z.string().datetime(),
 card:z.object({face:z.enum(['classic','modern','midnight','native']),back:z.enum(['crosshatch','diamonds','solid','image']),backColor:hex,backImage:asset,faceColor:hex,redColor:hex,blackColor:hex,borderColor:hex,borderRadius:finite(0,14),shadow:finite(0,1)}).strict(),
 table:z.object({feltColor:hex,railColor:hex,backgroundColor:hex,backgroundImage:asset}).strict(),
 board:z.object({color:hex,highlight:hex,spacing:finite(0,32),shadow:finite(0,1)}).strict(),
 animations:z.object({deal:assignment,flop:assignment,turn:assignment,river:assignment}).strict(),
}).strict();
export const librarySchema = z.object({version:z.literal(1),settings:z.object({enabled:z.boolean(),reducedMotion:z.boolean(),speed:finite(.25,3),activeThemeId:z.string().min(1).max(100)}).strict(),themes:z.array(themeSchema).min(1).max(100)}).strict();
// Version 0 used the same appearance fields without timestamps. Never accept code.
export function migrateTheme(value: unknown): unknown {
 if(value && typeof value==='object' && 'version' in value && value.version===0) {
  const old = value as Record<string,unknown>; return {...old,version:1,createdAt:old.createdAt??new Date().toISOString(),updatedAt:old.updatedAt??new Date().toISOString()};
 } return value;
}
export function validateTheme(value: unknown): Theme {
 const theme=themeSchema.parse(migrateTheme(value));
 for(const street of ['deal','flop','turn','river'] as Street[]) {
  const assignment=theme.animations[street];const preset=getPreset(assignment.preset);
  if(!preset || !preset.supportedEvents.includes(street)) throw new Error(`Unknown or incompatible preset for ${street}`);
  for(const [key,value] of Object.entries(assignment.parameters)) {
   const schema=preset.parameters.find(parameter=>parameter.key===key);
   if(!schema || value<schema.min || value>schema.max) throw new Error(`Invalid ${preset.name} parameter: ${key}`);
  }
 }
 return theme;
}
export function validateLibrary(value: unknown): Library {
 const library = librarySchema.parse(value);
 library.themes=library.themes.map(validateTheme);
 if(new Set(library.themes.map(t=>t.id)).size!==library.themes.length) throw new Error('Duplicate theme IDs');
 if(!library.themes.some(t=>t.id===library.settings.activeThemeId)) library.settings.activeThemeId=library.themes[0].id;
 return library;
}
