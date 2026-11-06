/* TLP Teachers Pickleball – broadcast match cards, Nov 2026
 * Presentation only. Uses existing live match and participant data.
 * Existing scoring, lock, reshuffle, drag/drop and management handlers stay intact.
 */
function mcvPortrait(player){
  const name=player?.display_name||'Player TBD';
  const raw=player?.profile_image_url;
  const photo=typeof safeProfilePhotoUrl==='function'?safeProfilePhotoUrl(raw):'';
  const initials=(name.trim().split(/\s+/).map(x=>x[0]).slice(-2).join('')||'?').toUpperCase();
  return '<div class="mcv-portrait" aria-label="'+esc(name)+' portrait">'
    +'<div class="mcv-person-fallback" aria-hidden="true">'
    +'<svg viewBox="0 0 140 155" preserveAspectRatio="xMidYMax meet" focusable="false"><circle cx="70" cy="50" r="31" fill="currentColor" opacity=".45"/><path d="M5 153C5 113 29 89 70 89s65 24 65 64" fill="currentColor" opacity=".45"/></svg>'
    +'<span>'+esc(initials)+'</span></div>'
    +(photo?'<img src="'+esc(photo)+'" loading="lazy" decoding="async" alt="'+esc(name)+'" onerror="this.remove()">':'')
    +'</div>';
}
function mcvPlayer(player,stats,isWinner){
  const name=player?.display_name||'TBD';
  const skill=Number(player?.skill_level||3);
  const label=Number.isFinite(skill)?skill.toFixed(1):'3.0';
  const fill=Math.round(Math.max(0,Math.min(5,skill))*20);
  return '<div class="mcv-player'+(isWinner?' mcv-winning-player':'')+'">'
    +mcvPortrait(player)
    +'<div class="mcv-player-info">'
    +'<div class="mcv-nameplate" title="'+esc(name)+'">'+esc(name)+'</div>'
    +'<div class="mcv-skillline"><span class="mcv-skill-chip">'+label+'</span>'
    +'<span class="mcv-stars" title="Skill '+label+' out of 5" aria-label="Skill '+label+' out of 5" style="--fill:'+fill+'%">★★★★★</span></div>'
    +'<span class="mcv-played">'+Number(stats?.matches_played||0)+' played</span>'
    +'</div></div>';
}
function mcvSide(players,average,side,winner){
  return '<div class="mcv-side mcv-side-'+side+(winner?' mcv-side-winner':'')+'">'
    +'<div class="mcv-side-label">TEAM '+(side==='a'?'A':'B')+(winner?' · WINNER':'')+'</div>'
    +'<div class="mcv-player-pair">'+players.map(x=>mcvPlayer(x.p,x.st,winner)).join('')+'</div>'
    +'<div class="mcv-avg"><span>TEAM AVG</span><strong>'+average+'</strong></div></div>';
}
function mcvActions(m,locked,done,live){
  const id=m.id;
  const lockEdit='<button class="btn secondary sm locked-edit-btn" disabled title="Unlock Matches to edit the schedule">🔒 Edit Match</button>';
  const lockReplace='<button class="btn secondary sm locked-edit-btn" disabled title="Unlock Matches to replace a player">🔒 Replace</button>';
  if(m.status==='CANCELLED')return '<span class="cancelled-caption">Cancelled · lineup preserved</span>';
  if(done)return isAdmin()?'<span class="mcv-primary-actions">'
    +(locked?lockEdit:'<button class="btn secondary sm" onclick="openEditMatch(\''+id+'\')">Edit Match</button>')
    +'<button class="btn secondary sm" onclick="openScore(\''+id+'\')">View / Edit Score</button></span>':'';
  if(live)return '<span class="mcv-primary-actions"><button class="btn sm live-admin-btn" onclick="openLiveScorer(\''+id+'\')">Live Score</button>'
    +(isAdmin()?'<button class="btn secondary sm" onclick="openScore(\''+id+'\')">Final Score</button>'
      +(locked?lockEdit:'<button class="btn secondary sm" onclick="openEditMatch(\''+id+'\')">Edit Match</button>'):'')
    +'</span>';
  return '<span class="mcv-primary-actions"><button class="btn sm green" onclick="startLiveMatch(\''+id+'\')">▶ Start Live</button>'
    +(isAdmin()?'<button class="btn secondary sm" onclick="openScore(\''+id+'\')">Final Score</button>'
      +(locked?lockEdit:'<button class="btn secondary sm" onclick="openEditMatch(\''+id+'\')">Edit Match</button>')
      +(locked?lockReplace:'<button class="btn secondary sm" onclick="openReplace(\''+id+'\')">Replace</button>'):'')
    +'</span>';
}
function cinematicMatchCard(m){
  const l=lineups(m);
  const done=m.status==='COMPLETED',live=m.status==='IN_PROGRESS',locked=matchesLocked();
  const reorderable=isReorderableMatch(m);
  const pick=(team,position)=>playerById(l.ps.find(x=>x.team===team&&x.position===position)?.actual_player_id);
  const a=[pick('A',1),pick('A',2)],b=[pick('B',1),pick('B',2)];
  const ast=a.map(p=>statById(p?.id)||{}),bst=b.map(p=>statById(p?.id)||{});
  const avg=arr=>(arr.reduce((total,p)=>total+Number(p?.skill_level||3),0)/2).toFixed(1);
  const aWon=done&&m.winner_team==='A',bWon=done&&m.winner_team==='B';
  const winnerNames=aWon?l.a1+' & '+l.a2:bWon?l.b1+' & '+l.b2:'';
  const attrs=reorderable?' data-match-id="'+m.id+'" data-match-date="'+m.scheduled_date
    +'" ondragover="allowMatchDrop(event,\''+m.id+'\')" ondragleave="clearMatchDrop(event)" ondrop="dropMatchOn(event,\''+m.id+'\')"':'';
  const status=live?'LIVE NOW':m.status.replaceAll('_',' ');
  const statusClass=done?'completed':m.status==='CANCELLED'?'cancelled':live||m.status.includes('REPLACEMENT')?'warn':'ready';
  const liveDetails=live?'<div class="mcv-live-banner"><span class="mcv-pulse"></span> LIVE · GAME '+m.live_game
    +' <strong>'+m.live_score_a+' – '+m.live_score_b+'</strong> · GAMES '+m.games_won_a+'–'+m.games_won_b+'</div>':'';
  const resultDetails=done?'<div class="mcv-completed-banner"><div class="mcv-winner-line"><span>🏆 WINNERS</span><strong>'+esc(winnerNames)+'</strong>'
    +'<b>'+m.games_won_a+' – '+m.games_won_b+'</b></div>'+completedScoreStrip(m)
    +'<span class="mcv-total-points">Total points '+m.points_a+' – '+m.points_b+'</span></div>':'';
  return '<article class="matchcard mcv-card'+(reorderable?' reorderable-match':'')+(locked?' locked-match-card':'')
    +(done?' completed-match-card':'')+(live?' mcv-is-live':'')+'"'+attrs+'>'
    +'<header class="mcv-header"><div class="mcv-brand"><span class="mcv-logo">TLP</span><span>TEACHERS PICKLEBALL</span></div>'
    +'<div class="mcv-match-label">MATCH '+m.match_number+'</div>'
    +'<div class="mcv-meta"><span>'+dateFmt(m.scheduled_date)+'</span><span>·</span><strong>Slot '+m.slot+'</strong>'+reorderTools(m)+'</div></header>'
    +'<div class="mcv-stage"><div class="mcv-court-lines" aria-hidden="true"></div>'
    +mcvSide(a.map((p,i)=>({p,st:ast[i]})),avg(a),'a',aWon)
    +'<div class="mcv-center"><div class="mcv-vs">'+(live?'LIVE':'VS')+'</div><span class="mcv-vs-sub">'+(done?'FINAL':'DOUBLES')+'</span></div>'
    +mcvSide(b.map((p,i)=>({p,st:bst[i]})),avg(b),'b',bWon)+'</div>'
    +liveDetails+resultDetails
    +'<footer class="mcv-footer"><span class="mcv-status '+statusClass+'">'+(live?'<span class="mcv-pulse"></span>':'')+esc(status)+'</span>'
    +'<div class="mcv-footer-controls">'+mcvActions(m,locked,done,live)+matchManagementActions(m)+'</div></footer>'
    +'</article>';
}
