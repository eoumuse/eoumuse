import{B as e,L as t,M as n,N as r,S as i,T as a,V as o,n as s,t as c,y as l,z as u}from"./jsx-runtime-B-883Ntx.js";var d=o(e(),1),f=u(),p=class{ctx=null;carrier1=null;carrier2=null;carrier3=null;lfo=null;lfoGain=null;masterGain=null;filter=null;panner=null;delayNode=null;delayFb=null;delaySend=null;delayReturn=null;dry=null;baseFreq=220;_gain=.4;get isRunning(){return this.ctx!==null&&this.ctx.state===`running`}async start(){if(this.ctx)return;this.ctx=new AudioContext;let e=this.ctx.createBuffer(1,1,this.ctx.sampleRate),t=this.ctx.createBufferSource();t.buffer=e,t.connect(this.ctx.destination),t.start(0),await this.ctx.resume();let n=this.ctx;this.carrier1=n.createOscillator(),this.carrier1.type=`sine`,this.carrier1.frequency.value=this.baseFreq,this.carrier2=n.createOscillator(),this.carrier2.type=`sine`,this.carrier2.frequency.value=this.baseFreq*2,this.carrier3=n.createOscillator(),this.carrier3.type=`sine`,this.carrier3.frequency.value=this.baseFreq*3,this.lfo=n.createOscillator(),this.lfo.type=`sine`,this.lfo.frequency.value=.3,this.lfoGain=n.createGain(),this.lfoGain.gain.value=4;let r=n.createGain();r.gain.value=.5;let i=n.createGain();i.gain.value=.3;let a=n.createGain();a.gain.value=.2,this.filter=n.createBiquadFilter(),this.filter.type=`lowpass`,this.filter.frequency.value=1400,this.filter.Q.value=1.2,this.panner=n.createStereoPanner(),this.panner.pan.value=0,this.masterGain=n.createGain(),this.masterGain.gain.value=this._gain,this.delayNode=n.createDelay(2),this.delayNode.delayTime.value=.45,this.delayFb=n.createGain(),this.delayFb.gain.value=.35,this.delaySend=n.createGain(),this.delaySend.gain.value=.28,this.delayReturn=n.createGain(),this.delayReturn.gain.value=.55,this.dry=n.createGain(),this.dry.gain.value=1,this.lfo.connect(this.lfoGain),this.lfoGain.connect(this.carrier1.frequency),this.lfoGain.connect(this.carrier2.frequency),this.lfoGain.connect(this.carrier3.frequency),this.carrier1.connect(r),r.connect(this.filter),this.carrier2.connect(i),i.connect(this.filter),this.carrier3.connect(a),a.connect(this.filter),this.filter.connect(this.panner),this.panner.connect(this.dry),this.dry.connect(this.masterGain),this.panner.connect(this.delaySend),this.delaySend.connect(this.delayNode),this.delayNode.connect(this.delayFb),this.delayFb.connect(this.delayNode),this.delayNode.connect(this.delayReturn),this.delayReturn.connect(this.masterGain),this.masterGain.connect(n.destination),this.carrier1.start(),this.carrier2.start(),this.carrier3.start(),this.lfo.start()}setOrbitParams(e,t,n){if(!this.ctx||!this.carrier1||!this.carrier2||!this.carrier3)return;let r=this.ctx.currentTime,i=.15;this.carrier1.frequency.setTargetAtTime(this.baseFreq,r,i);let a=Math.max(e*.5,.25),o=this.baseFreq*(1+a),s=this.baseFreq*(1+a*1.5);if(this.carrier2.frequency.setTargetAtTime(o,r,i),this.carrier3.frequency.setTargetAtTime(s,r,i),this.lfo&&this.lfo.frequency.setTargetAtTime(.2+e*.15,r,.5),this.lfoGain&&this.lfoGain.gain.setTargetAtTime(2+e*3,r,.3),this.panner&&this.panner.pan.setTargetAtTime(Math.sin(t)*.3,r,.5),this.filter){let e=600+n*3e3;this.filter.frequency.setTargetAtTime(e,r,.3)}}setGain(e){this._gain=e,!(!this.ctx||!this.masterGain)&&this.masterGain.gain.setTargetAtTime(e,this.ctx.currentTime,.05)}stop(){try{this.carrier1?.stop(),this.carrier2?.stop(),this.carrier3?.stop(),this.lfo?.stop()}catch{}this.ctx?.close(),this.ctx=null,this.carrier1=this.carrier2=this.carrier3=null,this.lfo=null,this.lfoGain=null,this.masterGain=null,this.filter=null,this.panner=null,this.delayNode=null,this.delayFb=null,this.delaySend=null,this.delayReturn=null,this.dry=null}},m=c(),h=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,g=`
#define PI 3.14159265358979323846

varying vec2 vUv;
uniform vec2  uRoot;
uniform float uBound;
uniform float uAspect;
uniform float uEpsilon;

vec3 hsl2rgb(float h, float s, float l) {
  float c  = (1.0 - abs(2.0 * l - 1.0)) * s;
  float h6 = fract(h) * 6.0;
  float x  = c * (1.0 - abs(mod(h6, 2.0) - 1.0));
  float m  = l - c * 0.5;
  vec3 col;
  if      (h6 < 1.0) col = vec3(c, x, 0.0);
  else if (h6 < 2.0) col = vec3(x, c, 0.0);
  else if (h6 < 3.0) col = vec3(0.0, c, x);
  else if (h6 < 4.0) col = vec3(0.0, x, c);
  else if (h6 < 5.0) col = vec3(x, 0.0, c);
  else               col = vec3(c, 0.0, x);
  return col + m;
}

vec2 cmul(vec2 a, vec2 b) {
  return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
}

void main() {
  // Map UV → complex plane (aspect-corrected)
  vec2 z = (vUv - 0.5) * 2.0 * uBound;
  z.x *= uAspect;

  // p(z) = z * (z − r)
  vec2 pz = cmul(z, z - uRoot);

  // arg(p(z)) → hue
  float hue = atan(pz.y, pz.x) / (2.0 * PI) + 0.5;
  vec3 color = hsl2rgb(hue, 1.0, 0.5);

  // ── Black clouds: Gaussian density around each root ──────────────────
  float sigma = 0.055;
  float cloud0 = exp(-dot(z, z)           / sigma);
  float cloudR = exp(-dot(z - uRoot, z - uRoot) / sigma);
  float cloud  = clamp(cloud0 + cloudR, 0.0, 1.0);
  color = mix(color, vec3(0.01, 0.01, 0.015), cloud * 0.97);

  // ── White pseudospectrum curves: |p(z)| ≤ ε·√(1+|z|²+|z|⁴) ─────────
  float pLen = length(pz);
  float z2   = dot(z, z);
  float nrm  = sqrt(1.0 + z2 + z2 * z2);
  float lvl  = pLen / nrm;

  float lw = max(nrm * 0.004, 0.003);

  float e1 = uEpsilon * 0.25;
  float e2 = uEpsilon;
  float e3 = uEpsilon * 3.5;

  float c1 = smoothstep(e1 - lw, e1, lvl) - smoothstep(e1, e1 + lw, lvl);
  float c2 = smoothstep(e2 - lw, e2, lvl) - smoothstep(e2, e2 + lw, lvl);
  float c3 = smoothstep(e3 - lw, e3, lvl) - smoothstep(e3, e3 + lw, lvl);
  float curves = clamp(c1 + c2 + c3, 0.0, 1.0);

  color = mix(color, vec3(1.0), curves * 0.9);

  gl_FragColor = vec4(color, 1.0);
}
`,_={orbitRadius:1.25,orbitSpeed:.28,epsilon:.18,gain:.45};function v(){let e=(0,d.useRef)(null),o=(0,d.useRef)(null),c=(0,d.useRef)(null),u=(0,d.useRef)(0),f=(0,d.useRef)(Date.now()),v=(0,d.useRef)({..._}),[b,x]=(0,d.useState)({..._}),[S,C]=(0,d.useState)(!1),[w,T]=(0,d.useState)(0);(0,d.useEffect)(()=>{v.current=b},[b]),(0,d.useEffect)(()=>{let d=e.current;if(!d)return;let p=new s({antialias:!0});p.setPixelRatio(Math.min(window.devicePixelRatio,2)),p.setSize(d.clientWidth,d.clientHeight),d.appendChild(p.domElement);let m=new n,y=new i(-1,1,1,-1,0,1),b={uRoot:{value:new t(_.orbitRadius,0)},uBound:{value:2.1},uAspect:{value:d.clientWidth/d.clientHeight},uEpsilon:{value:_.epsilon}};o.current=b;let x=new r({vertexShader:h,fragmentShader:g,uniforms:b}),S=new a(2,2);m.add(new l(S,x));let C=()=>{p.setSize(d.clientWidth,d.clientHeight),b.uAspect.value=d.clientWidth/d.clientHeight};window.addEventListener(`resize`,C);let w=()=>{u.current=requestAnimationFrame(w);let e=(Date.now()-f.current)/1e3,t=v.current,n=e*t.orbitSpeed;b.uRoot.value.set(Math.cos(n)*t.orbitRadius,Math.sin(n)*t.orbitRadius),b.uEpsilon.value=t.epsilon;let r=c.current;r?.isRunning&&r.setOrbitParams(t.orbitRadius,n,t.epsilon),T(n%(Math.PI*2)),p.render(m,y)};return w(),()=>{cancelAnimationFrame(u.current),window.removeEventListener(`resize`,C),p.dispose(),S.dispose(),x.dispose(),d.removeChild(p.domElement)}},[]);let E=(0,d.useCallback)(async()=>{c.current||=new p;let e=c.current;e.isRunning?(e.stop(),c.current=null,C(!1)):(await e.start(),e.setGain(v.current.gain),C(!0))},[]),D=(0,d.useCallback)((e,t)=>{x(n=>{let r={...n,[e]:t};return v.current=r,e===`gain`&&c.current?.setGain(t),r})},[]),O=(b.orbitRadius*Math.cos(w)).toFixed(3),k=(b.orbitRadius*Math.sin(w)).toFixed(3);return(0,m.jsxs)(`div`,{style:{position:`relative`,width:`100%`,height:`100%`,background:`#000`},children:[(0,m.jsx)(`div`,{ref:e,style:{width:`100%`,height:`100%`}}),(0,m.jsxs)(`div`,{style:{position:`absolute`,top:18,left:22,fontFamily:`Georgia, "Times New Roman", serif`,pointerEvents:`none`},children:[(0,m.jsx)(`div`,{style:{fontSize:15,color:`rgba(255,255,255,0.82)`,letterSpacing:`0.04em`},children:`p(z) = z(z − r)`}),(0,m.jsx)(`div`,{style:{fontSize:10,color:`rgba(255,255,255,0.38)`,marginTop:4,letterSpacing:`0.08em`},children:`colour: arg(p(z)) \xA0·\xA0 white: ε-pseudospectrum \xA0·\xA0 dark: roots`})]}),(0,m.jsxs)(`div`,{style:{position:`absolute`,bottom:18,right:22,fontFamily:`monospace`,fontSize:11,color:`rgba(255,255,255,0.45)`,textAlign:`right`,pointerEvents:`none`,lineHeight:1.9},children:[(0,m.jsxs)(`div`,{children:[`r = `,O,` + `,k,`i`]}),(0,m.jsxs)(`div`,{children:[`|r| = `,b.orbitRadius.toFixed(2),` \xA0 ∠ = `,(w*180/Math.PI).toFixed(1),`°`]}),(0,m.jsxs)(`div`,{children:[`ε = `,b.epsilon.toFixed(3)]})]}),(0,m.jsxs)(`div`,{style:{position:`absolute`,bottom:20,left:`50%`,transform:`translateX(-50%)`,display:`flex`,flexDirection:`column`,alignItems:`center`,gap:10,backdropFilter:`blur(12px)`,background:`rgba(0,0,0,0.45)`,border:`1px solid rgba(255,255,255,0.08)`,borderRadius:14,padding:`14px 22px`,minWidth:320},children:[(0,m.jsxs)(`div`,{style:{display:`flex`,gap:22,alignItems:`flex-end`},children:[(0,m.jsx)(y,{label:`|r| orbit radius`,value:b.orbitRadius,min:.3,max:2.4,step:.01,onChange:e=>D(`orbitRadius`,e)}),(0,m.jsx)(y,{label:`ω speed`,value:b.orbitSpeed,min:.02,max:1.2,step:.01,onChange:e=>D(`orbitSpeed`,e)}),(0,m.jsx)(y,{label:`ε pseudospectrum`,value:b.epsilon,min:.02,max:.8,step:.01,onChange:e=>D(`epsilon`,e)}),(0,m.jsx)(y,{label:`gain`,value:b.gain,min:0,max:1,step:.01,onChange:e=>D(`gain`,e)})]}),(0,m.jsx)(`button`,{onClick:E,style:{marginTop:2,padding:`6px 28px`,borderRadius:20,border:S?`1px solid rgba(255,255,255,0.5)`:`1px solid rgba(255,255,255,0.15)`,background:S?`rgba(255,255,255,0.12)`:`rgba(255,255,255,0.04)`,color:S?`#fff`:`rgba(255,255,255,0.5)`,fontSize:11,letterSpacing:`0.18em`,textTransform:`uppercase`,cursor:`pointer`,transition:`all 0.2s`},children:S?`◼ sound off`:`▶ sound on`})]})]})}function y({label:e,value:t,min:n,max:r,step:i,onChange:a}){return(0,m.jsxs)(`div`,{style:{display:`flex`,flexDirection:`column`,alignItems:`center`,gap:6},children:[(0,m.jsx)(`div`,{style:{fontFamily:`monospace`,fontSize:13,color:`#fff`,fontWeight:300,letterSpacing:`0.02em`},children:t.toFixed(2)}),(0,m.jsx)(`input`,{type:`range`,min:n,max:r,step:i,value:t,onChange:e=>a(parseFloat(e.target.value)),style:{writingMode:`vertical-lr`,direction:`rtl`,height:72,width:28,cursor:`pointer`,accentColor:`#fff`}}),(0,m.jsx)(`div`,{style:{fontFamily:`monospace`,fontSize:9,color:`rgba(255,255,255,0.35)`,letterSpacing:`0.06em`,textAlign:`center`,maxWidth:60},children:e})]})}(0,f.createRoot)(document.getElementById(`root`)).render((0,m.jsx)(d.StrictMode,{children:(0,m.jsx)(`div`,{style:{width:`100vw`,height:`100vh`},children:(0,m.jsx)(v,{})})}));