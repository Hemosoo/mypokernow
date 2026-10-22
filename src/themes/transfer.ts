import { z } from 'zod';
import type { Theme } from '../types';
import { validateTheme } from './schema';
import { readAsset, storeAssetData, validateDecodedAsset } from '../storage/assets';
const envelopeSchema=z.object({format:z.literal('pokernow-customizer'),version:z.literal(1),theme:z.unknown(),assets:z.record(z.string().regex(/^asset:[a-zA-Z0-9-]{1,80}$/),z.string()).refine(v=>Object.keys(v).length<=2,'Too many assets')}).strict();
export async function exportTheme(theme: Theme): Promise<string> {
 const clean=validateTheme(theme); const assets:Record<string,string>={};
 for(const ref of [clean.card.backImage,clean.table.backgroundImage]) if(ref&&!assets[ref]) assets[ref]=await readAsset(ref);
 return JSON.stringify({format:'pokernow-customizer',version:1,theme:clean,assets},null,2);
}
export async function importTheme(json: string): Promise<Theme> {
 if(json.length>6*1024*1024) throw new Error('Theme file exceeds 6 MB');
 const envelope=envelopeSchema.parse(JSON.parse(json)); const theme=validateTheme(envelope.theme);
 const refs=new Set([theme.card.backImage,theme.table.backgroundImage].filter((ref):ref is string=>!!ref));
 if(Object.keys(envelope.assets).some(ref=>!refs.has(ref))) throw new Error('Theme contains unused assets');
 // Validate every asset before mutating storage.
 for(const ref of refs) {if(!envelope.assets[ref])throw new Error('Theme is missing an image asset');await validateDecodedAsset(envelope.assets[ref]);}
 const remap=new Map<string,string>();for(const ref of refs)remap.set(ref,await storeAssetData(envelope.assets[ref]));
 if(theme.card.backImage)theme.card.backImage=remap.get(theme.card.backImage);
 if(theme.table.backgroundImage)theme.table.backgroundImage=remap.get(theme.table.backgroundImage);
 theme.id=`theme-${crypto.randomUUID()}`; theme.createdAt=new Date().toISOString();theme.updatedAt=theme.createdAt;
 return theme;
}
