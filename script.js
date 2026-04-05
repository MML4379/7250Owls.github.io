const TBA_API_KEY = 'Imp1K3Z8VHhPqSpujx5KjiR1nJhTGCL5RA6WyhAqFV1RyRVcwfxQFwezyEusYQVU';
const TEAM_KEY = 'frc7250';
const CURRENT_YEAR = new Date().getFullYear();
const YEARS_TO_SHOW = CURRENT_YEAR - 2018 + 1;
let statsCache = {};

function toggleMatches(btn) {
    const container = btn.closest('.report-section').querySelector('.matches-container');
    if (container.style.display === 'none') {
        container.style.display = 'block';
        btn.textContent = '▲';
    } else {
        container.style.display = 'none';
        btn.textContent = '▼';
    }
}

function initMarquee() {
    const content = document.getElementById('marquee-content');
    if (!content) return;
    const style = getComputedStyle(content);
    const gap = parseInt(style.gap) || 0;
    const originalHTML = content.innerHTML;
    content.innerHTML += originalHTML;
    window.addEventListener('load', () => {
        const singleSetWidth = (content.scrollWidth + gap) / 2;
        content.style.setProperty('--scroll-distance', `-${singleSetWidth}px`);
        content.style.animation = "navScroll 30s linear infinite";
    });
}

function showSection(sectionId) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(sec => sec.style.display = 'none');
    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    const activeLink = Array.from(navItems).find(link => {
        const onclick = link.getAttribute('onclick');
        return onclick && onclick.includes(sectionId);
    });
    if (activeLink) activeLink.classList.add('active');
    if (sectionId === 'stats') { fetchTeamStats(); }
    if (sectionId === 'live') { fetchLiveStream(); }
    window.scrollTo(0, 0);
}

function switchYear(year) {
    const tabsContainer = document.getElementById('year-tabs');
    const tabs = tabsContainer.querySelectorAll('.year-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');

    const container = document.getElementById('stats-container');
    if (statsCache[year]) {
        container.innerHTML = statsCache[year];
    } else {
        container.innerHTML = '<p>LOADING YEAR DATA...</p>';
    }
}

