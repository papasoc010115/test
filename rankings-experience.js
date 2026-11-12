/* TLP 2026 public leaderboard experience
 * Source of truth: official rankings, participants, completed matches.
 * No rankings are calculated/reordered beyond official_rank. Read-only.
 */
function rlNum(value){
  const n=Number(value||0);
  return Number.isFinite(n)?n.toLocaleString('en-PH'):'0';
}
function rlRate(value){
  const n=Number(value||0);
  return Number.isFinite(n)?n.toFixed(1)+'%':'0.0%';
}
function rlPlayer(record){
  return participants.find(p=>p.id===record.participant_id)
    ||participants.find(p=>p.player_code===record.player_code)
    ||{id:null,display_name:record.display_name,player_code:record.player_code,profile_image_url:null};
}
function rlInitials(name){
  return String(name||'TLP').trim().split(/\s+/).slice(-2).map(s=>s.slice(0,1).toUpperCase()).join('')||'TLP';
}
function rlPhoto(player,large=false){
  const name=player?.display_name||'Player';
  const url=typeof safeProfilePhotoUrl==='function'?safeProfilePhotoUrl(player?.profile_image_url):'';
  const className=large?'rl-podium-photo':'rl-avatar';
  const fallback=large?'<div class="rl-podium-no-photo" aria-hidden="true">'
    +'<svg viewBox="0 0 130 160" focusable="false" aria-hidden="true"><circle cx="65" cy="45" r="34" fill="currentColor"/><path d="M3 160c0-48 25-72 62-72s62 24 62 72" fill="currentColor"/></svg>'
    +'<b>'+esc(rlInitials(name))+'</b></div>':'<span>'+esc(rlInitials(name))+'</span>';
  return '<div class="'+className+(url?' has-photo':'')+'">'
    +fallback
    +(url?'<img src="'+esc(url)+'" alt="Portrait of '+esc(name)+'" loading="lazy" decoding="async" onerror="this.parentNode.classList.remove(&quot;has-photo&quot;);this.remove()">':'')
    +'</div>';
}
function rlMedal(rank){
  return rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':'';
}
function rlTopCard(r,index,isFinal){
  const place=Number(r.official_rank||index+1),p=rlPlayer(r);
  const placeName=isFinal?(place===1?'CHAMPION':place===2?'RUNNER-UP':'THIRD PLACE'):(place===1?'CURRENT #1':place===2?'CURRENT #2':'CURRENT #3');
  const medal=rlMedal(place)||'🏅';
  const wins=rlNum(r.match_wins),pct=rlRate(r.win_pct),played=rlNum(r.matches_played);
  return '<article class="rl-podium-card" data-place="'+place+'" style="--rl-delay:'+(index*.12).toFixed(2)+'s" aria-label="'+placeName+': '+esc(r.display_name)+'">'
    +'<div class="rl-podium-top"><div class="rl-place"><strong>'+place+'</strong><span class="rl-place-title">'+placeName+'</span></div>'
    +'<span class="rl-champion-crown" aria-hidden="true">'+(place===1?(isFinal?'♛':'★'):medal)+'</span></div>'
    +rlPhoto(p,true)
    +'<div class="rl-podium-name"><strong title="'+esc(r.display_name)+'">'+esc(r.display_name)+'</strong>'
    +'<small>'+esc(r.player_code||p.player_code||'Player')+'</small></div>'
    +'<div class="rl-podium-stats">'
    +'<div><span>Wins</span><strong>'+wins+'</strong></div>'
    +'<div><span>Played</span><strong>'+played+'</strong></div>'
    +'<div><span>Win rate</span><strong>'+pct+'</strong></div>'
    +'</div><div class="rl-podium-plinth"></div></article>';
}
function rlRankIcon(rank){
  const medal=rlMedal(rank);
  return '<span class="rl-rank-cell'+(medal?' medal-'+rank:'')+'">'
    +'<b>#'+rank+'</b>'+(medal?'<span aria-hidden="true">'+medal+'</span>':'')+'</span>';
}
function rlTableRow(r){
  const rank=Number(r.official_rank||0),p=rlPlayer(r);
  const pct=Number(r.win_pct||0),d=Number(r.score_difference||0);
  return '<tr'+(rank<=3?' class="rl-row-highlight"':'')+'>'
    +'<td>'+rlRankIcon(rank)+'</td>'
    +'<td><div class="rl-player-cell">'+rlPhoto(p)
    +'<div class="rl-player-details"><span class="rl-player-name">'+esc(r.display_name)+'</span>'
    +'<span class="rl-player-code">'+esc(r.player_code||'')+'</span></div></div></td>'
    +'<td>'+rlNum(r.matches_played)+'</td>'
    +'<td><span class="rl-wins">'+rlNum(r.match_wins)+'</span></td>'
    +'<td>'+rlNum(r.match_losses)+'</td>'
    +'<td><span class="rl-winrate'+(pct>=60?' good':'')+'">'+rlRate(r.win_pct)+'</span></td>'
    +'<td>'+rlNum(r.h2h_score)+'</td>'
    +'<td><span class="rl-games">'+rlNum(r.games_won)+'–'+rlNum(r.games_lost)+'</span></td>'
    +'<td>'+rlNum(r.points_for)+'</td>'
    +'<td>'+rlNum(r.points_against)+'</td>'
    +'<td><span class="'+(d>=0?'rl-positive':'rl-negative')+'">'+esc(signed(d))+'</span></td></tr>';
}
function rlMobileRow(r){
  const rank=Number(r.official_rank||0),p=rlPlayer(r),pct=Number(r.win_pct||0);
  const rankStyle=rank===1?'rl-rank-gold':rank===2?'rl-rank-silver':rank===3?'rl-rank-bronze':'rl-rank-standard';
  return '<article class="rl-mobile-card" aria-label="Rank '+rank+' '+esc(r.display_name)+'">'
    +'<span class="rl-mobile-rank '+rankStyle+'"><span class="rl-mobile-rank-number">#'+rank+'</span>'
    +(rank<=3?'<span class="rl-mobile-rank-medal" aria-hidden="true">'+rlMedal(rank)+'</span>':'')
    +'</span>'+rlPhoto(p)
    +'<div class="rl-mobile-info"><strong>'+esc(r.display_name)+'</strong>'
    +'<small>'+esc(r.player_code||'')+'</small>'
    +'<div class="rl-record" aria-label="'+rlNum(r.match_wins)+' wins and '+rlNum(r.match_losses)+' losses">'
    +'<span class="rl-record-pill rl-record-win"><b>'+rlNum(r.match_wins)+'</b><span>WINS</span></span>'
    +'<span class="rl-record-pill rl-record-loss"><b>'+rlNum(r.match_losses)+'</b><span>LOSSES</span></span>'
    +'</div>'
    +'<div class="rl-mobile-stats">'
    +'<span>'+rlNum(r.matches_played)+' played</span>'
    +'<span>H2H '+rlNum(r.h2h_score)+'</span>'
    +'<span>Games '+rlNum(r.games_won)+'–'+rlNum(r.games_lost)+'</span>'
    +'<span>PF/PA '+rlNum(r.points_for)+'/'+rlNum(r.points_against)+'</span>'
    +'<span>Diff '+esc(signed(Number(r.score_difference||0)))+'</span>'
    +'</div></div>'
    +'<div class="rl-mobile-side"><b>'+rlRate(pct)+'</b><small>Win rate</small></div></article>';
}
/* Standings become final only when every active competitor has played
 * at least the required 15 completed matches. Never infer completion
 * from total tournament matches or only the current top three. */
