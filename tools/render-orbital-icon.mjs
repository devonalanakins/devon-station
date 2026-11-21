/** Deterministic, dependency-free DevonStation Orbital D PWA artwork. */
import {deflateSync} from 'node:zlib';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';

const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*clamp(t);
const segment=(x,y,ax,ay,bx,by)=>{
 const vx=bx-ax,vy=by-ay,t=clamp(((x-ax)*vx+(y-ay)*vy)/(vx*vx+vy*vy));
 return Math.hypot(x-ax-t*vx,y-ay-t*vy);
};
const gaussian=(d,scale)=>Math.exp(-(d*d)/(2*scale*scale));
const crcTable=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[i]=c>>>0;}return t;})();
const crc=buffer=>{let x=0xffffffff;for(const b of buffer)x=crcTable[(x^b)&255]^(x>>>8);return (x^0xffffffff)>>>0;};
const chunk=(type,data)=>{const key=Buffer.from(type,'ascii'),out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);key.copy(out,4);data.copy(out,8);out.writeUInt32BE(crc(out.subarray(4,8+data.length)),8+data.length);return out;};

export function renderOrbitalIcon(size){
 if(![180,192,512].includes(size))throw Error('Unsupported app icon size');
 const raw=Buffer.alloc((size*4+1)*size),scale=512/size;
 for(let py=0;py<size;py++){
  const row=py*(size*4+1);raw[row]=0;
  for(let px=0;px<size;px++){
   const x=(px+0.5)*scale,y=(py+0.5)*scale;
   const cornerX=Math.max(Math.abs(x-256)-156,0),cornerY=Math.max(Math.abs(y-256)-156,0);
   const alpha=1-smooth(-1.5,1.5,Math.hypot(cornerX,cornerY)-100);
   const halo=gaussian(Math.hypot(x-338,y-374),206),top=gaussian(Math.hypot(x-178,y-42),220);
   let r=4+17*halo+6*top,g=12+41*halo+14*top,b=20+38*halo+14*top;
   const dx=x-262,dy=y-256,cs=0.922,ss=-0.387;
   const rx=dx*cs+dy*ss,ry=-dx*ss+dy*cs;
   const orbital=Math.abs(Math.hypot(rx/217,ry/85)-1)*83;
   const ringBack=(1-smooth(1.6,3.8,orbital))*(x<278?0.58:0.86);
   const ringGlow=gaussian(orbital,11)*0.28;
   r+=20*(ringBack+ringGlow);g+=186*(ringBack+ringGlow);b+=137*(ringBack+ringGlow);
   const straight=Math.min(segment(x,y,161,151,161,362),segment(x,y,161,151,241,151),segment(x,y,161,362,241,362));
   const ellipse=Math.abs(Math.hypot((x-241)/116,(y-256.5)/105.5)-1)*105.5;
   const outline=Math.min(straight,x>=239?ellipse:1000);
   const glow=gaussian(outline,25)*0.20,lit=1-smooth(12.2,16.2,outline);
   r+=34*glow;g+=157*glow;b+=139*glow;
   const metal=smooth(84,420,x)*0.52+0.48*smooth(388,124,y);
   const mr=mix(183,234,metal),mg=mix(212,246,metal),mb=mix(220,247,metal);
   r=mix(r,mr,lit);g=mix(g,mg,lit);b=mix(b,mb,lit);
   const edgeGlow=(1-smooth(16,22,outline))*(1-lit);
   r+=18*edgeGlow;g+=120*edgeGlow;b+=102*edgeGlow;
   const arrow=Math.min(segment(x,y,221,207,273,257),segment(x,y,273,257,221,307));
   const arrowLit=1-smooth(7,11,arrow),arrowGlow=gaussian(arrow,20)*0.26;
   r=mix(r,225,arrowLit)+24*arrowGlow;
   g=mix(g,255,arrowLit)+95*arrowGlow;
   b=mix(b,244,arrowLit)+61*arrowGlow;
   const point=Math.hypot(x-389,y-173),star=gaussian(point,5),starGlow=gaussian(point,20)*0.45;
   r=mix(r,242,star)+16*starGlow;g=mix(g,255,star)+85*starGlow;b=mix(b,249,star)+67*starGlow;
   const rim=Math.hypot(cornerX,cornerY)-100,frame=gaussian(rim+14,2.5)*0.09;
   r+=165*frame;g+=242*frame;b+=224*frame;
   const index=row+1+px*4;raw[index]=Math.round(clamp(r/255)*255);raw[index+1]=Math.round(clamp(g/255)*255);raw[index+2]=Math.round(clamp(b/255)*255);raw[index+3]=Math.round(255*alpha);
  }
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(size,0);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
export async function writeOrbitalIcons(directory){
 await mkdir(directory,{recursive:true});
 for(const [filename,size] of [['apple-touch-icon.png',180],['icon-192.png',192],['icon-512.png',512]])await writeFile(join(directory,filename),renderOrbitalIcon(size));
}
const executed=process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href;
if(executed)await writeOrbitalIcons(resolve(process.argv[2]||'./devonstation-icon-output'));
