// CVD simulation (Machado et al. 2009, severity 1.0) in linear RGB, then CIEDE2000.
const M = {
  prot: [[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]],
  deut: [[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]],
  trit: [[1.255528,-0.076749,-0.178779],[-0.078411,0.930809,0.147602],[0.004733,0.691367,0.303900]],
};
const hex = (h)=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
const lin = (c)=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;
const gam = (c)=>{c=Math.min(1,Math.max(0,c));return c<=0.0031308?c*12.92:1.055*c**(1/2.4)-0.055;};
export const toLin = (h)=>hex(h).map(lin);
export function sim(h,type){ if(!type) return toLin(h); const m=M[type], v=toLin(h); return m.map(r=>r[0]*v[0]+r[1]*v[1]+r[2]*v[2]); }
export function lab(l){ const [r,g,b]=l; let X=0.4124*r+0.3576*g+0.1805*b, Y=0.2126*r+0.7152*g+0.0722*b, Z=0.0193*r+0.1192*g+0.9505*b; X/=0.95047;Z/=1.08883; const f=t=>t>216/24389?Math.cbrt(t):(24389/27*t+16)/116; const fx=f(X),fy=f(Y),fz=f(Z); return [116*fy-16,500*(fx-fy),200*(fy-fz)]; }
export function dE00(a,b){ const [L1,a1,b1]=a,[L2,a2,b2]=b; const rad=Math.PI/180,deg=180/Math.PI;
 const C1=Math.hypot(a1,b1),C2=Math.hypot(a2,b2),Cb=(C1+C2)/2,G=0.5*(1-Math.sqrt(Cb**7/(Cb**7+25**7)));
 const a1p=(1+G)*a1,a2p=(1+G)*a2,C1p=Math.hypot(a1p,b1),C2p=Math.hypot(a2p,b2);
 const h=(x,y)=>{const v=Math.atan2(y,x)*deg;return v<0?v+360:v;}; const h1p=C1p?h(a1p,b1):0,h2p=C2p?h(a2p,b2):0;
 const dLp=L2-L1,dCp=C2p-C1p; let dh=0; if(C1p*C2p){dh=h2p-h1p; if(dh>180)dh-=360; else if(dh<-180)dh+=360;}
 const dHp=2*Math.sqrt(C1p*C2p)*Math.sin(dh*rad/2); const Lbp=(L1+L2)/2,Cbp=(C1p+C2p)/2;
 let hbp=h1p+h2p; if(C1p*C2p){ if(Math.abs(h1p-h2p)>180) hbp+= (h1p+h2p<360?360:-360); hbp/=2;}
 const T=1-0.17*Math.cos((hbp-30)*rad)+0.24*Math.cos(2*hbp*rad)+0.32*Math.cos((3*hbp+6)*rad)-0.20*Math.cos((4*hbp-63)*rad);
 const dTh=30*Math.exp(-(((hbp-275)/25)**2)); const Rc=2*Math.sqrt(Cbp**7/(Cbp**7+25**7));
 const Sl=1+0.015*(Lbp-50)**2/Math.sqrt(20+(Lbp-50)**2),Sc=1+0.045*Cbp,Sh=1+0.015*Cbp*T,Rt=-Math.sin(2*dTh*rad)*Rc;
 return Math.sqrt((dLp/Sl)**2+(dCp/Sc)**2+(dHp/Sh)**2+Rt*(dCp/Sc)*(dHp/Sh)); }
export const lum=(h)=>{const [r,g,b]=toLin(h);return 0.2126*r+0.7152*g+0.0722*b;};
export const contrast=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};
export function minPair(colors){ let worst={d:1e9}; for(const type of [null,'prot','deut','trit']) for(let i=0;i<colors.length;i++) for(let j=i+1;j<colors.length;j++){ const d=dE00(lab(sim(colors[i],type)),lab(sim(colors[j],type))); if(d<worst.d) worst={d,type,i,j}; } return worst; }
export function allPairs(colors){ const out=[]; for(const type of [null,'prot','deut','trit']) for(let i=0;i<colors.length;i++) for(let j=i+1;j<colors.length;j++){ out.push({type,i,j,d:dE00(lab(sim(colors[i],type)),lab(sim(colors[j],type)))}); } return out.sort((a,b)=>a.d-b.d); }