function rlIsFinalStandings(active){
  // Check the complete participant roster, not just players appearing in the
  // rankings view. An active player with a missing standings row is incomplete.
  const roster=participants.filter(p=>p.active===true);
  if(!roster.length)return false;
  return roster.every(p=>{
    const r=active.find(row=>row.participant_id===p.id)
      ||active.find(row=>row.player_code&&row.player_code===p.player_code);
    return !!r&&Number.isFinite(Number(r.matches_played))
      &&Number(r.matches_played)>=15;
  });
}
function rlSetText(id,value){
  const el=document.getElementById(id);if(el)el.textContent=value;
}
function renderRankingExperience(){
  const podium=document.getElementById('rankingPodium'),body=document.getElementById('rankingsBody');
  if(!podium||!body)return;
  // Retain the database's official ordering but remove excluded players
  // from every presentation surface. Re-number visible positions 1..N
  // without mutating the source rankings or historical statistics.
  const allActive=rankings.filter(r=>r.active===true);
  const active=allActive.filter(r=>{
    const p=rlPlayer(r);
    return p.exclude_from_rankings!==true;
  }).slice().sort((a,b)=>Number(a.official_rank||999)-Number(b.official_rank||999)
    ||String(a.display_name||'').localeCompare(String(b.display_name||'')))
    .map((r,index)=>({...r,official_rank:index+1}));
  const top3=active.slice(0,3);
  // Finalization remains based on the full active player roster, including
  // excluded players who must still complete their required matches.
  const isFinal=rlIsFinalStandings(allActive);
  rlSetText('rankingMainTitle',isFinal?'Official Final Rankings':'Current Competition Rankings');
  rlSetText('rankingProgressLabel',isFinal?'Competition Complete · Final Standings':'Standings in Progress');
  rlSetText('rankingTopThreeTitle',isFinal?'Top 3 Champions':'Current Top 3 Players');
  rlSetText('rankingTopThreeDescription',isFinal
    ?'Final champions based on completed competition results'
    :'Current leaders based on completed competition matches');
  rlSetText('rankingStandingsStatus',isFinal?'Official final standings':'Provisional standings');
  const notice=document.getElementById('rankingProvisionalNotice');
  if(notice)notice.hidden=isFinal;
  const hero=document.querySelector('#rankings .ranking-hero');
  if(hero)hero.classList.toggle('ranking-final',isFinal);
  // Podium is always the official top three, even when the search field is used.
  // Search applies to the detailed leaderboard beneath the podium only.
  const podiumSignature=(isFinal?'final:':'provisional:')+top3.map(r=>[r.participant_id,r.official_rank,r.match_wins,r.matches_played,r.win_pct,rlPlayer(r).profile_image_url].join('|')).join('~');
  if(podium.dataset.signature!==podiumSignature){
    podium.innerHTML=top3.length?top3.map((r,i)=>rlTopCard(r,i,isFinal)).join('')
      :'<div class="rl-podium-empty">Ranking results will appear when official standings are available.</div>';
    podium.dataset.signature=podiumSignature;
  }
  const activeCount=document.getElementById('rlActiveCount');
  const finishedCount=document.getElementById('rlFinishedCount');
  const leaderName=document.getElementById('rlLeaderName');
  const allCount=document.getElementById('rlAllCount');
  if(activeCount)activeCount.textContent=rlNum(active.length);
  if(finishedCount)finishedCount.textContent=rlNum(matches.filter(m=>m.status==='COMPLETED').length);
  if(leaderName)leaderName.textContent=top3[0]?.display_name||'—';
  if(allCount)allCount.textContent=active.length+' players ranked';
  const q=(document.getElementById('rankingSearch')?.value||'').trim().toLowerCase();
  const selected=active.filter(r=>(String(r.display_name||'')+' '+String(r.player_code||'')).toLowerCase().includes(q));
  body.innerHTML=selected.length?selected.map(rlTableRow).join('')
    :'<tr><td colspan="11" class="rl-empty">No players match this search.</td></tr>';
  const cards=document.getElementById('rankingMobileCards');
  if(cards)cards.innerHTML=selected.length?selected.map(rlMobileRow).join('')
    :'<div class="rl-empty">No players match this search.</div>';
}
