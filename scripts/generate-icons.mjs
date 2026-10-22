// Extension-owned vector geometry rasterized with supersampling; no external art.
import { deflateSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
const directory='public/icons';await mkdir(directory,{recursive:true});
const crc32=buffer=>{let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let bit=0;bit<8;bit++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;}return (crc^0xffffffff)>>>0;};
const chunk=(name,data)=>{const label=Buffer.from(name),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([label,data])));return Buffer.concat([length,label,data,crc]);};
function rounded(x,y,cx,cy,width,height,radius,angle=0){const theta=angle*Math.PI/180,dx=x-cx,dy=y-cy;const px=Math.cos(theta)*dx+Math.sin(theta)*dy,py=-Math.sin(theta)*dx+Math.cos(theta)*dy;const a=Math.max(Math.abs(px)-width/2+radius,0),b=Math.max(Math.abs(py)-height/2+radius,0);return Math.hypot(a,b)<=radius&&Math.abs(px)<=width/2&&Math.abs(py)<=height/2;}
function pixel(x,y){
 if(!rounded(x,y,64,64,128,128,27))return [0,0,0,0];
 let result=[35,42,37,255];
 if(rounded(x,y,51,69,45,65,6,-14))result=[135,161,141,255];
 if(rounded(x,y,51,69,39,59,4,-14))result=[47,66,56,255];
 if(rounded(x,y,73,61,44,65,6,10))result=[241,237,220,255];
 const dx=x-73,dy=y-62;const diamond=Math.abs(dx)/9+Math.abs(dy)/14;
 if(diamond<1)result=[197,118,93,255];
 if(Math.abs(x-98)/5+Math.abs(y-24)/12<1||Math.abs(x-98)/12+Math.abs(y-24)/5<1)result=[237,171,131,255];
 return result;
}
for(const size of [16,32,48,128]){
 const bytes=Buffer.alloc((size*4+1)*size);let offset=0;
 for(let y=0;y<size;y++){bytes[offset++]=0;for(let x=0;x<size;x++){const channels=[0,0,0,0];for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++){const sample=pixel((x+(sx+.5)/4)*128/size,(y+(sy+.5)/4)*128/size);for(let c=0;c<4;c++)channels[c]+=sample[c];}for(let c=0;c<4;c++)bytes[offset++]=Math.round(channels[c]/16);}}
 const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
 await writeFile(`${directory}/${size}.png`,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(bytes)),chunk('IEND',Buffer.alloc(0))]));
}
