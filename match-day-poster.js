/* TLP match-day poster. Fixed portrait template; actual roster and photos only.
   Read-only, local Canvas PNG export. No external render service or writes. */
(function(){
  'use strict';
  const W=1600,H=2240, stadium='/assets/match-stadium-hd.webp';
  let dialog=null, generation=0, exportBlob=null, busy=false, dateSelected='', uploadBusy=false;
  const posterBucket='match-poster-backgrounds';
  const rosterForDay=date=>matches.filter(m=>m.scheduled_date===date&&m.status!=='CANCELLED')
    .slice().sort((a,b)=>Number(a.slot??999)-Number(b.slot??999)||Number(a.match_number??0)-Number(b.match_number??0))
    .map((m,i)=>{
      const slots=lineups(m).ps;
      const players=[['A',1],['A',2],['B',1],['B',2]].map(([team,position])=>{
        const mp=slots.find(x=>x.team===team&&Number(x.position)===position);
        const p=mp&&playerById(mp.actual_player_id);
        return {name:p?.display_name||'TBD',photo:p?safeProfilePhotoUrl(p.profile_image_url):''};
      });
      return {number:i+1,players};
    });
  function dateText(date){
    const d=new Date(date+'T12:00:00Z');
    return d.toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long'})+' • '+d.toLocaleDateString('en-US',{timeZone:'UTC',month:'long',day:'numeric',year:'numeric'});
  }
  function loadPhoto(url){
    if(!url)return Promise.resolve(null);
    return new Promise(resolve=>{
      const img=new Image();let done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);img.onload=img.onerror=null;resolve(value)};
      const timer=setTimeout(()=>finish(null),18000);
      img.crossOrigin='anonymous';img.onload=()=>finish(img.naturalWidth?img:null);img.onerror=()=>finish(null);img.src=url;
    });
  }
  function path(ctx,x,y,w,h,r){
    r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }
  function rect(ctx,x,y,w,h,r,fill,stroke,width=2){
    path(ctx,x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke()}
  }
  function grad(ctx,x,y,x2,y2,stops){const g=ctx.createLinearGradient(x,y,x2,y2);stops.forEach(([p,c])=>g.addColorStop(p,c));return g}
  function glow(ctx,x,y,r,color){
    const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  function poly(ctx,points,fill){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill()}
  function label(ctx,value,x,y,max,size,color,italic=false,weight=900,shadow=false){
    ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
    const font=s=>(italic?'italic ':'')+weight+' '+s+'px Arial, Helvetica, sans-serif';
    ctx.font=font(size);while(size>8&&ctx.measureText(value).width>max){size-=1;ctx.font=font(size)}
    ctx.fillStyle=color;if(shadow){ctx.shadowColor='#000a';ctx.shadowBlur=9;ctx.shadowOffsetY=4}
    ctx.fillText(value,x,y);ctx.restore();
  }
  function ball(ctx,x,y,r){
    ctx.save();glow(ctx,x,y,r*2,'rgba(255,199,0,.28)');
    const g=ctx.createRadialGradient(x-r*.35,y-r*.4,r*.05,x,y,r);g.addColorStop(0,'#fff8a1');g.addColorStop(.48,'#ffdf25');g.addColorStop(1,'#c77b00');ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    for(const [dx,dy,rr] of [[-.38,-.46,.13],[.26,-.54,.12],[-.61,.05,.12],[0,0,.16],[.52,.12,.12],[-.25,.53,.13],[.34,.57,.1]]){ctx.fillStyle='#072344';ctx.beginPath();ctx.ellipse(x+dx*r,y+dy*r,rr*r,rr*r*.82,.2,0,Math.PI*2);ctx.fill()}
    ctx.restore();
  }
  function paddle(ctx,x,y,angle){
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    rect(ctx,-24,72,48,120,15,'#d8a813','#ffe57d',3);
    for(let i=0;i<6;i++)rect(ctx,-22,86+i*15,44,5,2,'#293c53');
    rect(ctx,-77,-96,154,187,36,grad(ctx,-80,-90,80,90,[[0,'#276697'],[.6,'#102e55'],[1,'#061a32']]),'#ffd538',6);
    ctx.restore();
  }
  function lights(ctx,x,y,flip){
    for(let i=0;i<5;i++){let px=x+flip*i*42,py=y+i*24;glow(ctx,px,py,85,'rgba(24,177,255,.64)');ctx.fillStyle='#eaffff';ctx.beginPath();ctx.ellipse(px,py,17,10,.35*flip,0,Math.PI*2);ctx.fill()}
  }
  function court(ctx,y,height){
    const c=W/2;glow(ctx,c,y+height*.55,560,'rgba(0,134,255,.27)');
    ctx.save();ctx.strokeStyle='rgba(102,219,255,.55)';ctx.lineWidth=4;
    const line=(a,b,d,e)=>{ctx.beginPath();ctx.moveTo(a,b);ctx.lineTo(d,e);ctx.stroke()};
    line(c-375,y,c-740,y+height);line(c+375,y,c+740,y+height);line(c,y,c,y+height);line(c-530,y+height*.48,c+530,y+height*.48);
    rect(ctx,c-610,y+7,1220,86,1,'rgba(3,24,53,.6)','#9de3ff',3);
    ctx.lineWidth=1.3;ctx.strokeStyle='rgba(89,185,241,.5)';
    for(let x=c-610;x<=c+610;x+=33)line(x,y+7,x,y+93);
    for(let a=y+7;a<=y+93;a+=14)line(c-610,a,c+610,a);
    ctx.restore();
  }
  function cover(ctx,img,x,y,w,h,align=.5){
    const sw=img.naturalWidth||img.width,sh=img.naturalHeight||img.height;
    const scale=Math.max(w/sw,h/sh),cw=w/scale,ch=h/scale;
    ctx.drawImage(img,Math.max(0,(sw-cw)/2),Math.max(0,(sh-ch)*align),cw,ch,x,y,w,h);
  }
  function portrait(ctx,p,img,x,y,w,h){
    ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
    if(img){
      ctx.shadowColor='rgba(0,0,0,.65)';ctx.shadowBlur=13;ctx.shadowOffsetY=4;
      cover(ctx,img,x,y,w,h,.07);
    }else{
      ctx.fillStyle='#7eaac7';ctx.beginPath();ctx.arc(x+w/2,y+h*.29,w*.23,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.ellipse(x+w/2,y+h*.91,w*.49,h*.43,0,0,Math.PI*2);ctx.fill();
      const initials=p.name.trim().split(/\s+/).slice(-2).map(s=>s[0]).join('').toUpperCase()||'?';
      label(ctx,initials,x+w/2,y+h*.72,w*.8,34,'#fff');
    }
    ctx.restore();
  }
  // One full-width fixture per row. The uploaded artwork is used only
  // for its decorative header/footer, never for baked dates or fixtures.
  const posterWidth=1800;
  const rowLayout={margin:40,top:572,height:540,gap:30,footer:335};
  function drawHeader(ctx,art,w){
    const hh=422;
    ctx.fillStyle=grad(ctx,0,0,w,hh,[[0,'#d4edff'],[.44,'#fff'],[1,'#e0f3ff']]);ctx.fillRect(0,0,w,hh);
    // The original 3:4 artwork and the new tall template have different
    // header heights. Crop before their date bar, retaining the branding.
    if(art){
      const aw=art.naturalWidth,ah=art.naturalHeight;
      const top=Math.round(ah*(aw/ah<.65?.132:.18));
      ctx.drawImage(art,0,0,aw,top,0,0,w,hh);
      // A blank background has no lettering. Check just the logo's
      // central area, excluding decorative corner bands.
      let hasTitle=false;
      try{
        const pixels=ctx.getImageData(Math.round(w*.22),Math.round(hh*.25),Math.round(w*.59),Math.round(hh*.50)).data;
        let dark=0,total=0;
        for(let i=0;i<pixels.length;i+=64){total++;if(pixels[i]<50&&pixels[i+1]<100&&pixels[i+2]<160)dark++}
        hasTitle=total>0&&dark/total>.075;
      }catch(e){}
      if(hasTitle)return;
    }
    // Same competition wordmark on blank artwork or an unavailable asset.
    const wash=grad(ctx,0,85,w,340,[[0,'rgba(235,247,255,.96)'],[.5,'#fff'],[1,'rgba(233,246,255,.96)']]);
    rect(ctx,150,42,w-300,340,35,wash);
    poly(ctx,[[225,306],[702,104],[821,83],[649,163],[210,355]],'#f6be03');
    ball(ctx,725,92,58);
    label(ctx,'TLP',493,225,540,178,'#092c57',true,900);
    ctx.fillStyle='#12365c';ctx.fillRect(855,86,5,238);
    label(ctx,'TEACHERS',1250,111,715,85,'#082d59',true,900);
    label(ctx,'PICKLEBALL',1250,204,735,85,'#082d59',true,900);
    rect(ctx,900,260,700,85,23,grad(ctx,900,260,1600,345,[[0,'#074083'],[1,'#0074bf']]));
    label(ctx,'COMPETITION',1250,303,665,74,'#ffdc00',true,900);
  }
  function footerSource(art){
    if(!art||!art.naturalWidth||!art.naturalHeight)return null;
    const aw=art.naturalWidth,ah=art.naturalHeight;
    const cut=Math.round(ah*(aw/ah<.65?.885:.725));
    return {aw,cut,sh:ah-cut};
  }
  function footerHeight(art,w,fallback){
    const source=footerSource(art);
    return source?Math.ceil(w*source.sh/source.aw):fallback;
  }
  function drawFooter(ctx,art,w,y,h){
    const source=footerSource(art);
    if(source){
      // Uniform scale: original paddle, ball and court proportions.
      const {aw,cut,sh}=source;
      const scale=w/aw;
      const dh=sh*scale;
      ctx.drawImage(art,0,cut,aw,sh,0,y,w,dh);
    }else{
      ctx.fillStyle=grad(ctx,0,y,w,y+h,[[0,'#d5f2ff'],[.4,'#128dd5'],[1,'#03346e']]);ctx.fillRect(0,y,w,h);
      ctx.strokeStyle='#effcff';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(w/2,y);ctx.lineTo(w/2,y+h);ctx.moveTo(0,y+h*.55);ctx.lineTo(w,y+h*.55);ctx.stroke();
      rect(ctx,120,y+15,w-240,82,2,'#064b7c','#b9f3ff',3);
      for(let x=125;x<w-120;x+=26){ctx.beginPath();ctx.moveTo(x,y+15);ctx.lineTo(x,y+97);ctx.strokeStyle='#b9e9fa';ctx.lineWidth=1;ctx.stroke()}
      paddle(ctx,w/2-155,y+h*.59,-.7);paddle(ctx,w/2+155,y+h*.59,.7);ball(ctx,w/2,y+h*.78,62);
    }
  }
  function posterName(ctx,name,x,y,w,h,left){
    const g=grad(ctx,x,y,x,y+h,left?[[0,'#fff477'],[.45,'#ffd52b'],[1,'#efaa00']]:[[0,'#1fc8ff'],[.43,'#078de1'],[1,'#0750ad']]);
    ctx.save();ctx.shadowColor='rgba(0,0,0,.40)';ctx.shadowBlur=10;ctx.shadowOffsetY=4;
    rect(ctx,x,y,w,h,h*.32,g,left?'#fff5b0':'#b8f1ff',3.5);ctx.restore();
    const size=Math.min(48,h*.66),color=left?'#082448':'#fff';
    label(ctx,name,x+w/2,y+h/2,w-24,size,color,true,900,!left);
  }
  function rowCard(ctx,match,images,bg,x,y,w,h){
    ctx.save();path(ctx,x,y,w,h,38);ctx.clip();
    ctx.fillStyle=grad(ctx,x,y,x+w,y+h,[[0,'#06162e'],[.45,'#12467a'],[1,'#071c3c']]);ctx.fillRect(x,y,w,h);
    if(bg)ctx.drawImage(bg,x,y,w,h);
    else{
      glow(ctx,x+w*.5,y+h*.53,w*.25,'rgba(0,132,255,.58)');
      poly(ctx,[[x,y+h*.56],[x+w*.38,y+h*.12],[x+w*.25,y+h*.72],[x,y+h*.92]],'#d6a600');
      poly(ctx,[[x+w,y+h*.56],[x+w*.62,y+h*.12],[x+w*.75,y+h*.72],[x+w,y+h*.92]],'#007ecb');
      ball(ctx,x+w*.5,y+h*.43,h*.15);label(ctx,'VS',x+w*.5,y+h*.61,w*.14,106,'#fff',true,900,true);
    }
    // Keep the centre VS clear of the four portraits.
    const centers=[.137,.337,.663,.863],photoW=w*.193,photoH=360,py=y+78,ny=y+427,nameW=w*.194;
    match.players.forEach((p,i)=>{
      const left=i<2,cx=x+w*centers[i],px=cx-photoW/2;
      // Draw the original alpha-transparent portrait directly on the
      // stadium. No filled photo panel, border or rounded photo mask.
      portrait(ctx,p,images.get(p.photo),px,py,photoW,photoH);
      posterName(ctx,p.name,cx-nameW/2,ny,nameW,75,left);
    });
    const tagW=w*.29;
    rect(ctx,x+(w-tagW)/2,y+13,tagW,70,22,grad(ctx,x,y,x,y+83,[[0,'#ffe574'],[1,'#ffb500']]),'#fff1ac',3);
    label(ctx,'MATCH '+match.number,x+w/2,y+48,tagW-28,54,'#082448',true);
    ctx.restore();
    ctx.save();ctx.shadowColor='#16bfff';ctx.shadowBlur=10;rect(ctx,x,y,w,h,38,null,'#99e7ff',4);ctx.restore();
  }
  function paintLight(canvas,date,data,images,bg,art){
    const w=posterWidth,{margin,top,height,gap,footer}=rowLayout;
    const bottom=top+data.length*height+Math.max(0,data.length-1)*gap;
    const footerH=footerHeight(art,w,footer);
    canvas.width=w;canvas.height=bottom+26+footerH;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.fillStyle=grad(ctx,0,0,w,canvas.height,[[0,'#edf8ff'],[.5,'#dcefff'],[1,'#e8f5ff']]);ctx.fillRect(0,0,w,canvas.height);
    drawHeader(ctx,art,w);
    ctx.save();ctx.shadowColor='rgba(14,74,130,.24)';ctx.shadowBlur=13;ctx.shadowOffsetY=4;
    rect(ctx,65,443,w-130,100,26,grad(ctx,65,443,w-65,543,[[0,'#06356b'],[.5,'#0974bd'],[1,'#064086']]),'#ffd521',5);ctx.restore();
    label(ctx,dateText(date),w/2,493,w-200,68,'#fff',true,900,true);
    data.forEach((m,i)=>rowCard(ctx,m,images,bg,margin,top+i*(height+gap),w-2*margin,height));
    drawFooter(ctx,art,w,bottom+26,footerH);
  }
  async function loadSavedBackground(){
    const path=competition?.poster_background_path;
    if(!path||!path.startsWith(competition.id+'/'))return null;
    try{
      const {data,error}=await sb.storage.from(posterBucket).download(path);
      if(error||!data)return null;
      const url=URL.createObjectURL(data);
      try{return await loadPhoto(url)}finally{URL.revokeObjectURL(url)}
    }catch(e){return null}
  }
  async function savePosterBackground(input){
    const file=input.files?.[0];input.value='';
    if(!file||uploadBusy||busy||!requireAdmin()||!competition)return;
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){
      toast('Choose a PNG, JPEG or WebP image under 8 MB.',true);return;
    }
    const d=dialog,status=d.querySelector('#matchPosterStatus'),retry=d.querySelector('[data-poster-retry]');
    const date=dateSelected,cid=competition.id,old=competition.poster_background_path,download=d.querySelector('[data-poster-download]');
    uploadBusy=true;input.disabled=true;retry.disabled=true;download.disabled=true;
    let path='',saved=false,blobUrl='';
    try{
      status.textContent='Checking and saving the shared HD poster background…';
      blobUrl=URL.createObjectURL(file);
      const image=await loadPhoto(blobUrl);
      if(!image||image.naturalWidth<850||image.naturalHeight<1200||image.naturalWidth/image.naturalHeight<.48||image.naturalWidth/image.naturalHeight>.80)
        throw new Error('Use a tall portrait image at least 850 × 1200 pixels (3:4 or approximately 9:16).');
      const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
      path=cid+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,10)+'.'+ext;
      const bucket=sb.storage.from(posterBucket);
      const {error:upError}=await bucket.upload(path,file,{contentType:file.type,cacheControl:'31536000',upsert:false});
      if(upError)throw upError;
      const {data,error:dbError}=await sb.from('competitions').update({poster_background_path:path}).eq('id',cid).select('poster_background_path').single();
      if(dbError||data?.poster_background_path!==path)throw dbError||new Error('Background setting was not confirmed.');
      saved=true;
      if(competition?.id===cid)competition.poster_background_path=path;
      if(old&&old!==path&&old.startsWith(cid+'/')){try{await bucket.remove([old])}catch(e){}}
      toast('Shared poster background saved.');
    }catch(e){
      if(path&&!saved){try{await sb.storage.from(posterBucket).remove([path])}catch(cleanupError){}}
      status.textContent='Background was not saved: '+(e.message||e);toast(status.textContent,true);
    }finally{
      if(blobUrl)URL.revokeObjectURL(blobUrl);
      uploadBusy=false;input.disabled=false;retry.disabled=false;download.disabled=!exportBlob||busy;
    }
    if(saved&&d.open&&date===dateSelected&&competition?.id===cid&&isAdmin())await window.openMatchDayPoster(date);
  }
  function makeDialog(){
    if(dialog)return dialog;
    const d=document.createElement('dialog');d.className='match-poster-dialog';d.setAttribute('aria-labelledby','matchPosterTitle');
    d.innerHTML='<div class="match-poster-top"><div><strong id="matchPosterTitle">Match Day Poster</strong><p id="matchPosterDate"></p></div><button type="button" class="btn secondary" data-poster-close aria-label="Close poster preview">Close ×</button></div><div class="match-poster-content"><p id="matchPosterStatus" role="status" aria-live="polite"></p><canvas id="matchPosterCanvas" aria-label="Match day poster preview" hidden></canvas></div><div class="match-poster-bottom"><small>High-resolution portrait PNG · Actual player photos · No skill ratings or team averages</small><div class="match-poster-actions"><label class="btn secondary match-poster-upload" title="Upload a shared portrait poster background"><span data-background-label>Set Poster Background</span><input type="file" data-poster-background accept="image/png,image/jpeg,image/webp" aria-label="Set poster background"></label> <button type="button" class="btn secondary" data-poster-retry>Refresh poster</button> <button type="button" class="btn" data-poster-download disabled>Download PNG ↓</button></div></div>';
    document.body.appendChild(d);
    d.querySelector('[data-poster-close]').onclick=()=>d.close();
    d.querySelector('[data-poster-retry]').onclick=()=>window.openMatchDayPoster(dateSelected);
    d.querySelector('[data-poster-background]').onchange=e=>savePosterBackground(e.target);
    d.querySelector('[data-poster-download]').onclick=()=>{
      if(!requireAdmin()||!exportBlob||busy)return;
      const url=URL.createObjectURL(exportBlob),a=document.createElement('a');a.href=url;a.download='TLP-Match-Day-'+dateSelected+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
    };
    d.addEventListener('close',()=>{generation++;exportBlob=null;busy=false});
    dialog=d;return d;
  }
  window.openMatchDayPoster=async date=>{
    if(uploadBusy||!requireAdmin()||!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
    const data=rosterForDay(date);
    if(!data.length){toast('No matches scheduled for this date.',true);return}
    const d=makeDialog(),token=++generation;dateSelected=date;busy=true;exportBlob=null;
    const canvas=d.querySelector('canvas'),status=d.querySelector('#matchPosterStatus'),download=d.querySelector('[data-poster-download]'),retry=d.querySelector('[data-poster-retry]');
    d.querySelector('#matchPosterDate').textContent=dateText(date)+' · '+data.length+' matches';
    const upload=d.querySelector('[data-poster-background]');
    d.querySelector('[data-background-label]').textContent=competition?.poster_background_path?'Change Poster Background':'Set Poster Background';
    download.disabled=true;retry.disabled=true;upload.disabled=true;canvas.hidden=true;status.textContent='Loading actual player photos and rendering your poster…';
    if(!d.open)d.showModal();
    try{
      const urls=[...new Set(data.flatMap(m=>m.players.map(p=>p.photo)).filter(Boolean))];
      const [bg,loaded,art]=await Promise.all([loadPhoto(stadium),Promise.all(urls.map(async url=>[url,await loadPhoto(url)])),loadSavedBackground()]);
      if(token!==generation)return;
      if(!isAdmin()){d.close();return}
      const images=new Map(loaded);
      const missing=[...new Set(data.flatMap(m=>m.players).filter(p=>!p.photo||!images.get(p.photo)).map(p=>p.name))];
      paintLight(canvas,date,data,images,bg,art);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed')),'image/png'));
      if(token!==generation)return;
      exportBlob=blob;canvas.hidden=false;download.disabled=false;
      const notes=[];if(missing.length)notes.push('Photo unavailable (initials shown): '+missing.join(', ')+'.');if(!bg)notes.push('Stadium artwork unavailable; using built-in graphics.');
      if(!art)notes.push(competition?.poster_background_path?'Saved artwork could not be loaded; using the built-in light template.':'Using the built-in light template. Set Poster Background to use your artwork.');
      status.textContent='Poster ready · '+canvas.width+' × '+canvas.height+' px'+(notes.length?' · '+notes.join(' '):'');
    }catch(e){if(token===generation)status.textContent='Could not generate poster: '+(e.message||e)+'. Please refresh the poster.'}
    finally{if(token===generation){busy=false;retry.disabled=false;upload.disabled=false}}
  };
})();
