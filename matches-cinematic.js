/* TLP Teachers Pickleball | Match broadcast cards v2
 * The stadium is painted first. Portraits and labels are positioned over it.
 * Uses all existing Supabase data and match-management functions unchanged.
 * Safe for all match statuses, draggable slots and responsive widths.
 */
function mcxPortrait(p) {
  const name=p?.display_name||'Player TBD';
  const photo=typeof safeProfilePhotoUrl==='function'?safeProfilePhotoUrl(p?.profile_image_url):'';
  const initials=name.trim().split(/\s+/).slice(-2).map(x=>x[0]||'').join('').toUpperCase()||'?';
  return '<div class="mcx-portrait'+(photo?' mcx-has-photo':'')+'">'
    +'<div class="mcx-silhouette" aria-hidden="true">'
    +'<svg viewBox="0 0 110 115" preserveAspectRatio="xMidYMax meet" focusable="false" aria-hidden="true"><circle cx="55" cy="35" r="23" fill="currentColor"/><path d="M4 114c0-31 18-54 51-54s51 23 51 54" fill="currentColor"/></svg>'
    +'<b>'+esc(initials)+'</b></div>'
    +(photo?'<img src="'+esc(photo)+'" alt="'+esc(name)+'" loading="lazy" decoding="async" onerror="this.parentNode.classList.remove(\'mcx-has-photo\');this.remove()">':'')
    +'</div>';
}
function mcxPlayer(p,st) {
  const name=p?.display_name||'TBD';
  const skill=p&&Number.isFinite(Number(p.skill_level))?Number(p.skill_level):3;
  const stars=Math.max(0,Math.min(100,skill/5*100));
  return '<div class="mcx-player" title="'+esc(name)+' · Skill '+skill.toFixed(1)+'">'
    +mcxPortrait(p)
    +'<div class="mcx-nameplate">'+esc(name)+'</div>'
    +'<div class="mcx-player-rating"><b class="mcx-skill">'+skill.toFixed(1)+'</b>'
    +'<span class="mcx-stars" style="--mcx-fill:'+stars.toFixed(0)+'%" aria-label="Skill '+skill.toFixed(1)+' out of 5">★★★★★</span></div>'
    +'<span class="mcx-player-games">'+Number(st?.matches_played||0)+' played</span></div>';
}
function mcxTeam(players,stats,side,won) {
  const av=(players.reduce((sum,p)=>sum+Number(p?.skill_level||3),0)/2).toFixed(1);
  return '<div class="mcx-team mcx-team-'+side+(won?' mcx-team-winner':'')+'">'
    +'<div class="mcx-roster">'+players.map((p,i)=>mcxPlayer(p,stats[i]||{})).join('')+'</div>'
    +'<div class="mcx-average"><span>TEAM AVG</span><strong>'+av+'</strong></div></div>';
}
function mcxActions(m,locked,done,live) {
  // Public spectators must never receive match control buttons.
  if(!isAdmin())return '';
  const id=m.id;
  const lockEdit='<button class="btn secondary sm locked-edit-btn" disabled title="Unlock Matches to edit the schedule">🔒 Edit Match</button>';
  const lockReplace='<button class="btn secondary sm locked-edit-btn" disabled title="Unlock Matches to replace a player">🔒 Replace</button>';
  if(m.status==='CANCELLED')return '<span class="cancelled-caption">Cancelled · lineup preserved</span>';
  if(done) return isAdmin()?'<span class="mcx-action-group">'
    +(locked?lockEdit:'<button class="btn secondary sm" onclick="openEditMatch(\''+id+'\')">Edit Match</button>')
    +'<button class="btn secondary sm" onclick="openScore(\''+id+'\')">View / Edit Score</button></span>':'';
  if(live)return '<span class="mcx-action-group"><button class="btn sm live-admin-btn" onclick="openLiveScorer(\''+id+'\')">Live Score</button>'
    +(isAdmin()?'<button class="btn secondary sm" onclick="openScore(\''+id+'\')">Final Score</button>'
      +(locked?lockEdit:'<button class="btn secondary sm" onclick="openEditMatch(\''+id+'\')">Edit Match</button>'):'')
    +'</span>';
  return '<span class="mcx-action-group"><button class="btn sm green" onclick="startLiveMatch(\''+id+'\')">▶ Start Live</button>'
    +(isAdmin()?'<button class="btn secondary sm" onclick="openScore(\''+id+'\')">Final Score</button>'
      +(locked?lockEdit:'<button class="btn secondary sm" onclick="openEditMatch(\''+id+'\')">Edit Match</button>')
      +(locked?lockReplace:'<button class="btn secondary sm" onclick="openReplace(\''+id+'\')">Replace</button>'):'')
    +'</span>';
}
/* Presentation-only match number: 1, 2, 3, 4 by actual match order on
 * each competition date. Database match_number and match id are untouched.
 * Recalculate from the full day's schedule rather than the current filter. */
