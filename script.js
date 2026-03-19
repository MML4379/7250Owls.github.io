const TBA_API_KEY = 'Imp1K3Z8VHhPqSpujx5KjiR1nJhTGCL5RA6WyhAqFV1RyRVcwfxQFwezyEusYQVU';
const TEAM_KEY = 'frc7250';
const CURRENT_YEAR = new Date().getFullYear();

function showSection(sectionId) {
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(sec => sec.style.display = 'none');

    const target = document.getElementById(sectionId);
    if (target) target.style.display = 'block';

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));

    const activeLink = Array.from(navItems).find(link => link.getAttribute('onclick').includes(sectionId));
    if (activeLink) activeLink.classList.add('active');

    if (sectionId === 'stats') {
        fetchTeamStats();
    }
}

async function fetchTeamStats() {
    const container = document.getElementById('stats-container');
    if (!container) return;
    container.innerHTML = '<p>RECALLING MISSION ARCHIVES...</p>';

    try {
        const eventsRes = await fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/events/${CURRENT_YEAR}`, {
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
                            <a href="https://www.thebluealliance.com/event/${event.key}" target="_blank" class="btn-link">TheBlueAlliance</a>
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

            const matchRows = teamMatches
                .sort((a, b) => a.time - b.time)
                .map(m => {
                    const isBlue = m.alliances.blue.team_keys.includes(TEAM_KEY);
                    const myScore = isBlue ? m.alliances.blue.score : m.alliances.red.score;
                    const oppScore = isBlue ? m.alliances.red.score : m.alliances.blue.score;
                    const resultClass = (myScore > oppScore) ? 'win' : (myScore < oppScore ? 'loss' : '');

                    let level = m.comp_level.toUpperCase();
                    // Playoff matches show as SF1-1, QF2-1, etc. Quals show as Q1, Q2.
                    let displayNum = (level !== 'QM') ? `${m.set_number}-${m.match_number}` : m.match_number;
                    let levelLabel = level === 'QM' ? 'Q' : level;

                    return `<span class="match-badge ${resultClass}">${levelLabel}${displayNum}: ${myScore}-${oppScore}</span>`;
                }).join('');

            let finish = "Qualifications Only";
            let playoffRecord = "0W-0L";

            if (status?.playoff) {
                const pStatus = status.playoff.status;
                const pLevel = status.playoff.level;
                const pWins = status.playoff.record?.wins || 0;
                const pLosses = status.playoff.record?.losses || 0;
                playoffRecord = `${pWins}W-${pLosses}L`;

                if (pStatus === 'won') finish = "Event Winners";
                else if (pLevel === 'f') finish = "Finalists";
                else if (pLevel === 'sf') finish = "Semifinalists";
                else if (pLevel === 'qf') finish = "Quarterfinalists";
                else finish = "Eliminated";
            }

            let allianceDisplay = status?.alliance?.name ? status.alliance.name.replace(/Alliance\s+/i, '#') : "Unpicked";

            html += `
                <div class="stats-card">
                    <h3 style="font-family:var(--robot-font); color:var(--neon-blue);">${event.name}</h3>
                    <div class="report-grid">
                        <div class="report-section">
                            <h4>QUALIFICATIONS</h4>
                            <p>Rank: <strong>${status?.qual?.ranking?.rank || 'N/A'}</strong></p>
                            <p>Record: <strong>${status?.qual?.ranking?.record?.wins || 0}W-${status?.qual?.ranking?.record?.losses || 0}L</strong></p>
                        </div>
                        <div class="report-section">
                            <h4>PLAYOFFS</h4>
                            <p>Alliance: <strong>${allianceDisplay}</strong></p>
                            <p>Finish: <strong>${finish} (${playoffRecord})</strong></p>
                        </div>
                    </div>
                    <div class="match-scroll">${matchRows || 'No match data...'}</div>
                    ${awards.length > 0 ? awards.map(a => `<div class="award-tag">🏆 ${a.name}</div>`).join('') : ''}
                    <div class="external-links">
                        <a href="https://www.thebluealliance.com/event/${event.key}" target="_blank" class="btn-link">TheBlueAlliance</a>
                        <a href="https://www.statbotics.io/event/${event.key}" target="_blank" class="btn-link">Statbotics</a>
                    </div>
                </div>`;
        }
        container.innerHTML = html || '<p>No mission logs found.</p>';
    } catch (err) {
        container.innerHTML = '<p style="color:red">CONNECTION ERROR</p>';
    }
}