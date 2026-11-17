/* TLP match-day poster. Fixed portrait template; actual roster and photos only.
   Read-only, local Canvas PNG export. No external render service or writes. */
(function(){
  'use strict';
  const W=1600,H=2240, stadium='/assets/match-stadium-hd.webp';
  let dialog=null, generation=0, exportBlob=null, busy=false, dateSelected='';
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
  function card(ctx,match,images,bg,x,y,w,h){
    ctx.save();path(ctx,x,y,w,h,30);ctx.clip();
    ctx.fillStyle=grad(ctx,x,y,x,y+h,[[0,'#061426'],[.62,'#0a396c'],[1,'#04172f']]);ctx.fillRect(x,y,w,h);
    if(bg){ctx.drawImage(bg,x,y+h*.15,w,h*.72);}
    else {
      poly(ctx,[[x,y+h*.62],[x+w*.37,y+h*.14],[x+w*.3,y+h*.58],[x,y+h*.86]],'#d9ae00');
      poly(ctx,[[x+w,y+h*.62],[x+w*.63,y+h*.14],[x+w*.7,y+h*.58],[x+w,y+h*.86]],'#008ee5');
      ball(ctx,x+w*.5,y+h*.43,w*.075);label(ctx,'VS',x+w*.5,y+h*.55,w*.18,w*.11,'#fff',true,900,true);
    }
    ctx.fillStyle=grad(ctx,x,y,x,y+h,[[0,'rgba(2,13,29,.72)'],[.23,'rgba(2,13,29,0)'],[.66,'rgba(2,13,29,0)'],[1,'#03162f']]);ctx.fillRect(x,y,w,h);
    const pw=w*.217,ph=h*.61,py=y+h*.22,positions=[.015,.231,.553,.769];
    match.players.forEach((p,i)=>{
      const px=x+w*positions[i];
      portrait(ctx,p,images.get(p.photo),px,py,pw,ph);
      const left=i<2;
      const g=grad(ctx,px,py+ph,px+pw,py+ph+25,left?[[0,'#fff083'],[.38,'#ffdb18'],[1,'#ec9c00']]:[[0,'#27c2ff'],[.42,'#087cd9'],[1,'#0753a2']]);
      rect(ctx,px+2,py+ph-5,pw-4,h*.10,12,g,left?'#fff6a6':'#a1eaff',2.5);
      label(ctx,p.name,px+pw/2,py+ph-5+h*.05,pw-18,Math.min(31,w*.041),left?'#092344':'#fff',true,900,!left);
    });
    rect(ctx,x+w*.32,y+h*.035,w*.36,h*.13,13,grad(ctx,x,y,x,y+h*.16,[[0,'#ffdf35'],[1,'#ffb900']]),'#fff2a0',3);
    label(ctx,'MATCH '+match.number,x+w/2,y+h*.10,w*.32,Math.min(43,w*.056),'#071b37',true);
    ctx.restore();
    ctx.save();ctx.shadowColor='#23bfff';ctx.shadowBlur=15;rect(ctx,x,y,w,h,30,null,'#b9f1ff',4);ctx.restore();
  }
  function paint(canvas,date,data,images,bg){
    // Always the same design. If a nonstandard day has >4 matches, extend
    // the same card grid vertically rather than dropping any fixtures.
    const rows=Math.max(2,Math.ceil(data.length/2)),extra=(rows-2)*520;
    canvas.width=W;canvas.height=H+extra;const ctx=canvas.getContext('2d');
    ctx.fillStyle=grad(ctx,0,0,W,H+extra,[[0,'#051326'],[.38,'#08305e'],[.75,'#04162e'],[1,'#031020']]);ctx.fillRect(0,0,W,H+extra);
    glow(ctx,210,240,620,'rgba(0,107,230,.35)');glow(ctx,1390,240,620,'rgba(0,107,230,.35)');
    lights(ctx,36,45,1);lights(ctx,W-36,45,-1);
    paddle(ctx,148,286,-.65);paddle(ctx,W-148,286,.65);
    poly(ctx,[[350,214],[780,42],[710,104],[370,244]],'#f4c10e');
    ball(ctx,715,89,67);
    label(ctx,'TLP',490,211,510,174,'#f5fbff',true,900,true);
    ctx.fillStyle='#d6eeff';ctx.fillRect(784,136,5,203);
    label(ctx,'TEACHERS',1095,171,540,67,'#fff',true,900,true);
    label(ctx,'PICKLEBALL',1095,245,540,67,'#fff',true,900,true);
    label(ctx,'COMPETITION',1095,318,550,62,'#ffd32c',true,900,true);
    ctx.save();ctx.translate(W/2,490);ctx.rotate(-.035);
    const stripe=grad(ctx,-W/2,-95,W/2,95,[[0,'#e6a400'],[.48,'#ffe151'],[1,'#ffc400']]);
    poly(ctx,[[-830,-74],[-670,-100],[810,-104],[730,76],[-820,104]],stripe);
    label(ctx,'MATCH DAY POSTER',0,1,1460,119,'#031b35',true);
    ctx.restore();
    ctx.save();ctx.shadowColor='#168eff';ctx.shadowBlur=20;rect(ctx,112,619,W-224,96,32,'#051f40','#35bfff',4);ctx.restore();
    label(ctx,dateText(date),W/2,668,W-290,57,'#fff',true,900,true);
    const start=766,gap=24,margin=30,cw=(W-2*margin-gap)/2,ch=496;
    data.forEach((m,i)=>{
      const row=Math.floor(i/2),single=i===data.length-1&&data.length%2===1;
      const x=single?(W-cw)/2:margin+i%2*(cw+gap);
      card(ctx,m,images,bg,x,start+row*(ch+gap),cw,ch);
    });
    const fy=H+extra-369;
    court(ctx,fy,260);
    label(ctx,'Teachers Pickleball Competition',W/2,H+extra-125,W-160,55,'#fff',true,900,true);
    label(ctx,'MATCH DAY SCHEDULE',W/2,H+extra-55,W-180,31,'#e8f2ff',false,700,true);
    ctx.fillStyle='#f8c810';ctx.fillRect(55,H+extra-56,215,5);ctx.fillRect(W-270,H+extra-56,215,5);
  }
  function makeDialog(){
    if(dialog)return dialog;
    const d=document.createElement('dialog');d.className='match-poster-dialog';d.setAttribute('aria-labelledby','matchPosterTitle');
    d.innerHTML='<div class="match-poster-top"><div><strong id="matchPosterTitle">Match Day Poster</strong><p id="matchPosterDate"></p></div><button type="button" class="btn secondary" data-poster-close aria-label="Close poster preview">Close ×</button></div><div class="match-poster-content"><p id="matchPosterStatus" role="status" aria-live="polite"></p><canvas id="matchPosterCanvas" aria-label="Match day poster preview" hidden></canvas></div><div class="match-poster-bottom"><small>High-resolution portrait PNG · Actual player photos · No skill ratings or team averages</small><div><button type="button" class="btn secondary" data-poster-retry>Refresh poster</button> <button type="button" class="btn" data-poster-download disabled>Download PNG ↓</button></div></div>';
    document.body.appendChild(d);
    d.querySelector('[data-poster-close]').onclick=()=>d.close();
    d.querySelector('[data-poster-retry]').onclick=()=>window.openMatchDayPoster(dateSelected);
    d.querySelector('[data-poster-download]').onclick=()=>{
      if(!requireAdmin()||!exportBlob||busy)return;
      const url=URL.createObjectURL(exportBlob),a=document.createElement('a');a.href=url;a.download='TLP-Match-Day-'+dateSelected+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
    };
    d.addEventListener('close',()=>{generation++;exportBlob=null;busy=false});
    dialog=d;return d;
  }
  window.openMatchDayPoster=async date=>{
    if(!requireAdmin()||!/^\d{4}-\d{2}-\d{2}$/.test(date))return;
    const data=rosterForDay(date);
    if(!data.length){toast('No matches scheduled for this date.',true);return}
    const d=makeDialog(),token=++generation;dateSelected=date;busy=true;exportBlob=null;
    const canvas=d.querySelector('canvas'),status=d.querySelector('#matchPosterStatus'),download=d.querySelector('[data-poster-download]'),retry=d.querySelector('[data-poster-retry]');
    d.querySelector('#matchPosterDate').textContent=dateText(date)+' · '+data.length+' matches';
    download.disabled=true;retry.disabled=true;canvas.hidden=true;status.textContent='Loading actual player photos and rendering your poster…';
    if(!d.open)d.showModal();
    try{
      const urls=[...new Set(data.flatMap(m=>m.players.map(p=>p.photo)).filter(Boolean))];
      const [bg,loaded]=await Promise.all([loadPhoto(stadium),Promise.all(urls.map(async url=>[url,await loadPhoto(url)]))]);
      if(token!==generation)return;
      if(!isAdmin()){d.close();return}
      const images=new Map(loaded);
      const missing=[...new Set(data.flatMap(m=>m.players).filter(p=>!p.photo||!images.get(p.photo)).map(p=>p.name))];
      paint(canvas,date,data,images,bg);
      const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed')),'image/png'));
      if(token!==generation)return;
      exportBlob=blob;canvas.hidden=false;download.disabled=false;
      const notes=[];if(missing.length)notes.push('Photo unavailable (initials shown): '+missing.join(', ')+'.');if(!bg)notes.push('Stadium artwork unavailable; using built-in graphics.');
      status.textContent=notes.length?notes.join(' ')+' Refresh to retry.':'Poster ready · '+canvas.width+' × '+canvas.height+' px';
    }catch(e){if(token===generation)status.textContent='Could not generate poster: '+(e.message||e)+'. Please refresh the poster.'}
    finally{if(token===generation){busy=false;retry.disabled=false}}
  };
})();
