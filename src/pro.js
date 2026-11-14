/* =====================================================================
   EASTEREGG PRO — capa nueva sobre el motor original
   (selección múltiple, filtros de color, calce con imagen, upscaler, export)
   ===================================================================== */
const MS=new Set();   // clips seleccionados (S.sel sigue siendo el principal)
function msSync(){
  const ids=new Set(S.clips.map(c=>c.id));
  for(const id of [...MS])if(!ids.has(id))MS.delete(id);
  if(S.sel==null)MS.clear();
  else if(!MS.has(S.sel)){MS.clear();MS.add(S.sel)}
}
const PRO=(()=>{
  const LS={
    get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
    set(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){toast('No queda espacio en el navegador para guardar más. Borra alguna referencia.');return false}}
  };
  const isVis=c=>!!c&&(c.type==='video'||c.type==='image');
  const selClips=()=>[...MS].map(id=>S.clips.find(c=>c.id===id)).filter(Boolean);
  const each=fn=>selClips().forEach(fn);
  function topVisualAt(t){
    for(const tid of ['V2','V1']){const c=S.clips.find(x=>x.track===tid&&isVis(x)&&active(x,t));if(c)return c}
    return null;
  }
  function targets(quiet){
    let l=selClips().filter(isVis);
    if(!l.length){
      const c=topVisualAt(S.t);
      if(c){S.sel=c.id;MS.clear();MS.add(c.id);renderTimeline();l=[c]}
    }
    if(!l.length&&!quiet)toast('Selecciona un clip de video o pon el cursor rojo encima de uno.');
    return l;
  }

  /* ------------------------------------------------------------------
     MOTOR GPU: color (filtros) + ULTIMATE UPSCALER (reescalado por bordes)
     ------------------------------------------------------------------ */
  const FX=(()=>{
    let cvs=null,gl=null,pG=null,pE=null,texA=null,texB=null,fbo=null,lutTex=null,ok=false,maxTex=4096,fbW=0,fbH=0,lutKey=null;
    const UG={},UE={};
    const VS=`attribute vec2 a_pos;varying vec2 v_uv;uniform float u_flip;
      void main(){v_uv=a_pos*0.5+0.5;if(u_flip>0.5)v_uv.y=1.0-v_uv.y;gl_Position=vec4(a_pos,0.0,1.0);}`;
    const FS_GRADE=`precision highp float;varying vec2 v_uv;
      uniform sampler2D u_tex;uniform sampler2D u_lut;
      uniform float u_exp,u_con,u_sat,u_temp,u_tint,u_fade,u_amt,u_lookOn,u_lsat;
      uniform vec2 u_zs[3];uniform vec2 u_zr[3];uniform vec2 u_zk[3];
      uniform vec3 u_shT,u_hiT;
      float luma(vec3 c){return dot(c,vec3(0.2126,0.7152,0.0722));}
      void main(){
        vec4 t=texture2D(u_tex,v_uv);vec3 c=t.rgb;
        c*=u_exp;
        c.r*=1.0+u_temp*0.18+u_tint*0.06;c.b*=1.0-u_temp*0.18+u_tint*0.06;c.g*=1.0-u_tint*0.12;
        c=(c-0.5)*u_con+0.5;
        float y0=luma(c);c=mix(vec3(y0),c,u_sat);
        c=clamp(c,0.0,1.0);
        if(u_lookOn>0.5){
          vec3 base=c;
          float Y=luma(c);vec2 ch=vec2(c.b-Y,c.r-Y);
          float ws=1.0-smoothstep(0.05,0.5,Y);float wh=smoothstep(0.5,0.95,Y);float wm=1.0-ws-wh;
          vec2 n=((ch-u_zs[0])*u_zk[0]+u_zr[0])*ws+((ch-u_zs[1])*u_zk[1]+u_zr[1])*wm+((ch-u_zs[2])*u_zk[2]+u_zr[2])*wh;
          float Y2=texture2D(u_lut,vec2(Y*(255.0/256.0)+0.5/256.0,0.5)).r;
          n*=u_lsat*(0.3+0.7*smoothstep(0.0,0.08,Y2));
          float R=Y2+n.y;float B=Y2+n.x;float G=(Y2-0.2126*R-0.0722*B)/0.7152;
          c=mix(base,clamp(vec3(R,G,B),0.0,1.0),u_amt);
        }
        float Y3=luma(c);
        c+=u_shT*(1.0-smoothstep(0.0,0.6,Y3))+u_hiT*smoothstep(0.4,1.0,Y3);
        c=c*(1.0-0.12*u_fade)+0.10*u_fade;
        gl_FragColor=vec4(clamp(c,0.0,1.0),t.a);
      }`;
    // Reescalado adaptativo a los bordes (12 muestras): sigue la dirección de cada borde
    // en vez de difuminarlo, y limita el resultado para no crear halos.
    const FS_EASU=`precision highp float;varying vec2 v_uv;uniform sampler2D u_tex;uniform vec2 u_in;
      vec3 T(vec2 p){return texture2D(u_tex,(p+0.5)/u_in).rgb;}
      float L(vec3 c){return c.b*0.5+(c.r*0.5+c.g);}
      void setE(inout vec2 dir,inout float len,float w,float lA,float lB,float lC,float lD,float lE){
        float dc=lD-lC;float cb=lC-lB;float lenX=1.0/max(max(abs(dc),abs(cb)),1e-5);
        float dirX=lD-lB;dir.x+=dirX*w;lenX=clamp(abs(dirX)*lenX,0.0,1.0);lenX*=lenX;len+=lenX*w;
        float ec=lE-lC;float ca=lC-lA;float lenY=1.0/max(max(abs(ec),abs(ca)),1e-5);
        float dirY=lE-lA;dir.y+=dirY*w;lenY=clamp(abs(dirY)*lenY,0.0,1.0);lenY*=lenY;len+=lenY*w;
      }
      void tap(inout vec3 aC,inout float aW,vec2 off,vec2 dir,vec2 len,float lob,float clp,vec3 col){
        vec2 v=vec2(off.x*dir.x+off.y*dir.y,off.x*(-dir.y)+off.y*dir.x);v*=len;
        float d2=min(dot(v,v),clp);
        float wB=0.4*d2-1.0;float wA=lob*d2-1.0;wB*=wB;wA*=wA;wB=1.5625*wB-0.5625;
        float w=wB*wA;aC+=col*w;aW+=w;
      }
      void main(){
        vec2 pp=v_uv*u_in-0.5;vec2 fp=floor(pp);pp-=fp;
        vec3 b=T(fp+vec2(0.0,-1.0));vec3 c=T(fp+vec2(1.0,-1.0));
        vec3 e=T(fp+vec2(-1.0,0.0));vec3 f=T(fp);vec3 g=T(fp+vec2(1.0,0.0));vec3 h=T(fp+vec2(2.0,0.0));
        vec3 i=T(fp+vec2(-1.0,1.0));vec3 j=T(fp+vec2(0.0,1.0));vec3 k=T(fp+vec2(1.0,1.0));vec3 l=T(fp+vec2(2.0,1.0));
        vec3 n=T(fp+vec2(0.0,2.0));vec3 o=T(fp+vec2(1.0,2.0));
        float bL=L(b),cL=L(c),eL=L(e),fL=L(f),gL=L(g),hL=L(h),iL=L(i),jL=L(j),kL=L(k),lL=L(l),nL=L(n),oL=L(o);
        vec2 dir=vec2(0.0);float len=0.0;
        setE(dir,len,(1.0-pp.x)*(1.0-pp.y),bL,eL,fL,gL,jL);
        setE(dir,len,pp.x*(1.0-pp.y),cL,fL,gL,hL,kL);
        setE(dir,len,(1.0-pp.x)*pp.y,fL,iL,jL,kL,nL);
        setE(dir,len,pp.x*pp.y,gL,jL,kL,lL,oL);
        vec2 dir2=dir*dir;float dirR=dir2.x+dir2.y;bool zro=dirR<(1.0/32768.0);
        dirR=inversesqrt(max(dirR,1e-12));dirR=zro?1.0:dirR;dir.x=zro?1.0:dir.x;dir*=vec2(dirR);
        len=len*0.5;len*=len;
        float stretch=(dir.x*dir.x+dir.y*dir.y)/max(abs(dir.x),abs(dir.y));
        vec2 len2=vec2(1.0+(stretch-1.0)*len,1.0-0.5*len);
        float lob=0.5+((0.25-0.04)-0.5)*len;float clp=1.0/lob;
        vec3 mn=min(min(f,g),min(j,k));vec3 mx=max(max(f,g),max(j,k));
        vec3 aC=vec3(0.0);float aW=0.0;
        tap(aC,aW,vec2(0.0,-1.0)-pp,dir,len2,lob,clp,b);
        tap(aC,aW,vec2(1.0,-1.0)-pp,dir,len2,lob,clp,c);
        tap(aC,aW,vec2(-1.0,1.0)-pp,dir,len2,lob,clp,i);
        tap(aC,aW,vec2(0.0,1.0)-pp,dir,len2,lob,clp,j);
        tap(aC,aW,vec2(0.0,0.0)-pp,dir,len2,lob,clp,f);
        tap(aC,aW,vec2(-1.0,0.0)-pp,dir,len2,lob,clp,e);
        tap(aC,aW,vec2(1.0,1.0)-pp,dir,len2,lob,clp,k);
        tap(aC,aW,vec2(2.0,1.0)-pp,dir,len2,lob,clp,l);
        tap(aC,aW,vec2(2.0,0.0)-pp,dir,len2,lob,clp,h);
        tap(aC,aW,vec2(1.0,0.0)-pp,dir,len2,lob,clp,g);
        tap(aC,aW,vec2(1.0,2.0)-pp,dir,len2,lob,clp,o);
        tap(aC,aW,vec2(0.0,2.0)-pp,dir,len2,lob,clp,n);
        vec3 col=min(mx,max(mn,aC/aW));
        gl_FragColor=vec4(col,texture2D(u_tex,v_uv).a);
      }`;
    function prog(fsSrc,names,store){
      const mk=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);
        if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(sh));return sh};
      const p=gl.createProgram();
      gl.attachShader(p,mk(gl.VERTEX_SHADER,VS));gl.attachShader(p,mk(gl.FRAGMENT_SHADER,fsSrc));
      gl.bindAttribLocation(p,0,'a_pos');gl.linkProgram(p);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));
      names.forEach(n=>store[n]=gl.getUniformLocation(p,n));
      return p;
    }
    function mkTex(){
      const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      return t;
    }
    function init(){
      try{
        cvs=document.createElement('canvas');
        const opt={premultipliedAlpha:false,preserveDrawingBuffer:true,alpha:true,antialias:false};
        gl=cvs.getContext('webgl2',opt)||cvs.getContext('webgl',opt);
        if(!gl)return false;
        pG=prog(FS_GRADE,['u_flip','u_tex','u_lut','u_exp','u_con','u_sat','u_temp','u_tint','u_fade','u_amt','u_lookOn','u_lsat','u_zs','u_zr','u_zk','u_shT','u_hiT'],UG);
        pE=prog(FS_EASU,['u_flip','u_tex','u_in'],UE);
        const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
        texA=mkTex();texB=mkTex();lutTex=mkTex();fbo=gl.createFramebuffer();
        maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE)||4096;
        gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
        gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
        return true;
      }catch(e){console.warn('PRO FX no disponible:',e);return false}
    }
    ok=init();
    const hex3=h=>{h=(h||'#808080').replace('#','');return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]};
    function setLut(look){
      const key=look.id+'|'+look.curve.length+'|'+look.curve[8]+'|'+look.curve[24];
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,lutTex);
      if(key!==lutKey){
        const a=new Uint8Array(256),cv2=look.curve,n=cv2.length-1;
        for(let i=0;i<256;i++){const x=i/255*n,k=Math.min(n-1,x|0);a[i]=Math.round(clamp(cv2[k]+(cv2[k+1]-cv2[k])*(x-k),0,1)*255)}
        gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,256,1,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,a);
        lutKey=key;
      }
      gl.activeTexture(gl.TEXTURE0);
    }
    function gradeOn(g){
      return !!g&&!!(g.exp||g.con||g.sat||g.temp||g.tint||g.fade||g.shA||g.hiA||(g.look&&(g.amt??1)>0));
    }
    function setGrade(g){
      gl.uniform1i(UG.u_tex,0);gl.uniform1i(UG.u_lut,1);
      const con=g.con||0;
      gl.uniform1f(UG.u_exp,Math.pow(2,g.exp||0));
      gl.uniform1f(UG.u_con,con>=0?1+con*0.8:1+con*0.6);
      gl.uniform1f(UG.u_sat,1+(g.sat||0));
      gl.uniform1f(UG.u_temp,g.temp||0);gl.uniform1f(UG.u_tint,g.tint||0);gl.uniform1f(UG.u_fade,g.fade||0);
      const L=g.look,on=L&&(g.amt??1)>0;
      gl.uniform1f(UG.u_lookOn,on?1:0);
      if(on){
        gl.uniform1f(UG.u_amt,clamp(g.amt??1,0,1));gl.uniform1f(UG.u_lsat,L.sat??1);
        gl.uniform2fv(UG.u_zs,new Float32Array(L.zs));gl.uniform2fv(UG.u_zr,new Float32Array(L.zr));gl.uniform2fv(UG.u_zk,new Float32Array(L.zk));
        setLut(L);
      }
      const sh=hex3(g.shC),hi=hex3(g.hiC),sa=(g.shA||0)*0.5,ha=(g.hiA||0)*0.5;
      gl.uniform3f(UG.u_shT,(sh[0]-.5)*sa,(sh[1]-.5)*sa,(sh[2]-.5)*sa);
      gl.uniform3f(UG.u_hiT,(hi[0]-.5)*ha,(hi[1]-.5)*ha,(hi[2]-.5)*ha);
    }
    // Devuelve un canvas con el fotograma procesado, o null si no hay nada que hacer
    function process(c,src,sw,sh,k){
      if(!ok||!sw||!sh||S.bypass)return null;
      const g=c.grade,needG=gradeOn(g);
      let needU=S.upMode==='ultimate'&&k>1.05&&(S.exporting||!S.playing);
      if(!needG&&!needU)return null;
      if(sw>maxTex||sh>maxTex)return null;
      let ow=sw,oh=sh;
      if(needU){
        const lim=Math.min(maxTex,8192);
        const f=Math.min(k,lim/sw,lim/sh,Math.sqrt(36e6/(sw*sh)));
        if(f<1.05)needU=false;else{ow=Math.round(sw*f);oh=Math.round(sh*f)}
      }
      if(!needG&&!needU)return null;
      try{
        if(cvs.width!==ow||cvs.height!==oh){cvs.width=ow;cvs.height=oh}
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texA);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);
        if(needG){
          gl.useProgram(pG);
          if(needU){
            gl.bindTexture(gl.TEXTURE_2D,texB);
            if(fbW!==sw||fbH!==sh){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,sw,sh,0,gl.RGBA,gl.UNSIGNED_BYTE,null);fbW=sw;fbH=sh}
            gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
            gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texB,0);
            gl.bindTexture(gl.TEXTURE_2D,texA);
            gl.viewport(0,0,sw,sh);
          }else{gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,ow,oh)}
          gl.uniform1f(UG.u_flip,1);
          setGrade(g);
          gl.drawArrays(gl.TRIANGLES,0,6);
        }
        if(needU){
          gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,ow,oh);
          gl.useProgram(pE);
          gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,needG?texB:texA);
          gl.uniform1i(UE.u_tex,0);gl.uniform1f(UE.u_flip,needG?0:1);gl.uniform2f(UE.u_in,sw,sh);
          gl.drawArrays(gl.TRIANGLES,0,6);
        }
        return cvs;
      }catch(e){return null}
    }
    return {process,gradeOn,get ok(){return ok}};
  })();

  /* ------------------------------------------------------------------
     ANÁLISIS DE COLOR (imagen de referencia o fotogramas de un clip)
     ------------------------------------------------------------------ */
  const sst=(a,b,x)=>{x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x)};
  function newAcc(){return {h:new Float64Array(256),n:0,z:[0,1,2].map(()=>({w:0,b:0,r:0,bb:0,rr:0})),sy:0,sb:0,sr:0}}
  function addPx(acc,d){
    for(let i=0;i<d.length;i+=4){
      if(d[i+3]<128)continue;
      const R=d[i]/255,G=d[i+1]/255,B=d[i+2]/255;
      const Y=.2126*R+.7152*G+.0722*B,cb=B-Y,cr=R-Y;
      acc.h[Math.min(255,(Y*255)|0)]++;acc.n++;acc.sy+=Y;acc.sb+=cb;acc.sr+=cr;
      const ws=1-sst(.05,.5,Y),wh=sst(.5,.95,Y),w=[ws,1-ws-wh,wh];
      for(let k=0;k<3;k++){const x=w[k];if(x<=0)continue;const z=acc.z[k];z.w+=x;z.b+=x*cb;z.r+=x*cr;z.bb+=x*cb*cb;z.rr+=x*cr*cr}
    }
  }
  function finish(acc){
    const n=Math.max(1,acc.n),cdf=[];let s=0;
    for(let i=0;i<256;i++){s+=acc.h[i];cdf.push(s/n)}
    const q=[];let j=0;
    for(let i=0;i<=32;i++){const p=(i/32)*0.998+0.001;while(j<255&&cdf[j]<p)j++;q.push(+(j/255).toFixed(4))}
    let tv=0;
    const z=acc.z.map(o=>{const w=Math.max(1e-6,o.w),b=o.b/w,r=o.r/w;tv+=o.bb+o.rr;
      return {w:+(o.w/n).toFixed(4),b:+b.toFixed(5),r:+r.toFixed(5),sd:+Math.sqrt(Math.max(0,o.bb/w-b*b)+Math.max(0,o.rr/w-r*r)).toFixed(5)}});
    const mb=acc.sb/n,mr=acc.sr/n;
    return {q,cdf,z,y:acc.sy/n,b:mb,r:mr,sd:Math.sqrt(Math.max(0,tv/n-mb*mb-mr*mr))};
  }
  const lerpA=(arr,x)=>{x=clamp(x,0,1)*(arr.length-1);const i=Math.min(arr.length-2,x|0);return arr[i]+(arr[i+1]-arr[i])*(x-i)};
  // Suaviza la curva y limita su pendiente para que nunca rompa la imagen (sin bandas ni negros aplastados)
  function tidy(c){
    const n=c.length-1;c=c.slice();c[0]=Math.min(c[0],0.2);
    for(let k=0;k<2;k++){const o=c.slice();for(let i=1;i<n;i++)c[i]=(o[i-1]+2*o[i]+o[i+1])/4}
    const lo=.3/n,hi=3.2/n,r=[c[0]];
    for(let i=1;i<=n;i++)r.push(r[i-1]+clamp(c[i]-c[i-1],lo,hi));
    const span=r[n]-r[0],want=clamp(c[n],r[0]+.2,1)-r[0],s=span>1e-6?Math.min(1,want/span):1;
    return r.map(v=>+clamp(r[0]+(v-r[0])*s,0,1).toFixed(4));
  }
  const zoneOr=(st,k)=>st.z[k].w<0.02?{b:st.b,r:st.r,sd:st.sd}:st.z[k];
  // FILTRO: guarda el "look" de la imagen. No depende del clip, se puede reutilizar.
  function filterLook(ref,name){
    const st=ref.st,curve=[];
    for(let i=0;i<=32;i++){const x=i/32;const v=lerpA(st.q,Math.pow(x,0.8));curve.push(x+(v-x)*0.6)}
    const kq=st.sd<0.012?0:clamp(st.sd/0.085,0.3,1.45),zr=[],zk=[];
    for(let k=0;k<3;k++){const z=zoneOr(st,k);const mg=Math.hypot(z.b,z.r),lim=mg>0.22?0.22/mg:1;zr.push(+(z.b*0.9*lim).toFixed(5),+(z.r*0.9*lim).toFixed(5));zk.push(kq,kq)}
    return {id:uid(),name:name||ref.name,mode:'filtro',curve:tidy(curve),zs:[0,0,0,0,0,0],zr,zk,sat:1,refId:ref.id};
  }
  // CALCE: compara el clip con la imagen y calcula lo que le falta a ESE clip para parecerse.
  function matchLook(src,ref){
    const st=ref.st,curve=[];
    for(let i=0;i<=32;i++){const x=i/32;const v=lerpA(st.q,lerpA(src.cdf,x));curve.push(x+(v-x)*0.85)}
    const zs=[],zr=[],zk=[];
    for(let k=0;k<3;k++){
      const a=zoneOr(src,k),b=zoneOr(st,k);
      const kq=st.sd<0.012?0:clamp(b.sd/Math.max(a.sd,0.01),0.5,2);
      zs.push(+a.b.toFixed(5),+a.r.toFixed(5));zr.push(+b.b.toFixed(5),+b.r.toFixed(5));zk.push(+kq.toFixed(3),+kq.toFixed(3));
    }
    return {id:uid(),name:ref.name,mode:'calce',curve:tidy(curve),zs,zr,zk,sat:1,refId:ref.id};
  }
  // Filtros de fábrica (fórmulas propias, no copiados de ninguna imagen)
  function mk(id,name,o){
    const n=32,c=[],con=o.con||0,fade=o.fade||0,gam=o.gam||1,roll=o.roll||0;
    for(let i=0;i<=n;i++){let x=Math.pow(i/n,gam);const s=x*x*(3-2*x);x=x+(s-x)*con*1.2;x=fade*0.09+x*(1-fade*0.09-roll*0.06);c.push(+clamp(x,0,1).toFixed(4))}
    return {id,name,mode:'filtro',builtin:true,curve:c,zs:[0,0,0,0,0,0],zr:[...(o.sh||[0,0]),...(o.mid||[0,0]),...(o.hi||[0,0])],zk:[1,1,1,1,1,1],sat:o.sat??1};
  }
  const BUILTIN=[
    mk('b_teal','Teal & Orange',{sh:[.02,-.045],hi:[-.045,.035],con:.2,sat:1.08}),
    mk('b_warm','Película cálida',{sh:[.01,-.01],mid:[-.02,.015],hi:[-.035,.03],fade:.5,con:.08,sat:.95}),
    mk('b_thr','Thriller oscuro',{gam:1.18,con:.32,sat:.82,sh:[.015,-.03],hi:[-.01,.01]}),
    mk('b_neon','Neón nocturno',{sh:[.05,.02],mid:[.01,0],hi:[.02,-.035],sat:1.35,con:.28}),
    mk('b_night','Noche azul',{sh:[.05,-.04],mid:[.04,-.035],hi:[.03,-.03],gam:1.25,sat:.75,con:.15}),
    mk('b_code','Verde código',{sh:[-.03,-.035],mid:[-.03,-.03],hi:[-.02,-.015],con:.22,sat:.8}),
    mk('b_desert','Desierto',{sh:[-.03,.02],mid:[-.05,.035],hi:[-.06,.04],sat:1.2,con:.3}),
    mk('b_cold','Invierno frío',{mid:[.03,-.025],hi:[.025,-.02],sat:.8,con:.12}),
    mk('b_bleach','Bleach bypass',{sat:.5,con:.4}),
    mk('b_bw','Blanco y negro cine',{sat:0,con:.3}),
    mk('b_pastel','Pastel suave',{fade:.9,con:-.25,sat:.85,hi:[-.015,.015],roll:1}),
    mk('b_70s','Vintage 70s',{fade:1,con:-.05,mid:[-.035,.02],hi:[-.04,.02],sat:.78,roll:.6})
  ];

  /* ------------------------------------------------------------------
     Fotogramas pequeños para analizar (clips e imágenes)
     ------------------------------------------------------------------ */
  const small=document.createElement('canvas');small.width=128;small.height=72;
  const sctx=small.getContext('2d',{willReadFrequently:true});
  function drawSmall(src,sw,sh){sctx.clearRect(0,0,128,72);sctx.drawImage(src,0,0,sw,sh,0,0,128,72);return sctx.getImageData(0,0,128,72).data}
  function anVideo(m){
    if(m._an)return m._an;
    const v=document.createElement('video');v.muted=true;v.preload='auto';v.playsInline=true;v.src=m.url;m._an=v;return v;
  }
  // withBase: mide el clip con sus ajustes de Luz/Calidez ya aplicados (para el calce)
  async function clipStats(c,n,withBase){
    const acc=newAcc(),m=M.get(c.mediaId);if(!m||m.offline)return null;
    const base=withBase&&c.grade?{...c.grade,look:null}:null;
    const take=(src,sw,sh)=>{
      let s=src;
      if(base&&FX.gradeOn(base)){const r=FX.process({grade:base},src,sw,sh,1);if(r)s=r}
      addPx(acc,drawSmall(s,s===src?sw:s.width,s===src?sh:s.height));
    };
    if(c.type==='image'){if(!m.img)return null;take(m.img,m.w,m.h)}
    else{
      const v=anVideo(m);
      for(let i=0;i<n;i++){
        await seekVideoExact(v,clipSourceTimeAt(c,c.dur*(i+.5)/n));
        if(v.videoWidth)take(v,v.videoWidth,v.videoHeight);
      }
    }
    return acc.n?finish(acc):null;
  }

  /* ------------------------------------------------------------------
     REFERENCIAS Y BIBLIOTECA DE FILTROS
     ------------------------------------------------------------------ */
  let refs=LS.get('ee-pro-refs',[]),myLooks=LS.get('ee-pro-looks',[]),refSel=null,more=LS.get('ee-pro-more',false);
  function palette(d){
    const B=new Map();
    for(let i=0;i<d.length;i+=4){const k=(d[i]>>5)<<6|(d[i+1]>>5)<<3|(d[i+2]>>5);let o=B.get(k);if(!o){o=[0,0,0,0];B.set(k,o)}o[0]+=d[i];o[1]+=d[i+1];o[2]+=d[i+2];o[3]++}
    const list=[...B.values()].sort((a,b)=>b[3]-a[3]).map(o=>[o[0]/o[3],o[1]/o[3],o[2]/o[3]]),out=[];
    for(const c of list){if(out.every(p=>Math.hypot(p[0]-c[0],p[1]-c[1],p[2]-c[2])>58))out.push(c);if(out.length>=5)break}
    return out.map(c=>'#'+c.map(v=>Math.round(v).toString(16).padStart(2,'0')).join(''));
  }
  async function addRefs(files){
    let n=0;
    for(const f of [...files]){
      if(!(f.type||'').startsWith('image/')&&!/\.(jpe?g|png|webp|avif|gif|bmp)$/i.test(f.name))continue;
      try{
        const bmp=await createImageBitmap(f);
        const k=Math.min(1,320/Math.max(bmp.width,bmp.height));
        const tc=document.createElement('canvas');tc.width=Math.max(1,Math.round(bmp.width*k));tc.height=Math.max(1,Math.round(bmp.height*k));
        tc.getContext('2d').drawImage(bmp,0,0,tc.width,tc.height);
        const d=drawSmall(bmp,bmp.width,bmp.height),acc=newAcc();addPx(acc,d);
        const st=finish(acc);delete st.cdf;
        const r={id:uid(),name:f.name.replace(/\.\w+$/,'').slice(0,40),thumb:tc.toDataURL('image/jpeg',.8),st,pal:palette(d)};
        bmp.close&&bmp.close();
        refs.unshift(r);refSel=r.id;n++;
      }catch(e){toast('No pude leer la imagen '+f.name)}
    }
    if(n){while(refs.length>60)refs.pop();LS.set('ee-pro-refs',refs);renderRefs();toast(n+' imagen(es) de referencia añadidas. Ahora elige: Crear filtro o Calzar en vivo.',5000)}
  }
  function renderRefs(){
    const g=$('#refGrid');if(!g)return;g.innerHTML='';
    if(!refs.length){g.innerHTML='<div class="hint" style="grid-column:1/-1">Aún no hay imágenes. Añade un fotograma de una película, una foto o cualquier imagen con el color que te gusta.</div>'}
    for(const r of refs){
      const d=document.createElement('div');d.className='ref'+(r.id===refSel?' on':'');d.title=r.name;
      d.style.backgroundImage=`url('${r.thumb}')`;
      d.innerHTML='<button class="x" title="Eliminar esta referencia">✕</button>';
      d.onclick=e=>{
        if(e.target.classList.contains('x')){refs=refs.filter(x=>x.id!==r.id);if(refSel===r.id)refSel=null;LS.set('ee-pro-refs',refs);renderRefs();return}
        refSel=r.id;renderRefs();
      };
      g.appendChild(d);
    }
    const r=refs.find(x=>x.id===refSel),box=$('#refActions');
    box.style.display=r?'block':'none';
    if(r){$('#refPal').innerHTML=(r.pal||[]).map(c=>`<i style="background:${c}" title="${c}"></i>`).join('');$('#refName').textContent=r.name}
  }
  function stripLook(l){const {thumb,builtin,...L}=l;return L}
  function applyLook(look){
    const t=targets();if(!t.length)return;
    t.forEach(c=>{const g=c.grade||{};c.grade={...g,look:stripLook(look),amt:g.amt>0?g.amt:1}});
    commit();renderAll();
    toast(`Filtro "${look.name}" aplicado a ${t.length} clip(s).`);
  }
  function makeFilter(){
    const r=refs.find(x=>x.id===refSel);if(!r)return toast('Elige primero una imagen de referencia.');
    const look=filterLook(r);
    myLooks.unshift(look);LS.set('ee-pro-looks',myLooks);
    renderLooks();
    if(targets(true).length)applyLook(look);else toast(`Filtro "${look.name}" guardado en "Mis filtros".`);
  }
  let busy=false;
  async function matchLive(){
    const r=refs.find(x=>x.id===refSel);if(!r)return toast('Elige primero una imagen de referencia.');
    const t=targets();if(!t.length||busy)return;
    busy=true;toast('Analizando tu clip y comparándolo con la imagen…',20000);
    try{
      let n=0;
      for(const c of t){
        const st=await clipStats(c,3,true);if(!st)continue;
        const g=c.grade||{};c.grade={...g,look:matchLook(st,r),amt:g.amt>0?g.amt:1};n++;
      }
      commit();renderAll();
      toast(n?`Listo: ${n} clip(s) calzados con "${r.name}". Ajusta la Intensidad si lo quieres más suave.`:'No pude analizar el clip (¿archivo sin vincular?).',6000);
    }finally{busy=false}
  }
  async function equalize(){
    const l=selClips().filter(isVis).sort((a,b)=>a.start-b.start);
    if(l.length<2)return toast('Selecciona 2 o más clips (Ctrl+clic) para igualarlos.');
    if(busy)return;busy=true;
    // el clip modelo es el principal (el último que tocaste); los demás copian su filtro y ajustes
    const ref=l.find(c=>c.id===S.sel)||l[0];
    toast('Igualando luz y color con el clip modelo…',20000);
    try{
      const a=await clipStats(ref,2,false);if(!a){toast('No pude analizar el clip modelo.');return}
      const rg=JSON.parse(JSON.stringify(ref.grade||{}));
      let n=0;
      for(const c of l){
        if(c===ref)continue;
        const s=await clipStats(c,2,false);if(!s)continue;
        const y=Math.max(s.y,.04),ya=Math.max(a.y,.04),e=clamp(Math.log2(ya/y),-1.5,1.5),yy=Math.max(.1,ya);
        const temp=clamp(((a.r-a.b)-(s.r-s.b)*Math.pow(2,e))/(0.36*yy),-1,1);
        const tint=clamp(((a.b+a.r)-(s.b+s.r)*Math.pow(2,e))/(0.26*yy),-1,1);
        c.grade={...JSON.parse(JSON.stringify(rg)),
          exp:+clamp((rg.exp||0)+e,-2,2).toFixed(2),temp:+clamp((rg.temp||0)+temp,-1,1).toFixed(2),tint:+clamp((rg.tint||0)+tint,-1,1).toFixed(2)};
        ['bright','contrast','sat','hue','blur'].forEach(k=>c[k]=ref[k]);
        n++;
      }
      commit();renderAll();
      const m=M.get(ref.mediaId);
      toast(`${n} clip(s) igualados a «${m?m.name:'clip modelo'}», con su mismo filtro y ajustes de color.`,6500);
    }finally{busy=false}
  }
  function clearLook(){
    const t=targets();if(!t.length)return;
    t.forEach(c=>{delete c.grade});commit();renderAll();toast('Color original restaurado.');
  }

  /* --- galería de filtros con vista previa sobre tu propio fotograma --- */
  const snapCv=document.createElement('canvas');snapCv.width=160;snapCv.height=90;
  function snapSource(){
    const g=snapCv.getContext('2d');
    const c=selClips().find(isVis)||topVisualAt(S.t);
    let src=null,sw=0,sh=0;
    if(c){const m=M.get(c.mediaId);
      if(c.type==='image'&&m&&m.img){src=m.img;sw=m.w;sh=m.h}
      else{const el=getEl(c);if(el&&el.readyState>=2&&el.videoWidth){src=el;sw=el.videoWidth;sh=el.videoHeight}}}
    if(src){const k=Math.max(160/sw,90/sh);try{g.drawImage(src,(160-sw*k)/2,(90-sh*k)/2,sw*k,sh*k);return}catch(e){}}
    // sin clip: escena de prueba (cielo, piel, sombras)
    const gr=g.createLinearGradient(0,0,0,90);gr.addColorStop(0,'#7fa8d8');gr.addColorStop(.55,'#d9c7a8');gr.addColorStop(.56,'#5b6b3c');gr.addColorStop(1,'#1c1a17');
    g.fillStyle=gr;g.fillRect(0,0,160,90);
    g.fillStyle='#c98f6f';g.beginPath();g.arc(52,50,17,0,7);g.fill();
    g.fillStyle='#b23a2e';g.fillRect(100,42,30,30);g.fillStyle='#f4f1ea';g.fillRect(112,20,34,12);
  }
  function renderLooks(){
    const g=$('#lookGrid');if(!g)return;g.innerHTML='';
    snapSource();
    const cur=(selClips().find(isVis)||{}).grade;
    const curId=cur&&cur.look?cur.look.id:null;
    const add=(look,mine)=>{
      const d=document.createElement('div');d.className='lk'+(look.id===curId?' on':'');
      const tc=document.createElement('canvas');tc.width=160;tc.height=90;
      const r=FX.process({grade:{look,amt:1}},snapCv,160,90,1);
      tc.getContext('2d').drawImage(r||snapCv,0,0,160,90);
      d.appendChild(tc);
      const nm=document.createElement('span');nm.textContent=look.name;d.appendChild(nm);
      if(mine){const x=document.createElement('button');x.className='x';x.textContent='✕';x.title='Eliminar este filtro';d.appendChild(x)}
      d.onclick=e=>{
        if(e.target.classList.contains('x')){myLooks=myLooks.filter(x=>x.id!==look.id);LS.set('ee-pro-looks',myLooks);renderLooks();return}
        applyLook(look);
      };
      g.appendChild(d);
    };
    if(myLooks.length){const h=document.createElement('div');h.className='lkh';h.textContent='Mis filtros (creados de tus imágenes)';g.appendChild(h);myLooks.forEach(l=>add(l,true))}
    const h=document.createElement('div');h.className='lkh';h.textContent='Filtros de cine';g.appendChild(h);
    BUILTIN.forEach(l=>add(l,false));
  }
  let lkT=0;
  function looksSoon(){clearTimeout(lkT);lkT=setTimeout(()=>{if($('#tab-look').classList.contains('on'))renderLooks()},260)}

  /* --- deslizadores de ajuste --- */
  const SL=[
    ['amt','Intensidad del filtro',0,1,1,'Cuánto se nota el filtro. 0 = nada, 100 = completo.'],
    ['exp','Luz',-2,2,0,'Más claro o más oscuro. Úsalo para calzar clips entre sí.'],
    ['con','Contraste',-1,1,0,'Diferencia entre lo claro y lo oscuro.'],
    ['sat','Color',-1,1,0,'Colores más vivos o más apagados.'],
    ['temp','Calidez',-1,1,0,'Hacia naranja (cálido) o hacia azul (frío).']
  ];
  const SL2=[
    ['tint','Tinte (verde ↔ magenta)',-1,1,0,'Corrige dominantes verdes o rosadas.'],
    ['fade','Negros lavados',0,1,0,'Levanta los negros para un aire de película antigua.'],
    ['shA','Color en las sombras',0,1,0,'Cuánto tiñes las partes oscuras con el color elegido.'],
    ['hiA','Color en las luces',0,1,0,'Cuánto tiñes las partes claras con el color elegido.']
  ];
  function setG(key,val){
    const t=targets(true);
    t.forEach(c=>{c.grade={...(c.grade||{}),[key]:val}});
    renderFrame();
    return t.length;
  }
  function buildSliders(){
    const mkRow=(box,[key,label,min,max,def,tip])=>{
      const d=document.createElement('div');d.className='gs';d.title=tip+' (doble clic para reiniciar)';d.dataset.k=key;d.dataset.def=def;
      d.innerHTML=`<label>${label}<span></span></label><input type="range" min="${min}" max="${max}" step="0.01" value="${def}">`;
      const r=d.querySelector('input'),sp=d.querySelector('span');
      const show=()=>{sp.textContent=(key==='amt'||key==='fade'||key==='shA'||key==='hiA')?Math.round(r.value*100)+'%':(+r.value>0?'+':'')+(+r.value).toFixed(2)};
      d._set=v=>{r.value=v;show()};
      r.oninput=()=>{show();if(!setG(key,+r.value))toast('Selecciona un clip de video primero.')};
      r.onchange=()=>{commit();renderTimeline()};
      d.ondblclick=()=>{r.value=def;show();setG(key,def);commit();renderTimeline()};
      show();box.appendChild(d);
    };
    SL.forEach(s=>mkRow($('#gradeBox'),s));
    SL2.forEach(s=>mkRow($('#gradeMoreBox'),s));
    [['shC','#shC'],['hiC','#hiC']].forEach(([k,id])=>{const el=$(id);el.oninput=()=>setG(k,el.value);el.onchange=()=>commit()});
  }
  function syncSliders(){
    const c=selClips().find(isVis)||null,g=(c&&c.grade)||{};
    $$('#tab-look .gs').forEach(d=>{const k=d.dataset.k;d._set&&d._set(g[k]??+d.dataset.def)});
    if($('#shC')){$('#shC').value=g.shC||'#808080';$('#hiC').value=g.hiC||'#808080'}
    const lab=$('#lookNow');
    if(lab){
      const n=selClips().filter(isVis).length;
      if(!c)lab.innerHTML='Ningún clip seleccionado. Haz clic en un clip del timeline.';
      else lab.innerHTML=(n>1?`<b>${n} clips</b> · `:'')+(g.look?`${g.look.mode==='calce'?'🎯 Calce en vivo con':'✨ Filtro'}: <b>${g.look.name}</b>`:'Sin filtro (color original)');
    }
  }
  /* --- gráfico de luz (histograma) --- */
  const hcv=document.createElement('canvas');hcv.width=96;hcv.height=54;const hctx=hcv.getContext('2d',{willReadFrequently:true});
  function drawScope(){
    const sc=$('#scope');if(!sc||!more||!$('#tab-look').classList.contains('on'))return;
    hctx.drawImage(cv,0,0,96,54);const d=hctx.getImageData(0,0,96,54).data;
    const H=[new Float32Array(64),new Float32Array(64),new Float32Array(64)];
    for(let i=0;i<d.length;i+=4)for(let k=0;k<3;k++)H[k][d[i+k]>>2]++;
    const g=sc.getContext('2d'),W=sc.width,Hh=sc.height;g.clearRect(0,0,W,Hh);g.globalCompositeOperation='lighter';
    let mx=1;H.forEach(h=>{for(let i=1;i<63;i++)if(h[i]>mx)mx=h[i]});
    ['#ff5a5a','#5ad27a','#5a9bff'].forEach((col,k)=>{g.fillStyle=col+'aa';g.beginPath();g.moveTo(0,Hh);for(let i=0;i<64;i++)g.lineTo(i/63*W,Hh-Math.min(1,H[k][i]/mx)*(Hh-4));g.lineTo(W,Hh);g.fill()});
    g.globalCompositeOperation='source-over';
  }

  /* ------------------------------------------------------------------
     SELECCIÓN MÚLTIPLE EN EL TIMELINE
     ------------------------------------------------------------------ */
  function clipPick(e,c,mode){
    if(e.ctrlKey||e.metaKey||PRO.multiTap){
      if(MS.has(c.id)&&MS.size>1){MS.delete(c.id);if(S.sel===c.id)S.sel=[...MS][MS.size-1]}
      else{MS.add(c.id);S.sel=c.id}
      renderAll();return true;
    }
    if(e.shiftKey&&S.sel&&S.sel!==c.id){
      const a=selClip();
      if(a){const lo=Math.min(a.start,c.start),hi=Math.max(a.start+a.dur,c.start+c.dur);
        S.clips.forEach(x=>{if(x.start>=lo-1e-6&&x.start+x.dur<=hi+1e-6)MS.add(x.id)})}
      MS.add(c.id);S.sel=c.id;renderAll();return true;
    }
    if(mode==='m'&&MS.size>1&&MS.has(c.id)){groupDrag(e,c);return true}
    MS.clear();MS.add(c.id);return false;
  }
  function groupDrag(e,c){
    S.sel=c.id;
    const x0=e.clientX,items=selClips().map(x=>({x,s:x.start})),me=items.find(i=>i.x===c),minS=Math.min(...items.map(i=>i.s));
    let moved=false;
    const mv=ev=>{
      if(Math.abs(ev.clientX-x0)>3)moved=true;if(!moved)return;
      let d=Math.max(0,snapTo(me.s+(ev.clientX-x0)/S.pps,c.id,c.dur))-me.s;d=Math.max(d,-minS);
      items.forEach(i=>i.x.start=i.s+d);renderTimeline();
    };
    const up=()=>{
      removeEventListener('pointermove',mv);removeEventListener('pointerup',up);$('#snapline').style.display='none';
      if(moved){
        const ids=new Set(items.map(i=>i.x.id));
        // empuja el grupo completo si choca con clips que no están seleccionados
        items.sort((a,b)=>a.x.start-b.x.start).forEach(i=>{
          const hit=S.clips.some(o=>!ids.has(o.id)&&o.track===i.x.track&&i.x.start<o.start+o.dur-1e-6&&i.x.start+i.x.dur>o.start+1e-6);
          if(hit)i.x.start=freeSlot(i.x.track,i.x.start,i.x.dur,i.x.id);
        });
        commit();
      }else{MS.clear();MS.add(c.id)}
      renderAll();
    };
    addEventListener('pointermove',mv);addEventListener('pointerup',up);
    renderTimeline();renderInspector();
  }
  function wireMarquee(){
    $('#tracks').addEventListener('pointerdown',e=>{
      if(e.button!==0||e.pointerType==='touch'||!e.target.classList.contains('trk'))return;
      const x0=e.clientX,y0=e.clientY;let box=null;
      const mv=ev=>{
        if(!box&&Math.hypot(ev.clientX-x0,ev.clientY-y0)>6){box=document.createElement('div');box.id='marq';$('#tlin').appendChild(box)}
        if(!box)return;
        const r=$('#tlin').getBoundingClientRect();
        box.style.left=(Math.min(x0,ev.clientX)-r.left)+'px';box.style.top=(Math.min(y0,ev.clientY)-r.top)+'px';
        box.style.width=Math.abs(ev.clientX-x0)+'px';box.style.height=Math.abs(ev.clientY-y0)+'px';
      };
      const up=ev=>{
        removeEventListener('pointermove',mv);removeEventListener('pointerup',up);
        if(!box)return;
        const r=$('#tlin').getBoundingClientRect(),t1=(Math.min(x0,ev.clientX)-r.left)/S.pps,t2=(Math.max(x0,ev.clientX)-r.left)/S.pps;
        const ya=Math.min(y0,ev.clientY),yb=Math.max(y0,ev.clientY),rows=new Set();
        $$('#tracks .trk').forEach(row=>{const q=row.getBoundingClientRect();if(q.bottom>ya&&q.top<yb)rows.add(row.dataset.id)});
        box.remove();MS.clear();let last=null;
        S.clips.forEach(c=>{if(rows.has(c.track)&&c.start<t2&&c.start+c.dur>t1){MS.add(c.id);last=c.id}});
        S.sel=last;renderAll();
        if(MS.size>1)toast(MS.size+' clips seleccionados.');
      };
      addEventListener('pointermove',mv);addEventListener('pointerup',up);
    });
  }
  function delMulti(){
    S.clips=S.clips.filter(c=>!MS.has(c.id));S.sel=null;MS.clear();commit();renderAll();
  }
  function dupMulti(){
    const l=selClips().sort((a,b)=>a.start-b.start);if(!l.length)return;
    const g0=l[0].start,gEnd=Math.max(...l.map(c=>c.start+c.dur)),nid=[];
    for(const c of l){
      const b=JSON.parse(JSON.stringify(c));b.id=uid();
      b.start=freeSlot(c.track,gEnd+(c.start-g0),c.dur);S.clips.push(b);nid.push(b.id);
    }
    MS.clear();nid.forEach(i=>MS.add(i));S.sel=nid[nid.length-1];commit();renderAll();
  }

  /* ------------------------------------------------------------------
     MEDIA: elegir varios archivos y soltarlos juntos
     ------------------------------------------------------------------ */
  const BS=new Set();let lastB=null;
  function binPaint(){$$('#bin .mi').forEach(d=>d.classList.toggle('bsel',BS.has(d.dataset.mid)))}
  function binItem(d,m){
    d.dataset.mid=m.id;if(BS.has(m.id))d.classList.add('bsel');
    const x=document.createElement('button');x.className='rm';x.textContent='✕';x.title='Quitar este archivo del proyecto';
    x.onclick=e=>{e.stopPropagation();removeMedia(m)};d.appendChild(x);
    d.addEventListener('click',e=>{
      if(e.target.closest('button'))return;
      const ids=[...M.keys()];
      if(e.shiftKey&&lastB&&M.has(lastB)){const a=ids.indexOf(lastB),b=ids.indexOf(m.id);ids.slice(Math.min(a,b),Math.max(a,b)+1).forEach(i=>BS.add(i))}
      else if(e.ctrlKey||e.metaKey){BS.has(m.id)?BS.delete(m.id):BS.add(m.id)}
      else{const only=BS.size===1&&BS.has(m.id);BS.clear();if(!only)BS.add(m.id)}
      lastB=m.id;binPaint();
    });
  }
  function dragIds(id){
    if(BS.has(id)&&BS.size>1)return [...M.keys()].filter(i=>BS.has(i)).join(',');
    return id;
  }
  function dropMedia(ids,trackId,t){
    let pos=Math.max(0,t);const added=[];
    for(const id of String(ids).split(',')){
      const m=M.get(id);if(!m||m.offline)continue;
      const tid=trackId&&compat({type:m.type},trackId)?trackId:null;
      const n0=S.clips.length;addMediaClip(id,tid,pos);
      if(S.clips.length>n0){const nc=S.clips[S.clips.length-1];pos=nc.start+nc.dur;added.push(nc.id)}
    }
    if(added.length>1){MS.clear();added.forEach(i=>MS.add(i));S.sel=added[added.length-1];renderAll();toast(added.length+' clips añadidos uno tras otro.')}
  }
  function addBinToTimeline(){
    const ids=[...M.keys()].filter(i=>BS.has(i));
    if(!ids.length)return toast('Marca primero los archivos (clic, Ctrl+clic o Shift+clic) y luego pulsa este botón.');
    dropMedia(ids.join(','),null,total());BS.clear();binPaint();
  }
  function removeMedia(m){
    const used=S.clips.filter(c=>c.mediaId===m.id);
    if(used.length&&!confirmOnce(`"${m.name}" se usa en ${used.length} clip(s). Pulsa ✕ otra vez para quitarlo junto con esos clips.`))return;
    S.clips=S.clips.filter(c=>c.mediaId!==m.id);
    for(const k in EL)if(k.endsWith('_'+m.id)){try{EL[k].pause()}catch(e){}delete EL[k]}
    if(m.url)try{URL.revokeObjectURL(m.url)}catch(e){}
    M.delete(m.id);BS.delete(m.id);commit();renderBin();renderAll();
  }

  /* ------------------------------------------------------------------
     EXPORTACIÓN: decodificador continuo por clip (fotograma exacto)
     ------------------------------------------------------------------ */
  function frameSources(){
    const map=new Map(),EPS=2000; // 2 ms de tolerancia
    function mkSrc(c){
      const m=M.get(c.mediaId),vt=m&&m._parsedTracks&&m._parsedTracks.find(t=>t.handlerType==='vide');
      if(!window.VideoDecoder||!vt||!vt.avcC||!vt.samples.length)return null;
      if(vt._base==null){let mn=Infinity;for(const s of vt.samples){const p=s.dts+(s.ctts||0);if(p<mn)mn=p}vt._base=mn}
      return {vt,dec:null,q:[],next:0,flushed:false,err:null,lastT:-1,want:0,wake:null};
    }
    const ptsUs=(vt,s)=>Math.round(((s.dts+(s.ctts||0)-vt._base)/vt.timescale)*1e6);
    function dropFrames(st){st.q.forEach(f=>{try{f.close()}catch(e){}});st.q=[]}
    function shut(st){dropFrames(st);if(st.dec){try{st.dec.close()}catch(e){}st.dec=null}}
    function open(st,target){
      shut(st);
      const vt=st.vt,sm=vt.samples,ticks=target*vt.timescale+vt._base;
      let lo=0,hi=sm.length-1,i=0;
      while(lo<=hi){const mid=(lo+hi)>>1;if(sm[mid].dts<=ticks){i=mid;lo=mid+1}else hi=mid-1}
      let kf=i;while(kf>0&&!sm[kf].isKey)kf--;
      // si ese keyframe se muestra después del instante pedido, retrocede un grupo más
      while(kf>0&&sm[kf].dts+(sm[kf].ctts||0)>ticks){kf--;while(kf>0&&!sm[kf].isKey)kf--}
      st.next=kf;st.flushed=false;
      st.dec=new VideoDecoder({
        output:f=>{
          const q=st.q;let k=q.length;while(k>0&&q[k-1].timestamp>f.timestamp)k--;q.splice(k,0,f);
          while(q.length>=2&&q[1].timestamp<=st.want+EPS){try{q.shift().close()}catch(e){}}
          if(st.wake){const w=st.wake;st.wake=null;w()}
        },
        error:e=>{st.err=e;console.error('Decodificador:',e);if(st.wake){const w=st.wake;st.wake=null;w()}}
      });
      st.dec.configure({codec:vt.codecStr,codedWidth:vt.width,codedHeight:vt.height,description:vt.avcC});
    }
    const sleep=(st,ms)=>new Promise(r=>{let done=false;const fin=()=>{if(!done){done=true;r()}};st.wake=fin;setTimeout(fin,ms)});
    async function get(c,target){
      let st=map.get(c.id);
      if(st===undefined){st=mkSrc(c);map.set(c.id,st)}
      if(!st||st.err)return null;
      try{
        const tUs=Math.max(0,target)*1e6;st.want=tUs;
        if(!st.dec||target<st.lastT-1e-4||target>st.lastT+1.5)open(st,Math.max(0,target));
        st.lastT=target;
        const vt=st.vt,sm=vt.samples;let guard=0;
        for(;;){
          if(st.err)return null;
          if(st.flushed||st.q.some(f=>f.timestamp>tUs+EPS))break;
          if(st.next<sm.length){
            if(st.dec.decodeQueueSize<8&&st.q.length<40){
              const s=sm[st.next++];
              st.dec.decode(new EncodedVideoChunk({type:s.isKey?'key':'delta',timestamp:ptsUs(vt,s),duration:Math.round((s.delta/vt.timescale)*1e6),data:vt.u8.subarray(s.offset,s.offset+s.size)}));
              if((++guard&7)===0)await sleep(st,0);
            }else await sleep(st,40);
          }else{await st.dec.flush();st.flushed=true}
        }
        const q=st.q;
        while(q.length>=2&&q[1].timestamp<=tUs+EPS){try{q.shift().close()}catch(e){}}
        const f=q[0];if(!f)return null;
        return {canvas:f,w:f.displayWidth,h:f.displayHeight};
      }catch(e){st.err=e;console.error(e);return null}
    }
    function prune(activeClips){
      const keep=new Set(activeClips.map(c=>c.id));
      for(const [id,st] of map)if(!keep.has(id)){if(st)shut(st);map.delete(id)}
    }
    function close(){for(const st of map.values())if(st)shut(st);map.clear()}
    return {get,prune,close};
  }
  // Si entre dos clips quedó un hueco de menos de 1,5 fotogramas (pasa al arrastrar a mano),
  // se rellena con el clip vecino en vez de exportar un fotograma negro.
  function bridgeGap(t,fps){
    if(S.clips.some(c=>isVis(c)&&active(c,t)))return t;
    const d=1.5/fps;let prev=null,next=null;
    for(const c of S.clips){
      if(!isVis(c))continue;const e=c.start+c.dur;
      if(e<=t+1e-6&&t-e<d&&(!prev||e>prev.start+prev.dur))prev=c;
      if(c.start>t&&c.start-t<d&&(!next||c.start<next.start))next=c;
    }
    if(prev&&next)return prev.start+prev.dur-1e-4;
    if(!prev&&next&&t<d)return next.start;
    return t;
  }

  /* ------------------------------------------------------------------
     INTERFAZ: espacios de trabajo, divisor del timeline, atajos
     ------------------------------------------------------------------ */
  function openTab(name){const b=$(`.tabs button[data-tab="${name}"]`);if(b)b.click()}
  function setWs(ws){
    document.body.classList.toggle('ws-color',ws==='color');
    $('#wsEdit').classList.toggle('on',ws!=='color');$('#wsColor').classList.toggle('on',ws==='color');
    if(ws==='color')openTab('look');else if($('#tab-look').classList.contains('on'))openTab('media');
    LS.set('ee-pro-ws',ws);
    setTimeout(()=>{fitStage();renderTimeline()},30);
  }
  function wireSplit(){
    const sp=$('#tlSplit'),app=$('#app');
    const h0=LS.get('ee-pro-tlh',0);if(h0)app.style.setProperty('--tlh',h0+'px');
    sp.addEventListener('pointerdown',e=>{
      e.preventDefault();
      const mv=ev=>{const h=clamp(innerHeight-ev.clientY,170,innerHeight*0.72);app.style.setProperty('--tlh',h+'px');fitStage()};
      const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);
        LS.set('ee-pro-tlh',parseInt(getComputedStyle(app).getPropertyValue('--tlh'))||0);fitStage();renderTimeline()};
      addEventListener('pointermove',mv);addEventListener('pointerup',up);
    });
  }
  function onSel(c,root){
    syncSliders();looksSoon();
    const emp=$('#stageEmpty');if(emp)emp.style.display=S.clips.length?'none':'flex';
    if(c&&MS.size>1){
      const b=document.createElement('div');b.className='multi';
      b.innerHTML=`<b>${MS.size} clips seleccionados</b><br>Mover, borrar, duplicar, velocidad y color se aplican a todos. Abajo ves los datos del último que tocaste.`;
      root.appendChild(b);
    }
  }
  function init(){
    buildSliders();renderRefs();renderLooks();wireMarquee();wireSplit();syncSliders();
    $('#bRefAdd').onclick=()=>$('#refIn').click();
    $('#refIn').onchange=e=>{addRefs(e.target.files);e.target.value=''};
    $('#bMkLook').onclick=makeFilter;$('#bMatch').onclick=matchLive;
    $('#bEqualize').onclick=equalize;$('#bLookOff').onclick=clearLook;$('#bLookRefresh').onclick=renderLooks;
    $('#bBinAdd').onclick=addBinToTimeline;
    const mb=$('#bMore'),mbox=$('#gradeMore');
    const paintMore=()=>{mbox.style.display=more?'block':'none';mb.textContent=more?'Menos controles ▴':'Más controles ▾'};
    mb.onclick=()=>{more=!more;LS.set('ee-pro-more',more);paintMore()};paintMore();
    // soltar imágenes sobre la pestaña Look = referencias (no van a Media)
    const tl=$('#tab-look');
    tl.addEventListener('dragover',e=>{if([...(e.dataTransfer?.types||[])].includes('Files')){e.preventDefault();$('#refDrop').classList.add('hot')}});
    tl.addEventListener('dragleave',()=>$('#refDrop').classList.remove('hot'));
    tl.addEventListener('drop',e=>{if(e.dataTransfer?.files?.length){e.preventDefault();e.stopPropagation();$('#refDrop').classList.remove('hot');$('#drop').classList.remove('hot');addRefs(e.dataTransfer.files)}});
    $$('.tabs button').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.tab==='look'){syncSliders();renderLooks()}}));
    $('#wsEdit').onclick=()=>setWs('edit');$('#wsColor').onclick=()=>setWs('color');
    if(LS.get('ee-pro-ws','edit')==='color')setWs('color');
    $('#bExport').addEventListener('click',()=>{$('#exUpscale').value=S.upMode==='ultimate'?'ultimate':(S.upscale>=0.6?'0.75':S.upscale>0.01?'0.45':'0')});
    addEventListener('keydown',e=>{
      const tag=(e.target.tagName||'').toLowerCase();if(tag==='input'||tag==='textarea'||tag==='select')return;
      if((e.ctrlKey||e.metaKey)&&(e.key==='a'||e.key==='A')){e.preventDefault();MS.clear();S.clips.forEach(c=>MS.add(c.id));S.sel=S.clips.length?S.clips[S.clips.length-1].id:null;renderAll();if(MS.size)toast(MS.size+' clips seleccionados.')}
      else if(e.key==='Escape'){S.sel=null;MS.clear();renderAll()}
    });
    setInterval(drawScope,350);
    onSel(selClip(),$('#insp'));
  }
  return {process:FX.process,frameSources,bridgeGap,clipPick,delMulti,dupMulti,each,binItem,dragIds,dropMedia,onSel,init,encErr:null,
    _t:{FX,filterLook,matchLook,clipStats,refs:()=>refs,looks:()=>myLooks,BUILTIN,addRefs,applyLook,selClips}};
})();
