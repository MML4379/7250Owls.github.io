const TBA_API_KEY = 'Imp1K3Z8VHhPqSpujx5KjiR1nJhTGCL5RA6WyhAqFV1RyRVcwfxQFwezyEusYQVU';
const TEAM_KEY = 'frc7250';
const CURRENT_YEAR = new Date().getFullYear();

function showSection(sectionId) {
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(sec => sec.style.display = 'none');

    // Show targeted section
    const target = document.getElementById(sectionId);
    if (target) {
        target.style.display = 'block';
    }

    // Handle Nav Classes
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));

    // Find link that contains the sectionId in its onclick
    const activeLink = Array.from(navItems).find(link =>
        link.getAttribute('onclick').includes(sectionId)
    );
    if (activeLink) activeLink.classList.add('active');

    // Load data if switching to stats
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

        // Sort events by date
        events.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

        let html = '';
        const today = new Date();

        for (const event of events) {
            const eventStartDate = new Date(event.start_date);
            const eventEndDate = new Date(event.end_date);

            // Handle Upcoming Events
            if (eventStartDate > today) {
                html += `
                    <div class="stats-card future-card">
                        <h3 style="font-family:var(--robot-font); color:var(--neon-blue);">${event.name}</h3>
                        <p style="margin-top:10px;">📍 ${event.city}, ${event.state_prov}</p>
                        <p>📅 ${event.start_date}</p>
                        <p style="color:#888; font-size:0.8rem; margin-top:5px;">[ STATUS: UPCOMING ]</p>
                        <div class="external-links">
                            <a href="https://www.thebluealliance.com/event/${event.key}" target="_blank" class="btn-link">TheBlueAlliance</a>
                            <a href="https://www.statbotics.io/event/${event.key}" target="_blank" class="btn-link">Statbotics</a>
                        </div>
                    </div>`;
                continue;
            }

            // Fetch Match/Status Data for completed/active events
            const [statusRes, matchesRes, awardsRes] = await Promise.all([
                fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/event/${event.key}/status`, { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }),
                fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/event/${event.key}/matches`, { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }),
                fetch(`https://www.thebluealliance.com/api/v3/team/${TEAM_KEY}/event/${event.key}/awards`, { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } })
            ]);

            const status = await statusRes.json();
            const matches = await matchesRes.json();
            const awards = await awardsRes.json();

            const teamMatches = matches.filter(m =>
                m.alliances.blue.team_keys.includes(TEAM_KEY) ||
                m.alliances.red.team_keys.includes(TEAM_KEY)
            );

            let pWins = 0;
            let pLosses = 0;

            const matchRows = teamMatches
                .sort((a, b) => a.time - b.time)
                .map(m => {
                    const isBlue = m.alliances.blue.team_keys.includes(TEAM_KEY);
                    const myScore = isBlue ? m.alliances.blue.score : m.alliances.red.score;
                    const oppScore = isBlue ? m.alliances.red.score : m.alliances.blue.score;
                    const resultClass = (myScore > oppScore) ? 'win' : (myScore < oppScore ? 'loss' : '');

                    if (m.comp_level !== 'qm') {
                        if (myScore > oppScore) pWins++;
                        else if (myScore < oppScore) pLosses++;
                    }

                    let levelLabel = m.comp_level === 'qm' ? 'Quals' : 'Playoffs';
                    let numLabel = m.comp_level === 'qm' ? m.match_number : `${m.set_number}-${m.match_number}`;
                    return `<span class="match-badge ${resultClass}">${levelLabel} ${numLabel}: ${myScore}-${oppScore}</span>`;
                }).join('');

            let allianceDisplay = "Unpicked";
            if (status?.alliance?.name) {
                allianceDisplay = status.alliance.name.replace(/Alliance\s+/i, '');
            }

            let finish = "Did not advance to Playoffs";
            const pStatus = status?.playoff?.status;
            if (pStatus === 'won') finish = "1st Place (Winner)";
            else if (pStatus === 'f') finish = "2nd Place (Finalist)";
            else if (pStatus === 'sf') finish = "Semifinalist";
            else if (pStatus === 'qf') finish = "Quarterfinalist";
            else if (status?.alliance?.name && eventEndDate > today) finish = "Playoffs In Progress";

            html += `
                <div class="stats-card">
                    <h3 style="font-family:var(--robot-font); color:var(--neon-blue);">${event.name}</h3>
                    <div class="report-grid">
                        <div class="report-section">
                            <h4>QUALIFICATIONS</h4>
                            <p>Rank: <strong>${status?.qual?.ranking?.rank || 'N/A'}</strong></p>
                            <p>Quals Record: <strong>${status?.qual?.ranking?.record?.wins || 0}W-${status?.qual?.ranking?.record?.losses || 0}L</strong></p>
                        </div>
                        <div class="report-section">
                            <h4>PLAYOFFS</h4>
                            <p>Alliance: <strong>${allianceDisplay}</strong></p>
                            <p>Finish: <strong>${finish}</strong></p>
                            <p>Playoffs Record: <strong>${pWins}W-${pLosses}L</strong></p>
                        </div>
                    </div>
                    <div class="history-section">
                        <h4>MATCH HISTORY</h4>
                        <div class="match-scroll">${matchRows || 'Data pending...'}</div>
                    </div>
                    ${awards.length > 0 ? awards.map(a => `<div class="award-tag">🏆 ${a.name}</div>`).join('') : ''}
                    <div class="external-links">
                        <a href="https://www.thebluealliance.com/event/${event.key}" target="_blank" class="btn-link">TheBlueAlliance</a>
                        <a href="https://www.statbotics.io/event/${event.key}" target="_blank" class="btn-link">Statbotics</a>
                    </div>
                </div>`;
        }
        container.innerHTML = html || '<p>No data found.</p>';
    } catch (err) {
        console.error("TBA Error:", err);
        container.innerHTML = '<p style="color:red">CRITICAL: CONNECTION TO DATA HUB FAILED</p>';
    }
}