function mcxDailyMatchNumber(m) {
  if(!m || !m.scheduled_date)return Number(m?.slot||1);
  const all=typeof matches!=='undefined'&&Array.isArray(matches)?matches:[];
  const sameDay=all.filter(x=>x.scheduled_date===m.scheduled_date && x.status!=='CANCELLED')
    .sort((a,b)=>Number(a.slot??999)-Number(b.slot??999)
      ||Number(a.match_number??0)-Number(b.match_number??0));
  const index=sameDay.findIndex(x=>x.id===m.id);
  if(index>=0)return index+1;
  // For cancelled records, retain their position among the full day's history.
  const withCancelled=all.filter(x=>x.scheduled_date===m.scheduled_date)
    .sort((a,b)=>Number(a.slot??999)-Number(b.slot??999)
      ||Number(a.match_number??0)-Number(b.match_number??0));
  const oldIndex=withCancelled.findIndex(x=>x.id===m.id);
  return oldIndex>=0?oldIndex+1:Math.max(1,Number(m.slot)||1);
}

function cinematicMatchCard(m) {
  const lineup=lineups(m), done=m.status==='COMPLETED', live=m.status==='IN_PROGRESS';
  const locked=matchesLocked(),reorderable=isReorderableMatch(m);
  const pick=(team,pos)=>playerById(lineup.ps.find(x=>x.team===team&&x.position===pos)?.actual_player_id);
  const a=[pick('A',1),pick('A',2)], b=[pick('B',1),pick('B',2)];
  const sa=a.map(p=>statById(p?.id)||{}), sb=b.map(p=>statById(p?.id)||{});
  const aWon=done&&m.winner_team==='A',bWon=done&&m.winner_team==='B';
  const winnerNames=aWon?lineup.a1+' & '+lineup.a2:bWon?lineup.b1+' & '+lineup.b2:'';
  const admin=isAdmin();
  const status=live?'LIVE NOW':m.status.replaceAll('_',' ');
  // No idle READY TO PLAY badge or empty action toolbar on public match cards.
  const showPublicStatus=done||live||m.status==='CANCELLED';
  const showFooter=admin||showPublicStatus;
  const statusClass=done?'completed':m.status==='CANCELLED'?'cancelled':live||m.status.includes('REPLACEMENT')?'warn':'ready';
  const attrs=reorderable?' data-match-id="'+m.id+'" data-match-date="'+m.scheduled_date
    +'" ondragover="allowMatchDrop(event,\''+m.id+'\')" ondragleave="clearMatchDrop(event)" ondrop="dropMatchOn(event,\''+m.id+'\')"':'';
  const liveDetails=live?'<div class="mcx-extra mcx-live"><span class="mcx-live-dot"></span> LIVE · GAME '+Number(m.live_game||1)
    +' · <strong>'+Number(m.live_score_a||0)+' – '+Number(m.live_score_b||0)+'</strong> · GAMES '+Number(m.games_won_a||0)+'–'+Number(m.games_won_b||0)+'</div>':'';
  const completedDetails=done?'<div class="mcx-extra mcx-final"><div><span>🏆 WINNERS</span><strong>'+esc(winnerNames)+'</strong>'
    +'<b>'+Number(m.games_won_a||0)+' – '+Number(m.games_won_b||0)+'</b></div>'+completedScoreStrip(m)
    +'<small>Total points '+Number(m.points_a||0)+' – '+Number(m.points_b||0)+'</small></div>':'';
  return '<article class="matchcard mcx-card'+(reorderable?' reorderable-match':'')+(locked?' locked-match-card':'')
    +(done?' completed-match-card':'')+(live?' mcx-is-live':'')+'"'+attrs+'>'
    +'<div class="mcx-scene mcx-stadium-asset" aria-label="Pickleball stadium matchup">'
    +'<header class="mcx-header">'
    +'<div class="mcx-brand"><span class="mcx-header-rule" aria-hidden="true"></span><span class="mcx-brand-logo">TLP</span><strong>Teachers Pickleball Competition</strong><span class="mcx-header-rule" aria-hidden="true"></span></div>'
    +'<div class="mcx-fixture-meta"><div class="mcx-match-title">MATCH '+mcxDailyMatchNumber(m)+'</div>'
    +'<div class="mcx-date"><span class="mcx-date-label">▣ '+esc(dateFmt(m.scheduled_date))+'</span></div></div>'
    +'<div class="mcx-reorder">'+reorderTools(m)+'</div>'
    +'</header>'
    +mcxTeam(a,sa,'a',aWon)
    +mcxTeam(b,sb,'b',bWon)
    +'</div>'
    +liveDetails+completedDetails
    +(showFooter?'<footer class="mcx-footer">'
      +'<span class="mcx-status '+statusClass+'">'+(live?'<span class="mcx-live-dot"></span>':'')+esc(status)+'</span>'
      +(admin?'<div class="mcx-controls">'+mcxActions(m,locked,done,live)+matchManagementActions(m)+'</div>':'')
      +'</footer>':'')
    +'</article>';
}