async function fetchTeamStats() {
    const container = document.getElementById('stats-container');
    if (!container) return;
    container.innerHTML = '<p>RECALLING MISSION ARCHIVES...</p>';

    try {
        // Create tabs for years
        const yearsArray = Array.from({ length: YEARS_TO_SHOW }, (_, i) => CURRENT_YEAR - i);
        const tabsHTML = yearsArray.map((year, idx) =>
            `<button class="year-tab${idx === 0 ? ' active' : ''}" onclick="switchYear(${year})">${year}</button>`
        ).join('');
        document.getElementById('year-tabs').innerHTML = tabsHTML;

        // Fetch data for all years
        for (const year of yearsArray) {
            if (statsCache[year]) continue; // Skip if already cached

            const eventsRes = await fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/events/${year}`, {
                headers: { 'X-TBA-Auth-Key': TBA_API_KEY }
            });
            const events = await eventsRes.json();
            events.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

            let html = '';
            const today = new Date();

            for (const event of events) {
                const eventStartDate = new Date(event.start_date);
                if (eventStartDate > today) {
                    html += `
                        <div class="stats-card">
                            <h3 style="font-family:var(--robot-font); color:var(--neon-blue);">${event.name}</h3>
                            <p style="margin-top:10px;">📍 ${event.city}, ${event.state_prov}</p>
                            <p>📅 ${event.start_date} [UPCOMING]</p>
                            <div class="external-links">
                                <a href="https://www.thebluealliance.com/event/${event.key}" target="_blank" class="btn-link">TBA</a>
                                <a href="https://www.statbotics.io/event/${event.key}" target="_blank" class="btn-link">Statbotics</a>
                            </div>
                        </div>`;
                    continue;
                }

                const [statusRes, matchesRes, awardsRes] = await Promise.all([
                    fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/event/${event.key}/status`, { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }),
                    fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/event/${event.key}/matches`, { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }),
                    fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/event/${event.key}/awards`, { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } })
                ]);

                const status = await statusRes.json();
                const matches = await matchesRes.json();
                const awards = await awardsRes.json();

                const teamMatches = matches.filter(m => m.alliances.blue.team_keys.includes(TEAM_KEY) || m.alliances.red.team_keys.includes(TEAM_KEY));
                const sortedMatches = teamMatches.sort((a, b) => a.time - b.time);

                const qualMatches = sortedMatches.filter(m => m.comp_level === 'qm').map(m => {
                    const isBlue = m.alliances.blue.team_keys.includes(TEAM_KEY);
                    const alliance = isBlue ? 'BLUE' : 'RED';
                    const myScore = isBlue ? m.alliances.blue.score : m.alliances.red.score;
                    const oppScore = isBlue ? m.alliances.red.score : m.alliances.blue.score;
                    const resultClass = (myScore > oppScore) ? 'win' : (myScore < oppScore ? 'loss' : '');
                    const videoLink = m.videos && m.videos.length > 0 ? `<a href="https://www.youtube.com/watch?v=${m.videos[0].key}" target="_blank" class="video-link">▶</a>` : '';
                    return `<div class="match-card-wrapper"><span class="match-badge ${resultClass}">Q${m.match_number}<br>[${alliance}]<br>${myScore}-${oppScore}</span>${videoLink}</div>`;
                }).join('');

                const playoffMatches = sortedMatches.filter(m => m.comp_level !== 'qm').map(m => {
                    const isBlue = m.alliances.blue.team_keys.includes(TEAM_KEY);
                    const alliance = isBlue ? 'BLUE' : 'RED';
                    const myScore = isBlue ? m.alliances.blue.score : m.alliances.red.score;
                    const oppScore = isBlue ? m.alliances.red.score : m.alliances.blue.score;
                    const resultClass = (myScore > oppScore) ? 'win' : (myScore < oppScore ? 'loss' : '');
                    let level = m.comp_level.toUpperCase();
                    let displayNum = `${m.set_number}-${m.match_number}`;
                    const videoLink = m.videos && m.videos.length > 0 ? `<a href="https://www.youtube.com/watch?v=${m.videos[0].key}" target="_blank" class="video-link">▶</a>` : '';
                    return `<div class="match-card-wrapper"><span class="match-badge ${resultClass}">${level}${displayNum}<br>[${alliance}]<br>${myScore}-${oppScore}</span>${videoLink}</div>`;
                }).join('');

                let finish = "Qualifications";
                let playoffRecord = "0W-0L";
                if (status?.playoff) {
                    const wins = status.playoff.record?.wins || 0;
                    const losses = status.playoff.record?.losses || 0;
                    playoffRecord = `${wins}W-${losses}L`;
                    if (status.playoff.status === 'won') finish = "Event Winners";
                    else if (status.playoff.level === 'f') finish = "Finalists";
                    else if (status.playoff.level === 'sf') finish = "Semifinalists";
                    else if (status.playoff.level === 'qf') finish = "Quarterfinalists";
                }

                const awardTags = awards.map(a => `<div class="award-tag">🏆 ${a.name}</div>`).join('');

                html += `
                    <div class="stats-card">
                        <h3 style="font-family:var(--robot-font); color:var(--neon-blue);">${event.name}</h3>
                        <div class="report-grid">
                            <div class="report-section">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <h4>QUALIFICATIONS</h4>
                                    ${qualMatches ? `<button class="toggle-btn" onclick="toggleMatches(this)">▼</button>` : ''}
                                </div>
                                <p>Rank: <strong>${status?.qual?.ranking?.rank || 'N/A'}</strong></p>
                                <p>Record: <strong>${status?.qual?.ranking?.record?.wins || 0}W-${status?.qual?.ranking?.record?.losses || 0}L</strong></p>
                                ${qualMatches ? `<div class="matches-container" style="display: none; margin-top: 10px;"><div class="match-scroll">${qualMatches}</div></div>` : ''}
                            </div>
                            <div class="report-section">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <h4>PLAYOFFS</h4>
                                    ${playoffMatches ? `<button class="toggle-btn" onclick="toggleMatches(this)">▼</button>` : ''}
                                </div>
                                <p>Finish: <strong>${finish}</strong></p>
                                <p>Record: <strong>${playoffRecord}</strong></p>
                                ${playoffMatches ? `<div class="matches-container" style="display: none; margin-top: 10px;"><div class="match-scroll">${playoffMatches}</div></div>` : ''}
                            </div>
                        </div>
                        <div class="awards-container">${awardTags}</div>
                        <div class="external-links">
                            <a href="https://www.thebluealliance.com/event/${event.key}" target="_blank" class="btn-link">TBA</a>
                            <a href="https://www.statbotics.io/event/${event.key}" target="_blank" class="btn-link">Statbotics</a>
                        </div>
                    </div>`;
            }
            statsCache[year] = html;
        }

        // Display current year data
        container.innerHTML = statsCache[CURRENT_YEAR];
    } catch (err) {
        container.innerHTML = '<p style="color:red">CONNECTION ERROR</p>';
    }
}
async function fetchLiveStream() {
    const container = document.getElementById('live-container');
    if (!container) return;
    container.innerHTML = '<p>SCANNING FOR ACTIVE MATCHES...</p>';

    try {
        const today = new Date().toISOString().split('T')[0]; // "2026-04-05"

        const eventsRes = await fetch(
            `https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/events/${CURRENT_YEAR}`,
            { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }
        );
        const events = await eventsRes.json();

        const active = events.find(e => e.start_date <= today && e.end_date >= today);

        if (!active) {
            container.innerHTML = `
                <div class="stats-card">
                    <h3 style="font-family:var(--robot-font); color:var(--neon-blue);">NO ACTIVE EVENT</h3>
                    <p style="margin-top:10px;">Team 7250 is not at a competition today.</p>
                </div>`;
            return;
        }

        const webcasts = active.webcasts || [];

        if (webcasts.length === 0) {
            container.innerHTML = `
                <div class="stats-card">
                    <h3 style="font-family:var(--robot-font); color:var(--neon-blue);">${active.name}</h3>
                    <p style="margin-top:10px;">🔴 Event is live but no stream link is registered on TBA yet.</p>
                    <div class="external-links">
                        <a href="https://www.thebluealliance.com/event/${active.key}" target="_blank" class="btn-link">TBA</a>
                    </div>
                </div>`;
            return;
        }

        const { type, channel } = webcasts[0];
        let src = null;
        if (type === 'twitch')
            src = `https://player.twitch.tv/?channel=${channel}&parent=${location.hostname}`;
        else if (type === 'youtube')
            src = `https://www.youtube.com/embed/live_stream?channel=${channel}`;
        else if (type === 'youtube_video')
            src = `https://www.youtube.com/embed/${channel}`;

        if (!src) {
            container.innerHTML = `
                <div class="stats-card">
                    <h3 style="font-family:var(--robot-font); color:var(--neon-blue);">${active.name}</h3>
                    <p style="margin-top:10px;">Stream type <strong>${type}</strong> isn't embeddable. Watch on TBA:</p>
                    <div class="external-links">
                        <a href="https://www.thebluealliance.com/event/${active.key}" target="_blank" class="btn-link">TBA</a>
                    </div>
                </div>`;
            return;
        }

        // Fetch next match time
        const matchesRes = await fetch(
            `https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/event/${active.key}/matches`,
            { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }
        );
        const matches = await matchesRes.json();

        const now = Math.floor(Date.now() / 1000);
        const upcoming = matches
            .filter(m => (m.predicted_time || m.scheduled_time) && m.actual_time == null)
            .map(m => ({ ...m, _countdown_time: m.predicted_time || m.scheduled_time }))
            .filter(m => m._countdown_time > now)
            .sort((a, b) => a._countdown_time - b._countdown_time)[0];

        let timerHTML = '';
        if (upcoming) {
            const levelLabel = upcoming.comp_level === 'qm'
                ? `Qual ${upcoming.match_number}`
                : `${upcoming.comp_level.toUpperCase()} ${upcoming.set_number}-${upcoming.match_number}`;
            const isBlue = upcoming.alliances.blue.team_keys.includes(TEAM_KEY);
            const allianceColor = isBlue ? 'var(--neon-blue)' : '#ff4444';
            const allianceLabel = isBlue ? 'BLUE' : 'RED';

            timerHTML = `
                <div class="stats-card" style="text-align:center; margin:0 auto 16px; max-width:900px;">
                    <h3 style="font-family:var(--robot-font); color:var(--neon-blue);">NEXT MATCH</h3>
                    <p style="margin:6px 0;">${levelLabel} — <span style="color:${allianceColor}; font-weight:bold;">${allianceLabel} ALLIANCE</span></p>
                    <div id="match-countdown" style="font-family:var(--robot-font); font-size:2rem; color:var(--neon-blue); margin-top:8px;">--:--</div>
                </div>`;
        }

        container.innerHTML = `
            ${timerHTML}
            <div class="stats-card" style="width:100%; max-width:900px; margin:0 auto;">
                <h3 style="font-family:var(--robot-font); color:var(--neon-blue);">🔴 LIVE — ${active.name}</h3>
                <p style="margin-bottom:12px;">📍 ${active.city}, ${active.state_prov}</p>
                <div style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden; border-radius:8px;">
                    <iframe
                        src="${src}"
                        style="position:absolute; top:0; left:0; width:100%; height:100%;"
                        allowfullscreen
                        frameborder="0">
                    </iframe>
                </div>
                <div class="external-links" style="margin-top:12px;">
                    <a href="https://www.thebluealliance.com/event/${active.key}" target="_blank" class="btn-link">TBA</a>
                    <a href="https://www.statbotics.io/event/${active.key}" target="_blank" class="btn-link">Statbotics</a>
                </div>
            </div>`;

        // Start countdown if there's an upcoming match
        if (upcoming) {
            if (window._countdownInterval) clearInterval(window._countdownInterval);
            window._countdownInterval = setInterval(() => {
                const el = document.getElementById('match-countdown');
                if (!el) { clearInterval(window._countdownInterval); return; }
                const secsLeft = upcoming._countdown_time - Math.floor(Date.now() / 1000);
                if (secsLeft <= 0) {
                    el.textContent = 'QUEUING NOW';
                    clearInterval(window._countdownInterval);
                    return;
                }
                const h = Math.floor(secsLeft / 3600);
                const m = Math.floor((secsLeft % 3600) / 60);
                const s = secsLeft % 60;
                el.textContent = h > 0
                    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
                    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            }, 1000);
        }
    } catch (err) {
        container.innerHTML = '<p style="color:red">CONNECTION ERROR</p>';
    }
}
async function checkForActiveEvent() {
    const navLink = document.querySelector('.nav-item[onclick*="live"]');
    if (!navLink) return; // bail safely if the nav item doesn't exist
    const liveNavItem = navLink.parentElement;
    liveNavItem.innerHTML = '<a href="#" class="nav-item" onclick="showSection(\'live\')">🔴LIVE</a>';

    try {
        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(
            `https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/events/${CURRENT_YEAR}/simple`,
            { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }
        );
        const events = await res.json();
        const active = events.find(e => e.start_date <= today && e.end_date >= today);
        if (active) liveNavItem.innerHTML = '<a href="#" class="nav-item" onclick="showSection(\'live\')">🟢LIVE</a>';
    } catch (err) {
        // silently fail — nav item stays hidden
    }
}
async function prefetchCurrentYear() {
    if (statsCache[CURRENT_YEAR]) return;

    try {
        const eventsRes = await fetch(
            `https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/events/${CURRENT_YEAR}`,
            { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }
        );
        const events = await eventsRes.json();
        events.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

        const today = new Date();
        let html = '';

        for (const event of events) {
            const eventStartDate = new Date(event.start_date);
            if (eventStartDate > today) {
                html += `
                    <div class="stats-card">
                        <h3 style="font-family:var(--robot-font); color:var(--neon-blue);">${event.name}</h3>
                        <p style="margin-top:10px;">📍 ${event.city}, ${event.state_prov}</p>
                        <p>📅 ${event.start_date} [UPCOMING]</p>
                        <div class="external-links">
                            <a href="https://www.thebluealliance.com/event/${event.key}" target="_blank" class="btn-link">TBA</a>
                            <a href="https://www.statbotics.io/event/${event.key}" target="_blank" class="btn-link">Statbotics</a>
                        </div>
                    </div>`;
                continue;
            }

            const [statusRes, matchesRes, awardsRes] = await Promise.all([
                fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/event/${event.key}/status`, { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }),
                fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/event/${event.key}/matches`, { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }),
                fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/event/${event.key}/awards`, { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } })
            ]);

            const status = await statusRes.json();
            const matches = await matchesRes.json();
            const awards = await awardsRes.json();

            const teamMatches = matches.filter(m => m.alliances.blue.team_keys.includes(TEAM_KEY) || m.alliances.red.team_keys.includes(TEAM_KEY));
            const sortedMatches = teamMatches.sort((a, b) => a.time - b.time);

            const qualMatches = sortedMatches.filter(m => m.comp_level === 'qm').map(m => {
                const isBlue = m.alliances.blue.team_keys.includes(TEAM_KEY);
                const alliance = isBlue ? 'BLUE' : 'RED';
                const myScore = isBlue ? m.alliances.blue.score : m.alliances.red.score;
                const oppScore = isBlue ? m.alliances.red.score : m.alliances.blue.score;
                const resultClass = (myScore > oppScore) ? 'win' : (myScore < oppScore ? 'loss' : '');
                const videoLink = m.videos && m.videos.length > 0 ? `<a href="https://www.youtube.com/watch?v=${m.videos[0].key}" target="_blank" class="video-link">▶</a>` : '';
                return `<div class="match-card-wrapper"><span class="match-badge ${resultClass}">Q${m.match_number}<br>[${alliance}]<br>${myScore}-${oppScore}</span>${videoLink}</div>`;
            }).join('');

            const playoffMatches = sortedMatches.filter(m => m.comp_level !== 'qm').map(m => {
                const isBlue = m.alliances.blue.team_keys.includes(TEAM_KEY);
                const alliance = isBlue ? 'BLUE' : 'RED';
                const myScore = isBlue ? m.alliances.blue.score : m.alliances.red.score;
                const oppScore = isBlue ? m.alliances.red.score : m.alliances.blue.score;
                const resultClass = (myScore > oppScore) ? 'win' : (myScore < oppScore ? 'loss' : '');
                const level = m.comp_level.toUpperCase();
                const displayNum = `${m.set_number}-${m.match_number}`;
                const videoLink = m.videos && m.videos.length > 0 ? `<a href="https://www.youtube.com/watch?v=${m.videos[0].key}" target="_blank" class="video-link">▶</a>` : '';
                return `<div class="match-card-wrapper"><span class="match-badge ${resultClass}">${level}${displayNum}<br>[${alliance}]<br>${myScore}-${oppScore}</span>${videoLink}</div>`;
            }).join('');

            let finish = "Qualifications";
            let playoffRecord = "0W-0L";
            if (status?.playoff) {
                const wins = status.playoff.record?.wins || 0;
                const losses = status.playoff.record?.losses || 0;
                playoffRecord = `${wins}W-${losses}L`;
                if (status.playoff.status === 'won') finish = "Event Winners";
                else if (status.playoff.level === 'f') finish = "Finalists";
                else if (status.playoff.level === 'sf') finish = "Semifinalists";
                else if (status.playoff.level === 'qf') finish = "Quarterfinalists";
            }

            const awardTags = awards.map(a => `<div class="award-tag">🏆 ${a.name}</div>`).join('');

            html += `
                <div class="stats-card">
                    <h3 style="font-family:var(--robot-font); color:var(--neon-blue);">${event.name}</h3>
                    <div class="report-grid">
                        <div class="report-section">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h4>QUALIFICATIONS</h4>
                                ${qualMatches ? `<button class="toggle-btn" onclick="toggleMatches(this)">▼</button>` : ''}
                            </div>
                            <p>Rank: <strong>${status?.qual?.ranking?.rank || 'N/A'}</strong></p>
                            <p>Record: <strong>${status?.qual?.ranking?.record?.wins || 0}W-${status?.qual?.ranking?.record?.losses || 0}L</strong></p>
                            ${qualMatches ? `<div class="matches-container" style="display: none; margin-top: 10px;"><div class="match-scroll">${qualMatches}</div></div>` : ''}
                        </div>
                        <div class="report-section">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <h4>PLAYOFFS</h4>
                                ${playoffMatches ? `<button class="toggle-btn" onclick="toggleMatches(this)">▼</button>` : ''}
                            </div>
                            <p>Finish: <strong>${finish}</strong></p>
                            <p>Record: <strong>${playoffRecord}</strong></p>
                            ${playoffMatches ? `<div class="matches-container" style="display: none; margin-top: 10px;"><div class="match-scroll">${playoffMatches}</div></div>` : ''}
                        </div>
                    </div>
                    <div class="awards-container">${awardTags}</div>
                    <div class="external-links">
                        <a href="https://www.thebluealliance.com/event/${event.key}" target="_blank" class="btn-link">TBA</a>
                        <a href="https://www.statbotics.io/event/${event.key}" target="_blank" class="btn-link">Statbotics</a>
                    </div>
                </div>`;
        }

        statsCache[CURRENT_YEAR] = html;

    } catch (err) {
        // silently fail — fetchTeamStats will handle errors when user clicks EVENTS
    }
}
initMarquee();
checkForActiveEvent();
prefetchCurrentYear();