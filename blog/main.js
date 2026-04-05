const { createClient } = supabase;

const supabaseUrl = 'https://qqcnhbuaksnqjortphby.supabase.co';
const supabaseKey = 'sb_publishable_hI2uQ7m1io4l_ioAbi1SyA_EU7GgAwl';

const _supabase = createClient(supabaseUrl, supabaseKey);
const postlength = 100;
const alert = document.getElementById('alert');

async function fetchData() {
    try {
        const page = window.location.hash.substring(1);
        let data, error;
        let indexPage;

        if (!page) {
            ({ data, error } = await _supabase
                .from('bloginfo')
                .select('*')
            );
            indexPage = true;
        }
        else {
            ({ data, error } = await _supabase
                .from('bloginfo')
                .select('*')
                .eq('blogPath', page)
            );
            indexPage = false;
        }

        if (error) throw error;

        console.log("Success! Data:", data);
        const container = document.getElementById('container')

        if (data.length === 0) {
            container.innerHTML = "<p>No blog posts found. Please reload, or try later.</p>";
        } else {
            const html = data.toReversed().map(row => {
                const genreIcons = {
                    'Mechanical': '⚙️',
                    'Electrical': '⚡',
                    'Programming': '💻',
                    'Business': '📊',
                    'Community': '🤝',
                    'Competition': '🏆',
                    'Other': '📝'
                };
                const post = row.blogData;
                let postdata = post.Post;
                if (indexPage) {
                    const lineBreak = postdata.indexOf('\n');
                    if (lineBreak !== -1) {
                        postdata = postdata.substring(0, lineBreak) + '...';
                    } else if (postdata.length > postlength) {
                        postdata = postdata.substring(0, postlength) + '...';
                    }
                }
                const initDate = new Date(row.created_at);
                const genre = row.genre || 'Uncategorized';
                const icon = genreIcons[genre] || '📝';

                return `
                <div class="post-card">
                    <a href="${'index.html#' + (row.blogPath || 'index.html')}" class="post-title">${post.PostName || 'Untitled'}</a>
                    <div class="author-date">
                        <p>Author: ${post.Author || 'Unknown'}</p>
                        <p>${initDate || 'Unknown'}</p>
                    </div>
                    <p class="post-genre"><span class="genre-icon">${icon}</span> ${genre}</p>
                    ${renderContent(post, indexPage)}
                </div>
                `;
            }).join('');
            container.innerHTML = html;
        }
    } catch (err) {
        console.error("The REAL error is:", err.message);
        document.getElementById('container').innerHTML = `Error: ${err.message}`;
    }
}


async function updateAuthButton() {
    const { data: { user } } = await _supabase.auth.getUser();
    const logoutBtn = document.getElementById('signout');
    if (user) {
        logoutBtn.textContent = 'SIGN OUT';
        logoutBtn.onclick = logout;
    } else {
        logoutBtn.textContent = 'SIGN IN';
        logoutBtn.onclick = () => { window.location.hash = '#login'; };
    }
}

window.addEventListener('hashchange', async () => {
    const hash = window.location.hash;

    await updateAuthButton();

    if (hash === '#upload') {
        const { data: { user } } = await _supabase.auth.getUser();

        if (!user) {
            alertPopups("You must be logged in to upload a blog post.");
            window.location.hash = "#login";
            return;
        }

        import('./uploadPage.js').then(module => {
            module.pageLoad(_supabase);
        });
    } else if (hash === '#login') {
        import('./loginpage.js').then(module => {
            module.pageLoad(_supabase);
        });
    } else {
        fetchData();
    }
});


document.addEventListener('DOMContentLoaded', async () => {
    await updateAuthButton();

    const hash = window.location.hash;

    if (hash === '#upload') {
        const { data: { user } } = await _supabase.auth.getUser();
        if (!user) {
            window.location.hash = "#login";
            return;
        }
        import('./uploadPage.js').then(module => {
            module.pageLoad(_supabase);
        });
    } else if (hash === '#login') {
        import('./loginpage.js').then(module => {
            module.pageLoad(_supabase);
        });
    } else {
        fetchData();
    }
});
async function logout() {
    const { error } = await _supabase.auth.signOut();
    if (error) {
        alertPopups(`Error logging out: ${error.message}`);
    } else {
        alertPopups("Logged out successfully!");
        window.location.hash = "";
        location.reload();
    }
}

export async function alertPopups(message) {
    alert.innerHTML = `
    <div class="popup">
        <span class="closebtn" onclick="this.parentElement.parentElement.style.display='none';">&times;</span>
        <p class="popup-message">${message}</p>
    </div>
    `;
    alert.style.display = "block";
}

function renderContent(post, indexPage) {
    let content = post.Post || '';

    if (indexPage) {
        const textOnly = content
            .replace(/<img[^>]*>/g, '')
            .replace(/<[^>]+>/g, '');

        const preview = textOnly.split('\n')[0].substring(0, 120);
        return `<p class="post-content">${preview}...</p>`;
    }

    let html = `<div class="post-content">${content}</div>`;
    html += `<div class="image-layer">`;

    (post.Images || []).forEach(img => {
        html += `
            <div class="image-wrapper" style="left:${img.x}; top:${img.y};">
                <img src="${img.src}" style="width:${img.width};">
            </div>
        `;
    });

    html += `</div>`;

    return html;
}
