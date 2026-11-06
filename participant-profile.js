
/* TLP Teachers Pickleball – Dedicated participant profile page
 * Data source: existing competition results, match games, rankings and participants.
 * No historical scores or match records are modified by profile rendering.
 */
let currentProfilePlayerId=null;
let profileActiveTab='overview';
let profileListScrollY=0;
let profileUploadBusy=false;
const profilePhotoPrefix=SUPABASE_URL+'/storage/v1/object/public/participant-photos/';

function safeProfilePhotoUrl(raw){
  return typeof raw==='string'&&raw.startsWith(profilePhotoPrefix)&&!/[<>"']/g.test(raw)?raw:'';
}
function ppInitials(full){
  return String(full||'TLP').trim().split(/\s+/).slice(-2).map(s=>s.charAt(0).toUpperCase()).join('')||'TLP';
}
function profileAvatarHTML(p,className='pp-avatar'){
  const img=safeProfilePhotoUrl(p?.profile_image_url);
  return '<div class="'+className+'">'+esc(ppInitials(p?.display_name))+(img?'<img src="'+esc(img)+'" alt="'+esc(p?.display_name||'Player')+' portrait" loading="lazy" onerror="this.remove()">':'')+'</div>';
}
function ppNum(v){return Number(v||0).toLocaleString('en-PH')}
function ppAvg(v,places=1){return Number.isFinite(v)?v.toFixed(places):'—'}
function ppRank(p){return rankings.find(r=>r.participant_id===p.id)||null}
function ppPlayer(id){return playerById(id)||{display_name:'Unknown player',skill_level:0,id}}
function ppDateDay(date){return new Date(date+'T12:00:00Z').getUTCDay()}
function ppMatch(m){return matches.find(x=>x.id===m.match_id)}
function ppLiveStatus(m){return m.status==='COMPLETED'?'Completed':m.status==='CANCELLED'?'Cancelled':m.status==='IN_PROGRESS'?'Live':'Upcoming'}

function profileContext(){
  const p=playerById(currentProfilePlayerId);
  if(!p)return null;
  const s=statById(p.id)||{},r=ppRank(p),target=Number(p.target_matches||competition?.target_matches_per_player||15);
  const completed=results.filter(x=>x.participant_id===p.id&&(x.played===true||x.result==='W'||x.result==='L'))
    .slice().sort((a,b)=>b.scheduled_date.localeCompare(a.scheduled_date)||Number(b.match_number)-Number(a.match_number));
  const upcoming=matches.filter(m=>['READY_TO_PLAY','DRAFT','PLAYER_REPLACEMENT_REQUIRED','IN_PROGRESS','GAME_3_REQUIRED'].includes(m.status)&&matchPlayers.some(mp=>mp.match_id===m.id&&mp.actual_player_id===p.id))
    .sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date)||a.slot-b.slot);
  const partners=new Map(),opponents=new Map(),dayCounts={Thursday:0,Friday:0,Other:0},slotCounts={};
  let teammateTotal=0,opponentTotal=0,skillSample=0,highestWinStreak=0,streakRun=0;
  const chronological=completed.slice().reverse();
  chronological.forEach(x=>{
    if(x.result==='W'){streakRun++;highestWinStreak=Math.max(highestWinStreak,streakRun)}
    else streakRun=0;
  });
  const currentStreak=chronological.length?(function(){
    const status=chronological[chronological.length-1]?.result;let count=0;
    for(let i=chronological.length-1;i>=0&&chronological[i].result===status;i--)count++;
    return {result:status,count};
  })():{result:'—',count:0};
  for(const row of completed){
    const dateDay=ppDateDay(row.scheduled_date);
    dayCounts[dateDay===4?'Thursday':dateDay===5?'Friday':'Other']++;
    const thisMatch=ppMatch(row);
    if(thisMatch)slotCounts[thisMatch.slot]=(slotCounts[thisMatch.slot]||0)+1;
    const partner=ppPlayer(row.partner_id),op1=ppPlayer(row.opponent_1_id),op2=ppPlayer(row.opponent_2_id);
    if(row.partner_id){
      let pr=partners.get(row.partner_id)||{id:row.partner_id,name:partner.display_name,games:0,wins:0,losses:0};
      pr.games++;if(row.result==='W')pr.wins++;if(row.result==='L')pr.losses++;partners.set(row.partner_id,pr);
    }
    for(const o of [op1,op2]){
      if(!o.id)continue;
      let h=opponents.get(o.id)||{id:o.id,name:o.display_name,skill:Number(o.skill_level),games:0,wins:0,losses:0};
      h.games++;if(row.result==='W')h.wins++;if(row.result==='L')h.losses++;opponents.set(o.id,h);
    }
    if(row.partner_id&&row.opponent_1_id&&row.opponent_2_id){
      teammateTotal+=Number(partner.skill_level);opponentTotal+=(Number(op1.skill_level)+Number(op2.skill_level))/2;skillSample++;
    }
  }
  const partnersSorted=[...partners.values()].sort((a,b)=>b.wins-a.wins||b.games-a.games||a.name.localeCompare(b.name));
  const opponentsSorted=[...opponents.values()].sort((a,b)=>b.games-a.games||b.skill-a.skill||a.name.localeCompare(b.name));
  return {p,s,r,target,completed,upcoming,partners:partnersSorted,opponents:opponentsSorted,
    dayCounts,slotCounts,highestWinStreak,currentStreak,skillSample,
    avgTeammate:skillSample?teammateTotal/skillSample:NaN,
    avgOpponents:skillSample?opponentTotal/skillSample:NaN};
}
function openParticipantProfile(id){
  if(!requireAdmin())return;
  if(!playerById(id))return toast('Participant not found.',true);
  const wrap=document.querySelector('#participants .tablewrap');
  if(wrap)profileListScrollY=wrap.scrollTop;
  currentProfilePlayerId=id;profileActiveTab='overview';
  go('player-profile/'+id);
}
function returnToParticipants(){
  go('participants');
  const wrap=document.querySelector('#participants .tablewrap');
  if(wrap)wrap.scrollTop=profileListScrollY;
}
function profileTab(tab){
  if(!['overview','history','partners','opponents','analytics','settings'].includes(tab))return;
  profileActiveTab=tab;
  renderParticipantProfile();
}
function profileStat(label,value,note,cls=''){
  return '<div class="pp-stat"><span>'+esc(label)+'</span><strong class="'+cls+' pp-info-number">'+esc(value)+'</strong><small>'+esc(note)+'</small></div>';
}
function profileMini(label,value,note=''){
  return '<div class="pp-mini"><span>'+esc(label)+'</span><strong class="pp-info-number">'+esc(value)+'</strong><small>'+esc(note)+'</small></div>';
}
function profileBar(name,value,max){
  const pct=max?Math.max(0,Math.min(100,value/max*100)):0;
  return '<div class="pp-barrow"><span title="'+esc(name)+'">'+esc(name)+'</span><div class="pp-bar-track"><div class="pp-bar-fill" style="width:'+pct.toFixed(1)+'%"></div></div><b>'+ppNum(value)+'</b></div>';
}
function profileMatchGames(row){
  const all=games.filter(x=>x.match_id===row.match_id).sort((a,b)=>a.game_number-b.game_number);
  if(!all.length)return '—';
  return all.map(g=>row.team==='A'?(g.team_a_score+'–'+g.team_b_score):(g.team_b_score+'–'+g.team_a_score)).join(' · ');
}
function profileMatchRow(row){
  const partner=ppPlayer(row.partner_id),op1=ppPlayer(row.opponent_1_id),op2=ppPlayer(row.opponent_2_id);
  return '<tr><td><b>#'+ppNum(row.match_number)+'</b><div class="small muted">'+dateFmt(row.scheduled_date)+'</div></td>'
   +'<td>'+esc(partner.display_name)+'</td><td>'+esc(op1.display_name)+' / '+esc(op2.display_name)+'</td>'
   +'<td><span class="pp-pill '+(row.result==='W'?'win':'loss')+'">'+(row.result==='W'?'WIN':'LOSS')+'</span></td>'
   +'<td>'+esc(profileMatchGames(row))+'</td>'
   +'<td>'+ppNum(row.points_for)+'–'+ppNum(row.points_against)+'</td>'
   +'<td class="'+(Number(row.score_difference)>=0?'pos':'neg')+'">'+signed(row.score_difference)+'</td></tr>';
}
function profileScheduleBlock(ctx,m){
  if(!m)return '<div class="pp-empty">No upcoming match scheduled yet.</div>';
  const players=matchPlayers.filter(x=>x.match_id===m.id);
  const mine=players.find(x=>x.actual_player_id===ctx.p.id);
  const teammate=players.find(x=>x.team===mine?.team&&x.actual_player_id!==ctx.p.id);
  const rivals=players.filter(x=>x.team!==mine?.team).map(x=>ppPlayer(x.actual_player_id).display_name);
  return '<div class="pp-row"><div class="pp-row-text"><strong>Match '+m.match_number+' · '+dateFmt(m.scheduled_date)+'</strong><small>Slot '+m.slot+' · '+esc(ppLiveStatus(m))+'</small></div><span class="pp-pill pending">Upcoming</span></div>'
    +'<div class="pp-row"><div class="pp-row-text"><strong>Teammate</strong><small>'+esc(ppPlayer(teammate?.actual_player_id).display_name)+'</small></div></div>'
    +'<div class="pp-row"><div class="pp-row-text"><strong>Opponents</strong><small>'+esc(rivals.join(' / '))+'</small></div></div>';
}
function profileOverview(ctx){
  const last=ctx.completed[0],p=ctx.p,s=ctx.s,progress=ctx.target?Math.min(100,Number(s.matches_played||0)/ctx.target*100):0;
  const recent=ctx.completed.slice(0,7);
  return '<div class="pp-grid">'
  +'<article class="pp-card"><h3>Competition journey</h3><p class="pp-card-sub">Progress toward this player’s match target</p>'
  +'<div class="pp-row"><div class="pp-row-text"><strong>'+ppNum(s.matches_played)+' of '+ppNum(ctx.target)+' matches</strong><small>'+ppNum(Math.max(0,ctx.target-Number(s.matches_played||0)))+' remaining</small></div><div class="pp-row-value">'+progress.toFixed(0)+'%</div></div>'
  +'<div class="pp-bar-track" style="height:14px;margin:14px 0 18px"><div class="pp-bar-fill" style="width:'+progress.toFixed(1)+'%"></div></div>'
  +'<div class="pp-kpi-strip">'
  +profileMini('Official rank',ctx.r?'#'+ctx.r.official_rank:'—','Current standing')
  +profileMini('Current streak',ctx.currentStreak.count?ctx.currentStreak.count+' '+(ctx.currentStreak.result==='W'?'wins':'losses'):'—','Consecutive completed matches')
  +profileMini('Longest win streak',ppNum(ctx.highestWinStreak),'Matches won consecutively')
  +'</div></article>'
  +'<article class="pp-card"><h3>Next match</h3><p class="pp-card-sub">Upcoming schedule and lineup</p>'+profileScheduleBlock(ctx,ctx.upcoming[0])+'</article>'
  +'<article class="pp-card"><h3>Recent form</h3><p class="pp-card-sub">Last seven finished matches</p>'
  +(recent.length?'<div class="pp-form">'+recent.map(x=>'<span class="'+(x.result==='W'?'pp-result-w':'pp-result-l')+'" title="Match '+x.match_number+'">'+(x.result==='W'?'✓ W':'✕ L')+'</span>').join('')+'</div>':'<div class="pp-empty">No completed matches yet.</div>')
  +'<div class="pp-kpi-strip" style="margin-top:14px">'
  +profileMini('Unique partners',String(ctx.partners.length),'Rotating teammates')
  +profileMini('Unique opponents',String(ctx.opponents.length),'Players faced')
  +profileMini('Win rate',Number(s.win_pct||0).toFixed(1)+'%','All completed matches')
  +'</div></article>'
  +'<article class="pp-card"><h3>Last completed match</h3><p class="pp-card-sub">Most recent result</p>'
  +(last?'<div class="pp-row"><div class="pp-row-text"><strong>Match '+last.match_number+' · '+dateFmt(last.scheduled_date)+'</strong><small>Partner: '+esc(last.partner)+'</small></div><span class="pp-pill '+(last.result==='W'?'win':'loss')+'">'+(last.result==='W'?'WIN':'LOSS')+'</span></div>'
   +'<div class="pp-row"><div class="pp-row-text"><strong>Opponents</strong><small>'+esc(last.opponent_1)+' &amp; '+esc(last.opponent_2)+'</small></div></div>'
   +'<div class="pp-row"><div class="pp-row-text"><strong>Points '+ppNum(last.points_for)+'–'+ppNum(last.points_against)+'</strong><small>Game scores: '+esc(profileMatchGames(last))+'</small></div><div class="pp-row-value">'+signed(last.score_difference)+'</div></div>'
   :'<div class="pp-empty">No completed match yet.</div>')
  +'</article></div>';
}
function profileHistory(ctx){
  return '<article class="pp-card"><h3>Completed match history</h3><p class="pp-card-sub">'+ctx.completed.length+' recorded matches · game scores displayed from the official match records</p>'
    +(ctx.completed.length?'<div class="pp-tablewrap"><table class="pp-table"><thead><tr><th>Match / Date</th><th>Partner</th><th>Opponents</th><th>Result</th><th>Game Scores</th><th>PF–PA</th><th>Diff.</th></tr></thead><tbody>'+ctx.completed.map(profileMatchRow).join('')+'</tbody></table></div>'
      :'<div class="pp-empty">Match history will appear when the first result is saved.</div>')
    +'</article><article class="pp-card" style="margin-top:14px"><h3>Upcoming fixtures</h3><p class="pp-card-sub">Scheduled and live matches are shown separately from completed history</p>'
    +(ctx.upcoming.length?'<div class="pp-tablewrap"><table class="pp-table"><thead><tr><th>Match</th><th>Date</th><th>Slot</th><th>Teammate</th><th>Opponents</th><th>Status</th></tr></thead><tbody>'
      +ctx.upcoming.map(m=>{const arr=matchPlayers.filter(x=>x.match_id===m.id),mine=arr.find(x=>x.actual_player_id===ctx.p.id),teammate=arr.find(x=>x.team===mine?.team&&x.actual_player_id!==ctx.p.id),opp=arr.filter(x=>x.team!==mine?.team).map(x=>ppPlayer(x.actual_player_id).display_name).join(' / ');return '<tr><td>#'+m.match_number+'</td><td>'+dateFmt(m.scheduled_date)+'</td><td>'+m.slot+'</td><td>'+esc(ppPlayer(teammate?.actual_player_id).display_name)+'</td><td>'+esc(opp)+'</td><td>'+esc(ppLiveStatus(m))+'</td></tr>'}).join('')+'</tbody></table></div>'
      :'<div class="pp-empty">No matches currently scheduled.</div>')
    +'</article>';
}
function profilePartners(ctx){
  return '<article class="pp-card"><h3>Partner rotation</h3><p class="pp-card-sub">All completed pairings · no-repeat-partner competition rule remains enforced</p>'
  +(ctx.partners.length?'<div class="pp-pair-grid">'+ctx.partners.map(x=>'<div class="pp-pair">'+profileAvatarHTML(ppPlayer(x.id),'pp-avatar-small')
  +'<div class="pp-pair-info"><strong>'+esc(x.name)+'</strong><small>'+x.games+' match'+(x.games===1?'':'es')+' together</small></div>'
  +'<div class="pp-pair-stats">'+x.wins+'W–'+x.losses+'L<br><small>'+((x.wins/x.games)*100).toFixed(0)+'% win</small></div></div>').join('')+'</div>'
    :'<div class="pp-empty">No completed partner history yet.</div>')+'</article>';
}
function profileOpponents(ctx){
  return '<article class="pp-card"><h3>Opponent history</h3><p class="pp-card-sub">Head-to-head encounters count each individual opposing player per match</p>'
  +(ctx.opponents.length?'<div class="pp-pair-grid">'+ctx.opponents.map(x=>'<div class="pp-pair">'+profileAvatarHTML(ppPlayer(x.id),'pp-avatar-small')
  +'<div class="pp-pair-info"><strong>'+esc(x.name)+'</strong><small>'+x.games+' encounter'+(x.games===1?'':'s')+' · Skill '+ppAvg(x.skill)+'</small></div>'
  +'<div class="pp-pair-stats">'+x.wins+'W–'+x.losses+'L<br><small>'+((x.wins/x.games)*100).toFixed(0)+'% win</small></div></div>').join('')+'</div>'
    :'<div class="pp-empty">No completed opponent history yet.</div>')+'</article>';
}
function profileAnalytics(ctx){
  const s=ctx.s,played=Number(s.matches_played||0),maxSlots=Math.max(1,...Object.values(ctx.slotCounts));
  const topOpponent=[...ctx.opponents].sort((a,b)=>b.skill-a.skill||b.games-a.games)[0];
  const mostFaced=[...ctx.opponents].sort((a,b)=>b.games-a.games)[0];
  const bestPartner=[...ctx.partners].sort((a,b)=>(b.wins/b.games)-(a.wins/a.games)||b.games-a.games)[0];
  const recentFive=ctx.completed.slice(0,5),last5wins=recentFive.filter(x=>x.result==='W').length;
  return '<div class="pp-grid">'
   +'<article class="pp-card"><h3>Performance statistics</h3><p class="pp-card-sub">Derived from scored match results</p>'
   +'<div class="pp-kpi-strip">'
   +profileMini('Points / match',played?ppAvg(Number(s.points_for||0)/played,1):'—','Scored on average')
   +profileMini('Point diff. / match',played?ppAvg(Number(s.score_difference||0)/played,1):'—','For minus against')
   +profileMini('Recent 5 win rate',recentFive.length?Math.round(last5wins/recentFive.length*100)+'%':'—',last5wins+' of '+recentFive.length+' wins')
   +profileMini('Avg teammate skill',ppAvg(ctx.avgTeammate),'Current player ratings')
   +profileMini('Avg opposing skill',ppAvg(ctx.avgOpponents),'Current player ratings')
   +profileMini('Games win rate',Number(s.games_won||0)+Number(s.games_lost||0)?Math.round(Number(s.games_won||0)/(Number(s.games_won||0)+Number(s.games_lost||0))*100)+'%':'—','Individual games')
   +'</div></article>'
   +'<article class="pp-card"><h3>Competition insights</h3><p class="pp-card-sub">Partner and opponent insights from completed matches</p>'
   +'<div class="pp-row"><div class="pp-row-text"><strong>Best winning partner</strong><small>Among recorded partners</small></div><span class="pp-row-value">'+esc(bestPartner?.name||'—')+'</span></div>'
   +'<div class="pp-row"><div class="pp-row-text"><strong>Highest-rated opponent</strong><small>Current skill rating</small></div><span class="pp-row-value">'+esc(topOpponent?.name||'—')+'</span></div>'
   +'<div class="pp-row"><div class="pp-row-text"><strong>Most frequent opponent</strong><small>'+ppNum(mostFaced?.games||0)+' encounters</small></div><span class="pp-row-value">'+esc(mostFaced?.name||'—')+'</span></div>'
   +'<div class="pp-row"><div class="pp-row-text"><strong>Longest winning streak</strong><small>Consecutive completed matches</small></div><span class="pp-row-value">'+ppNum(ctx.highestWinStreak)+'</span></div>'
   +'</article>'
   +'<article class="pp-card"><h3>Match distribution</h3><p class="pp-card-sub">Completed matches by competition day</p><div class="pp-bars">'
   +profileBar('Thursday',ctx.dayCounts.Thursday,Math.max(1,played))
   +profileBar('Friday',ctx.dayCounts.Friday,Math.max(1,played))
   +profileBar('Other days',ctx.dayCounts.Other,Math.max(1,played))
   +'</div></article>'
   +'<article class="pp-card"><h3>Schedule slot analysis</h3><p class="pp-card-sub">Number of completed matches in each slot</p><div class="pp-bars">'
   +[1,2,3,4].map(slot=>profileBar('Game '+slot,ctx.slotCounts[slot]||0,maxSlots)).join('')
   +'</div></article>'
   +'</div>';
}
function profileSettings(ctx){
  if(!isAdmin())return '<div class="pp-empty">Admin access required.</div>';
  const p=ctx.p;
  const toggle=(name,key,desc)=>'<div class="pp-config"><div><strong>'+esc(name)+'</strong><small>'+esc(desc)+'</small></div>'
    +'<select aria-label="'+esc(name)+'" onchange="updateProfileSetting(\''+key+'\',this.value,this)" '+(profileUploadBusy?'disabled':'')+'>'
    +'<option value="false" '+(p[key]!==true?'selected':'')+'>No</option>'
    +'<option value="true" '+(p[key]===true?'selected':'')+'>Yes</option></select></div>';
  return '<div class="pp-grid">'
   +'<article class="pp-card"><h3>Match generation preferences</h3><p class="pp-card-sub">Saved immediately and applied on the next Generate / Refresh or Reshuffle</p>'
   +toggle('1 Play / Week','one_play_per_week','At most one match in a Monday–Sunday week. Incompatible with either two-game day.')
   +toggle('2 Games Thursday','double_games_thursday','Thursday only, up to two separated games; cannot play Friday.')
   +toggle('2 Games Friday','double_games_friday','Friday only, up to two separated games; cannot play Thursday.')
   +'<div class="pp-notice">Selecting either two-game option automatically turns off 1 Play / Week and the other two-game option. Completed scores, rankings and existing scheduled lineups are not automatically regenerated.</div>'
   +'</article>'
   +'<article class="pp-card"><h3>Participation and profile</h3><p class="pp-card-sub">Control availability and target matches</p>'
   +toggle('Next Match Available','can_play_next_match','Allow this player in the next generated schedule.')
   +toggle('Last Game Eligible','can_play_last_game','Allow this player in the final slot of each competition day.')
   +'<div class="pp-config"><div><strong>Match target</strong><small>Override the competition default of '+ppNum(competition?.target_matches_per_player||15)+' matches</small></div><input id="ppTargetMatches" type="number" min="1" max="100" value="'+ppNum(ctx.target)+'" onchange="saveProfileTarget(this)" aria-label="Target matches" style="width:90px"></div>'
   +'<div class="pp-config"><div><strong>Skill level</strong><small>1.0–5.0; displayed match averages update immediately</small></div><input id="ppSkillLevel" type="number" min="1" max="5" step=".1" value="'+Number(p.skill_level||3).toFixed(1)+'" onchange="saveProfileSkill(this)" aria-label="Skill level" style="width:90px"></div>'
   +'<div class="pp-row"><div class="pp-row-text"><strong>Profile management</strong><small>Edit name or archive without deleting match history</small></div><div><button class="pp-linkbtn" onclick="openParticipant(\''+p.id+'\')">Edit name</button> '
   +(p.active?'<button class="pp-linkbtn" onclick="archiveParticipant(\''+p.id+'\')">Archive</button>':'<span class="pp-pill loss">Inactive</span>')+'</div></div>'
   +'</article></div>';
}

