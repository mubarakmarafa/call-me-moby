export const vertex = `
  varying vec2 vUv;
  void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}
`;

export const quantize = `
  varying vec2 vUv;
  uniform sampler2D source;
  uniform vec2 sourceSize, viewSize, grid;
  uniform float scrollY, dither, reveal;
  float bayer(vec2 p){
    vec2 a=mod(floor(p),2.);vec2 b=mod(floor(p/2.),2.);
    return ((2.*a.x+3.*a.y-4.*a.x*a.y)*4.+2.*b.x+3.*b.y-4.*b.x*b.y)/16.-.5;
  }
  void main(){
    float top=1.-vUv.y;
    vec2 uv=vec2(vUv.x,1.-(scrollY+top*viewSize.y)/sourceSize.y);
    vec2 px=.35/sourceSize;
    vec3 color=(texture2D(source,uv+px).rgb+texture2D(source,uv-px).rgb+texture2D(source,uv+vec2(px.x,-px.y)).rgb+texture2D(source,uv+vec2(-px.x,px.y)).rgb)*.25;
    float luma=dot(color,vec3(.2126,.7152,.0722));
    if(uv.y<0.||top>reveal){luma=1.;color=vec3(1.);}
    float shade=floor(clamp(luma+dither*bayer(vUv*grid)/3.,0.,1.)*3.+.5)/3.;
    gl_FragColor=vec4(floor(color*31.+.5)/31.,shade);
  }
`;

export const color = `
  varying vec2 vUv;
  uniform sampler2D source;
  uniform vec2 grid;
  uniform vec3 palette0,palette1,palette2,palette3,panelBg;
  uniform float colorStrength,bleed,density,offTint,crosstalk,xtalkEdge,brightness,contrast,saturation,panelGamma,blackLift,warm;
  float shade(vec2 uv){if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 1.;return texture2D(source,uv).a;}
  float dark(vec2 uv){return 1.-shade(uv);}
  vec3 palette(float q){float t=(1.-q)*3.;if(t<1.)return mix(palette0,palette1,t);if(t<2.)return mix(palette1,palette2,t-1.);return mix(palette2,palette3,t-2.);}
  vec3 pigment(vec2 uv){
    vec3 base=palette(shade(uv));
    if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return base;
    vec3 original=texture2D(source,uv).rgb;
    float chroma=max(max(original.r,original.g),original.b)-min(min(original.r,original.g),original.b);
    vec3 tinted=mix(original*mix(vec3(1.),panelBg,.35),panelBg,.04);
    return mix(base,tinted,colorStrength*smoothstep(.05,.22,chroma));
  }
  void main(){
    vec2 px=1./grid;float q=shade(vUv);float d=1.-q;
    vec3 rgb=pigment(vUv);
    vec3 neighbours=(pigment(vUv+vec2(px.x,0.))+pigment(vUv-vec2(px.x,0.))+pigment(vUv+vec2(0.,px.y))+pigment(vUv-vec2(0.,px.y)))*.25;
    rgb=mix(rgb,neighbours,bleed);
    rgb=density>.5?mix(rgb,palette3,(density-.5)*1.4):mix(rgb,panelBg,(.5-density)*1.4);
    rgb=mix(rgb,palette3,offTint*q);
    float field=0.;
    for(int i=1;i<=40;i++){
      float n=float(i);float up=dark(vUv+vec2(0.,n*px.y));float down=dark(vUv-vec2(0.,n*px.y));
      field+=(up*up+.4*down*down)*exp(-n/12.)/12.;
    }
    for(int i=1;i<=24;i++){float n=float(i);float left=dark(vUv-vec2(n*px.x,0.));field+=.25*left*left*exp(-n/8.)/8.;}
    field+=xtalkEdge*abs(dark(vUv-vec2(0.,px.y))-dark(vUv+vec2(0.,px.y)));
    rgb*=1.-clamp(crosstalk*density*field*(.4+2.4*q*(1.-q)),0.,.65);
    rgb=pow(max(rgb,vec3(0.)),vec3(panelGamma));
    float lum=dot(rgb,vec3(.2126,.7152,.0722));rgb=mix(vec3(lum),rgb,saturation);
    rgb+=warm*lum*vec3(.5,.15,-.4);
    rgb=((rgb-.5)*contrast+.5)*brightness;
    rgb=mix(rgb,panelBg,blackLift);
    gl_FragColor=vec4(clamp(rgb,0.,1.),d);
  }
`;

export const composite = `
  varying vec2 vUv;
  uniform sampler2D source,history,noise;
  uniform vec2 grid,resolution;
  uniform vec3 lightest,shadowColor;
  uniform float gridStrength,pixelSize,gapGain,shadowOffset,shadowBlur,shadowOpacity,paper,grain,gradient,vignette,ghostStrength,ghostGate,dt,hasHistory,elGlow;
  float darkness(vec2 uv){if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return 0.;return texture2D(source,uv).a;}
  float shadow(vec2 uv,float offset,float blur){
    vec2 center=uv+vec2(-offset,offset)/grid;vec2 b=vec2(blur)/grid;
    return darkness(center)*.4+(darkness(center+vec2(b.x,0.))+darkness(center-vec2(b.x,0.))+darkness(center+vec2(0.,b.y))+darkness(center-vec2(0.,b.y)))*.15;
  }
  void main(){
    vec4 ink=texture2D(source,vUv);vec3 rgb=ink.rgb;
    vec2 cell=fract(vUv*grid);float margin=clamp((1.-pixelSize)*.5+.10,0.,.42);
    vec2 aa=max(fwidth(vUv*grid),vec2(.001));
    vec2 edge=smoothstep(vec2(margin)-aa,vec2(margin)+aa,cell)*(1.-smoothstep(vec2(1.-margin)-aa,vec2(1.-margin)+aa,cell));
    float gap=1.-edge.x*edge.y;
    rgb=mix(rgb,lightest*gapGain,gridStrength*gap*ink.a);
    rgb+=elGlow*lightest*gap*(.4+.6*gap)*.18;
    float nearTerm=smoothstep(.40,.75,shadow(vUv,shadowOffset,shadowBlur));
    float farTerm=smoothstep(.34,.80,shadow(vUv,shadowOffset*2.4,shadowBlur*2.6));
    float amt=shadowOpacity*(1.-ink.a)*clamp(nearTerm+.45*farTerm,0.,1.);
    rgb=mix(rgb,shadowColor,amt);
    float n=texture2D(noise,vUv*resolution/128.).r-.5;
    rgb*=1.+paper*n;
    rgb*=1.+gradient*(.5-distance(vUv,vec2(.30,.72)));
    rgb*=1.-vignette*dot(vUv-.5,vUv-.5)*2.;
    rgb+=grain*n;
    vec3 previous=texture2D(history,vUv).rgb;
    if(hasHistory>.5&&ghostStrength>0.){
      float rise=(8.+102.*ghostStrength)/1000.;
      vec3 tau=mix(vec3(rise),vec3(.35*rise),step(rgb,previous));
      vec3 a=1.-exp(-dt/tau);
      a=mix(vec3(1.),a,step(vec3(ghostGate),abs(rgb-previous)));
      rgb=pow(mix(pow(max(previous,vec3(0.)),vec3(2.2)),pow(max(rgb,vec3(0.)),vec3(2.2)),a),vec3(1./2.2));
    }
    gl_FragColor=vec4(clamp(rgb,0.,1.),1.);
  }
`;

export const copy = `varying vec2 vUv;uniform sampler2D source;void main(){gl_FragColor=vec4(texture2D(source,vUv).rgb,1.);}`;
