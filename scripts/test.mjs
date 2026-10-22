import { build } from 'esbuild';
import { readdir, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
await mkdir('.test-build', {recursive:true});
const entries = (await readdir('tests')).filter(x=>x.endsWith('.test.ts')).map(x=>'tests/'+x);
await build({entryPoints:entries, outdir:'.test-build', bundle:true, packages:'external', platform:'node', format:'esm', target:'node22', sourcemap:'inline'});
const test = spawn(process.execPath,['--test',...entries.map(x=>x.replace('tests/','.test-build/').replace('.ts','.js'))],{stdio:'inherit'});
test.on('exit', code=>process.exit(code ?? 1));