function profileFeaturePortrait(ctx){
  const p=ctx.p;
  const image=safeProfilePhotoUrl(p.profile_image_url);
  return '<aside class="pp-editorial-left">'
    +'<div class="pp-photo-frame">'
    +'<div class="pp-photo-placeholder" aria-label="Profile photograph placeholder">'
    +'<span class="pp-placeholder-halo"></span><span class="pp-placeholder-initial">'+esc(ppInitials(p.display_name))+'</span>'
    +'<span class="pp-placeholder-caption">TLP PLAYERS</span></div>'
    +(image?'<img class="pp-feature-img" src="'+esc(image)+'" alt="Profile photo of '+esc(p.display_name)+'" loading="eager" onerror="this.remove()">':'')
    +'<span class="pp-photo-status">'+(p.active?'● ACTIVE PLAYER':'○ INACTIVE')+'</span>'
    +'</div>'
    +(isAdmin()?'<label class="pp-photo-upload"><span aria-hidden="true">↥</span> '+(p.profile_image_url?'Change profile photo':'Upload profile photo')+'<input type="file" accept="image/jpeg,image/png,image/webp" onchange="uploadParticipantPhoto(this)"></label>':'')
    +'<div class="pp-left-details">'
    +'<div class="pp-left-detail"><span>PLAYER ID</span><b>'+esc(p.player_code)+'</b></div>'
    +'<div class="pp-left-detail"><span>CURRENT SKILL</span><b>'+Number(p.skill_level||3).toFixed(1)+' / 5.0</b></div>'
    +'<div class="pp-left-detail"><span>COMPETITION</span><b>'+esc(competition?.name||'TLP Teachers Pickleball')+'</b></div>'
    +'<div class="pp-left-detail"><span>PARTICIPATION</span><b>'+(p.can_play_next_match!==false?'Available for next match':'Not available for next match')+'</b></div>'
    +'</div></aside>';
}
function profileCompactCard(label,value,note,styleClass=''){
  return '<div class="pp-feature-stat '+styleClass+'"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(note)+'</small></div>';
}
function profileFeatureMain(ctx){
  const p=ctx.p,s=ctx.s,r=ctx.r;
  const played=Number(s.matches_played||0),wins=Number(s.match_wins||0),losses=Number(s.match_losses||0);
  const pct=played?Math.min(100,Math.max(0,wins/played*100)):0;
  const progress=ctx.target?Math.max(0,Math.min(100,played/ctx.target*100)):0;
  const recent=ctx.completed.slice(0,6);
  const maxDay=Math.max(1,ctx.dayCounts.Thursday,ctx.dayCounts.Friday,ctx.dayCounts.Other);
  return '<div class="pp-editorial-main">'
    +'<div class="pp-feature-eyebrow"><span class="pp-eyebrow-dot"></span> TLP TEACHERS PICKLEBALL · PLAYER PROFILE</div>'
    +'<h2>'+esc(p.display_name)+'</h2>'
    +'<div class="pp-feature-subhead"><span class="pp-verified">✓ Registered participant</span><span>Code '+esc(p.player_code)+'</span></div>'
    +'<div class="pp-feature-skill"><div class="pp-skill-badge"><strong>'+Number(p.skill_level||3).toFixed(1)+'</strong><span>SKILL<br>LEVEL</span></div>'
    +'<div class="pp-skill-text"><strong>'+ (Number(p.skill_level||3)>=4?'Advanced competitor':Number(p.skill_level||3)>=3?'Developing competitor':'Growing competitor')+'</strong><small>Player skill rating used in team balancing</small>'
    +'<div class="pp-skill-progress"><span style="width:'+Math.max(0,Math.min(100,Number(p.skill_level||3)/5*100)).toFixed(1)+'%"></span></div></div></div>'
    +'<div class="pp-feature-sectiontitle">Performance at a glance</div>'
    +'<div class="pp-performance-box">'
    +'<div class="pp-performance-ring" role="img" aria-label="Win rate '+pct.toFixed(1)+' percent" style="--pp-win:'+pct.toFixed(1)+'%"><div><b>'+pct.toFixed(0)+'%</b><small>Win rate</small></div></div>'
    +'<div class="pp-performance-copy"><strong>'+ppNum(wins)+' wins <span>·</span> '+ppNum(losses)+' losses</strong>'
    +'<p>Official results from '+ppNum(played)+' completed '+(played===1?'match':'matches')+'.</p>'
    +'<div class="pp-performance-key"><span><i class="pp-win-key"></i> Wins '+ppNum(wins)+'</span><span><i class="pp-loss-key"></i> Losses '+ppNum(losses)+'</span></div>'
    +'<div class="pp-performance-rank"><span>Current rank</span><strong>'+(r?'#'+r.official_rank:'—')+'</strong><span>of '+ppNum(rankings.filter(x=>x.active).length)+' active players</span></div>'
    +'</div></div>'
    +'<div class="pp-feature-sectiontitle">Competition highlights</div>'
    +'<div class="pp-feature-tiles">'
    +profileCompactCard('Matches played',ppNum(played),'of '+ppNum(ctx.target)+' target')
    +profileCompactCard('Games won',ppNum(s.games_won||0),'vs '+ppNum(s.games_lost||0)+' lost')
    +profileCompactCard('Point differential',signed(s.score_difference||0),'PF '+ppNum(s.points_for||0)+' · PA '+ppNum(s.points_against||0),Number(s.score_difference||0)>=0?'pp-stat-positive':'pp-stat-negative')
    +'</div>'
    +'<div class="pp-feature-sectiontitle">Recent form</div>'
    +'<div class="pp-feature-recent">'+(recent.length?recent.map(row=>'<span class="pp-form-token '+(row.result==='W'?'win':'loss')+'" title="Match '+row.match_number+' · '+dateFmt(row.scheduled_date)+'">'+(row.result==='W'?'W':'L')+'</span>').join(''):'<span class="pp-feature-help">Results appear after the first completed match.</span>')+'</div>'
    +'<div class="pp-feature-sectiontitle">Played by competition day</div>'
    +'<div class="pp-feature-bars">'
    +profileBar('Thursday',ctx.dayCounts.Thursday,maxDay)
    +profileBar('Friday',ctx.dayCounts.Friday,maxDay)
    +profileBar('Other',ctx.dayCounts.Other,maxDay)
    +'</div></div>';
}
function profileFeatureRail(ctx){
  const m=ctx.upcoming[0];
  let schedule='';
  if(m){
    const side=matchPlayers.filter(x=>x.match_id===m.id);
    const mine=side.find(x=>x.actual_player_id===ctx.p.id);
    const teammate=side.find(x=>x.team===mine?.team&&x.actual_player_id!==ctx.p.id);
    const opponents=side.filter(x=>x.team!==mine?.team).map(x=>ppPlayer(x.actual_player_id).display_name);
    const dateParts=new Date(m.scheduled_date+'T12:00:00Z');
    const weekday=dateParts.toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long'});
    const month=dateParts.toLocaleDateString('en-US',{timeZone:'UTC',month:'long'});
    schedule='<div class="pp-fixture-date"><span>'+weekday+', '+month+'</span><strong>'+dateParts.getUTCDate()+'</strong><span>'+dateParts.getUTCFullYear()+'</span></div>'
      +'<div class="pp-fixture-id">MATCH '+m.match_number+' <span>·</span> GAME '+m.slot+'</div>'
      +'<div class="pp-fixture-side"><small>TEAMMATE</small><b>'+esc(ppPlayer(teammate?.actual_player_id).display_name)+'</b></div>'
      +'<div class="pp-fixture-versus">VERSUS</div>'
      +'<div class="pp-fixture-side"><small>OPPONENTS</small><b>'+esc(opponents.join(' & '))+'</b></div>'
      +'<div class="pp-fixture-state">'+esc(ppLiveStatus(m))+'</div>';
  }else schedule='<div class="pp-fixture-empty"><strong>No upcoming match</strong><p>A new fixture will appear here after scheduling.</p></div>';
  const c=ctx.p,preferences=[
    ['Weekly limit',c.one_play_per_week?'1 game / week':'Standard'],
    ['Thursday double',c.double_games_thursday?'Yes':'No'],
    ['Friday double',c.double_games_friday?'Yes':'No']
  ];
  return '<aside class="pp-editorial-rail"><div class="pp-next-fixture"><div class="pp-rail-kicker">UP NEXT</div><h3>Next Match</h3>'
    +schedule+'<button type="button" class="pp-fixture-action" onclick="go(\'matches\')">View match schedule →</button></div>'
    +'<div class="pp-rail-settings"><div class="pp-rail-kicker">PLAYER AVAILABILITY</div><h3>Match preferences</h3>'
    +preferences.map(item=>'<div class="pp-rail-preference"><span>'+esc(item[0])+'</span><strong>'+esc(item[1])+'</strong></div>').join('')
    +'<button class="pp-rail-settings-btn" type="button" onclick="profileTab(\'settings\')">Manage settings →</button></div></aside>';
}
function renderParticipantProfile(){
  const host=document.getElementById('ppContent');
  if(!host)return;
  const ctx=profileContext();
  if(!ctx){host.innerHTML='<div class="pp-empty">Player not found. <button class="pp-linkbtn" onclick="returnToParticipants()">All Participants</button></div>';return;}
  const s=ctx.s;
  const top='<div class="pp-premium-layout">'+profileFeaturePortrait(ctx)+profileFeatureMain(ctx)+profileFeatureRail(ctx)+'</div>';
  const details='<div class="pp-feature-secondary">'
    +profileCompactCard('Points for',ppNum(s.points_for||0),'Total points scored')
    +profileCompactCard('Points against',ppNum(s.points_against||0),'Points conceded')
    +profileCompactCard('Remaining matches',ppNum(Math.max(0,ctx.target-Number(s.matches_played||0))),'To target of '+ppNum(ctx.target))
    +profileCompactCard('Unique partners',ppNum(ctx.partners.length),'Different teammates')
    +profileCompactCard('Unique opponents',ppNum(ctx.opponents.length),'Players faced')
    +'</div>';
  const tabs=[['overview','Overview'],['history','Match History'],['partners','Partners'],['opponents','Opponents'],['analytics','Analytics'],['settings','Settings']];
  const nav='<div class="pp-tabs" role="tablist" aria-label="Participant profile sections">'
    +tabs.map(([key,label])=>'<button type="button" role="tab" aria-selected="'+(key===profileActiveTab)+'" class="'+(key===profileActiveTab?'active':'')+'" onclick="profileTab(\''+key+'\')">'+label+'</button>').join('')+'</div>';
  const renderers={overview:profileOverview,history:profileHistory,partners:profilePartners,opponents:profileOpponents,analytics:profileAnalytics,settings:profileSettings};
  host.innerHTML='<div class="pp-premium-shell">'+top+details+nav+'<div class="pp-panel" role="tabpanel">'+renderers[profileActiveTab](ctx)+'</div></div>';
}

function renderParticipantList(){
  const q=(document.getElementById('participantSearch')?.value||'').toLowerCase(),status=document.getElementById('participantStatus')?.value||'ALL';
  const entries=participants.filter(p=>(p.display_name+' '+p.player_code).toLowerCase().includes(q)&&(status==='ALL'||(status==='ACTIVE'?p.active:!p.active))).map(p=>{
    const st=statById(p.id)||{},target=p.target_matches||competition?.target_matches_per_player||15;
    return {p,st,rank:ppRank(p),rem:Math.max(0,target-(st.matches_played||0)),skill:Number(p.skill_level||3),canLast:p.can_play_last_game!==false,canNext:p.can_play_next_match!==false};
  });
  const dir=participantSortDir==='asc'?1:-1;
  const get=x=>{switch(participantSortKey){
    case 'player':return x.p.display_name.toLowerCase();
    case 'skill':return x.skill;
    case 'lastGame':return x.canLast?1:0;
    case 'nextMatch':return x.canNext?1:0;
    case 'rank':return x.rank?.official_rank||999;
    case 'played':return Number(x.st.matches_played||0);
    case 'wins':return Number(x.st.match_wins||0);
    case 'upcoming':return Number(x.st.upcoming_matches||0);
    case 'remaining':return x.rem;
    case 'status':return x.p.active?1:0;
    default:return x.p.display_name.toLowerCase();
  }};
  entries.sort((a,b)=>{const av=get(a),bv=get(b);if(typeof av==='string')return av.localeCompare(bv)*dir;if(av===bv)return a.p.display_name.localeCompare(b.p.display_name);return(av-bv)*dir});
  document.getElementById('participantsBody').innerHTML=entries.map(x=>{
    const {p,st,rank,rem,skill,canLast,canNext}=x;
    const playerCell='<div class="pp-player-cell">'+profileAvatarHTML(p,'pp-avatar-small')+'<div><button class="pp-click-name" onclick="openParticipantProfile(\''+p.id+'\')"><b>'+esc(p.display_name)+'</b></button><div class="small muted">'+esc(p.player_code)+'</div></div></div>';
    const skillCell=isAdmin()?'<div class="skill-editor"><input class="skill-input" type="number" min="1" max="5" step=".1" value="'+skill.toFixed(1)+'" oninput="queueSkillSave(\''+p.id+'\',this)" onblur="flushSkillSave(\''+p.id+'\',this)" onkeydown="handleSkillKey(event,\''+p.id+'\',this)">'+skillBadge(skill)+'</div>':skillBadge(skill);
    const toggle=(val,fn)=>isAdmin()?'<select class="lastgame-select '+(val?'lastgame-yes':'lastgame-no')+'" onchange="'+fn+'(\''+p.id+'\',this)"><option value="true" '+(val?'selected':'')+'>Yes</option><option value="false" '+(!val?'selected':'')+'>No</option></select>':'<span class="tag '+(val?'ready':'warn')+'">'+(val?'YES':'NO')+'</span>';
    return '<tr><td>'+playerCell+'</td><td><b>'+(rank?'#'+rank.official_rank:'—')+'</b></td><td>'+skillCell+'</td>'
      +'<td>'+toggle(canLast,'updateLastGame')+'</td><td>'+toggle(canNext,'updateNextMatch')+'</td>'
      +'<td>'+ppNum(st.matches_played||0)+'</td><td>'+ppNum(st.match_wins||0)+'</td><td>'+ppNum(st.upcoming_matches||0)+'</td><td>'+ppNum(rem)+'</td>'
      +'<td><span class="tag '+(p.active?'ready':'warn')+'">'+(p.active?'ACTIVE':'INACTIVE')+'</span></td>'
      +'<td><button class="pp-linkbtn" onclick="openParticipantProfile(\''+p.id+'\')">View Profile</button> '
      +(isAdmin()?'<button class="btn secondary sm" onclick="openParticipant(\''+p.id+'\')">Edit Name</button> '+(p.active?'<button class="btn red sm" onclick="archiveParticipant(\''+p.id+'\')">Archive</button>':''):'')+'</td></tr>';
  }).join('');
  updateParticipantSortIndicators();
}
async function updateProfileSetting(field,value,select){
  if(!requireAdmin()||!currentProfilePlayerId)return;
  const allowed=['one_play_per_week','double_games_thursday','double_games_friday','can_play_last_game','can_play_next_match'];
  if(!allowed.includes(field))return;
  const on=value==='true',patch={[field]:on};
  const p=playerById(currentProfilePlayerId);if(!p)return;
  if(on&&field==='one_play_per_week'){patch.double_games_thursday=false;patch.double_games_friday=false;}
  if(on&&field==='double_games_thursday'){patch.double_games_friday=false;patch.one_play_per_week=false;}
  if(on&&field==='double_games_friday'){patch.double_games_thursday=false;patch.one_play_per_week=false;}
  select.disabled=true;
  const {error}=await sb.from('participants').update(patch).eq('id',p.id).eq('competition_id',competition.id);
  select.disabled=false;
  if(error){toast('Unable to save settings: '+error.message,true);await loadAll();return;}
  Object.assign(p,patch);
  await loadAll();
  toast('Profile preferences saved. Use Generate / Refresh when you want to apply them to upcoming matches.');
}
async function saveProfileTarget(input){
  if(!requireAdmin())return;
  const value=Number(input.value);
  if(!Number.isInteger(value)||value<1||value>100){toast('Match target must be an integer from 1 to 100.',true);renderParticipantProfile();return;}
  input.disabled=true;
  const {error}=await sb.from('participants').update({target_matches:value}).eq('id',currentProfilePlayerId).eq('competition_id',competition.id);
  input.disabled=false;if(error){toast(error.message,true);renderParticipantProfile();return;}
  await loadAll();toast('Match target saved.');
}
async function saveProfileSkill(input){
  if(!requireAdmin())return;
  const value=Math.round(Number(input.value)*10)/10;
  if(!Number.isFinite(value)||value<1||value>5){toast('Skill must be 1.0–5.0.',true);renderParticipantProfile();return;}
  input.disabled=true;
  const {error}=await sb.from('participants').update({skill_level:value}).eq('id',currentProfilePlayerId).eq('competition_id',competition.id);
  input.disabled=false;if(error){toast(error.message,true);renderParticipantProfile();return;}
  await loadAll();toast('Skill level saved. Future match balancing uses the new rating.');
}
async function prepareProfilePhoto(file){
  const objectUrl=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{
      const el=new Image();
      el.onload=()=>resolve(el);
      el.onerror=()=>reject(new Error('Could not read the selected photo.'));
      el.src=objectUrl;
    });
    const naturalWidth=img.naturalWidth||img.width;
    const naturalHeight=img.naturalHeight||img.height;
    if(!naturalWidth||!naturalHeight)throw new Error('Invalid image dimensions.');

    // Preserve the whole original image, including any transparent space.
    // Do not crop to a square: portraits can be tall, and the CSS frame fits
    // their full proportions against a pickleball gradient background.
    const maxBytes=3145728;
    const maxDimension=Math.max(naturalWidth,naturalHeight);
    const dimensions=[1800,1500,1200,900,650];
    const qualities=[0.86,0.82,0.78,0.73,0.68];
    const canvas=document.createElement('canvas');
    const g=canvas.getContext('2d',{alpha:true});
    if(!g)throw new Error('Image processing is not available in this browser.');

    const encode=(type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));
    for(let i=0;i<dimensions.length;i++){
      const scale=Math.min(1,dimensions[i]/maxDimension);
      canvas.width=Math.max(1,Math.round(naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(naturalHeight*scale));
      g.clearRect(0,0,canvas.width,canvas.height);
      g.drawImage(img,0,0,canvas.width,canvas.height);

      // WebP retains transparent backgrounds and provides smaller files.
      let blob=await encode('image/webp',qualities[i]);
      // PNG fallback also preserves alpha, which matters for player cutouts.
      if(!blob||blob.type!=='image/webp'){
        blob=await encode('image/png');
      }
      if(blob&&blob.size<=maxBytes)return blob;
    }
    throw new Error('The photo is too large to optimize. Choose a smaller image.');
  }finally{
    URL.revokeObjectURL(objectUrl);
  }
}
async function uploadParticipantPhoto(input){
  if(!requireAdmin()||profileUploadBusy)return;
  const file=input?.files?.[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))return toast('Choose a JPG, PNG or WebP image.',true);
  if(file.size>8*1024*1024)return toast('Choose an image smaller than 8 MB.',true);
  const p=playerById(currentProfilePlayerId);
  if(!p)return toast('Participant no longer exists.',true);
  profileUploadBusy=true;input.disabled=true;
  const old=safeProfilePhotoUrl(p.profile_image_url);
  let path='';
  try{
    const blob=await prepareProfilePhoto(file);
    const ext=blob.type==='image/webp'?'webp':'jpg';
    path=competition.id+'/'+p.id+'/'+Date.now()+'-'+Math.random().toString(36).slice(2,8)+'.'+ext;
    const {error:upErr}=await sb.storage.from('participant-photos').upload(path,blob,{contentType:blob.type,cacheControl:'31536000',upsert:false});
    if(upErr)throw upErr;
    const newUrl=sb.storage.from('participant-photos').getPublicUrl(path).data.publicUrl;
    const {error:saveErr}=await sb.from('participants').update({profile_image_url:newUrl}).eq('id',p.id).eq('competition_id',competition.id);
    if(saveErr){
      await sb.storage.from('participant-photos').remove([path]);
      throw saveErr;
    }
    p.profile_image_url=newUrl;
    if(old){
      const previousPath=old.slice(profilePhotoPrefix.length).split('?')[0];
      if(previousPath&&previousPath!==path)await sb.storage.from('participant-photos').remove([previousPath]);
    }
    toast('Profile photo uploaded successfully.');
    await loadAll();
  }catch(err){toast('Photo upload failed: '+(err?.message||String(err)),true)}
  finally{profileUploadBusy=false;input.disabled=false;input.value='';}
}
