import { alertPopups } from './main.js';

let imageCount = 0;

// Compress image
async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxWidth = 1200;
                const scale = Math.min(1, maxWidth / img.width);

                canvas.width = img.width * scale;
                canvas.height = img.height * scale;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                canvas.toBlob((blob) => resolve(blob), 'image/webp', 0.8);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Hash
async function hashFile(blob) {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function pageLoad(supabase) {
    const container = document.getElementById('container');

    container.innerHTML = `
    <form class="upload-container" id="upload-form">
        <input type="text" id="blogPath" placeholder="Blog Path">
        <input type="text" id="blogTitle" placeholder="Blog Title">

        <select id="blogGenre">
            <option value="" disabled selected>Select Genre</option>
            <option value="Mechanical">Mechanical</option>
            <option value="Electrical">Electrical</option>
            <option value="Programming">Programming</option>
            <option value="Business">Business</option>
            <option value="Community">Community</option>
            <option value="Competition">Competition</option>
            <option value="Other">Other</option>
        </select>

        <div class="editor-toolbar">
            <div class="toolbar-group">
                <select id="font-size-select" title="Font size">
                    <option value="" disabled selected>Size</option>
                    <option value="12px">12</option>
                    <option value="14px">14</option>
                    <option value="16px">16</option>
                    <option value="20px">20</option>
                    <option value="24px">24</option>
                    <option value="32px">32</option>
                    <option value="48px">48</option>
                </select>
            </div>

            <div class="toolbar-divider"></div>

            <div class="toolbar-group">
                <button type="button" class="toolbar-btn" id="bold-btn" title="Bold"><b>B</b></button>
                <button type="button" class="toolbar-btn" id="italic-btn" title="Italic"><i>I</i></button>
                <button type="button" class="toolbar-btn" id="underline-btn" title="Underline"><u>U</u></button>
            </div>

            <div class="toolbar-divider"></div>

            <div class="toolbar-group">
                <button type="button" class="toolbar-btn" id="align-left-btn" title="Align left">&#8676;</button>
                <button type="button" class="toolbar-btn" id="align-center-btn" title="Align center">&#8578;</button>
                <button type="button" class="toolbar-btn" id="align-right-btn" title="Align right">&#8677;</button>
            </div>

            <div class="toolbar-divider"></div>

            <div class="toolbar-group">
                <button type="button" class="toolbar-btn" id="add-image-btn" title="Insert image">🖼</button>
            </div>
        </div>

        <div id="editor-container" style="position: relative;">
            <div id="editor" class="editor" contenteditable="true"></div>
            <div id="image-layer" class="image-layer"></div>
        </div>

        <button type="submit">Submit</button>
    </form>
    `;
    const imageLayer = document.getElementById('image-layer');
    const editor = document.getElementById('editor');

    // Prevent toolbar buttons from stealing focus
    document.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
    });

    // Font size
    document.getElementById('font-size-select').addEventListener('change', (e) => {
        const size = e.target.value;
        const selection = window.getSelection();

        if (!selection.rangeCount || selection.isCollapsed) {
            document.execCommand('styleWithCSS', false, true);
            document.execCommand('fontSize', false, '7');
            const fontEls = editor.querySelectorAll('font[size="7"]');
            fontEls.forEach(el => {
                const span = document.createElement('span');
                span.style.fontSize = size;
                span.innerHTML = el.innerHTML;
                el.replaceWith(span);
            });
        } else {
            const range = selection.getRangeAt(0);
            const span = document.createElement('span');
            span.style.fontSize = size;
            range.surroundContents(span);
        }

        e.target.value = '';
        editor.focus();
    });

    // Bold / Italic / Underline
    document.getElementById('bold-btn').addEventListener('click', () => {
        document.execCommand('bold');
        updateToolbarState();
    });
    document.getElementById('italic-btn').addEventListener('click', () => {
        document.execCommand('italic');
        updateToolbarState();
    });
    document.getElementById('underline-btn').addEventListener('click', () => {
        document.execCommand('underline');
        updateToolbarState();
    });

    // Alignment
    document.getElementById('align-left-btn').addEventListener('click', () => {
        document.execCommand('justifyLeft');
    });
    document.getElementById('align-center-btn').addEventListener('click', () => {
        document.execCommand('justifyCenter');
    });
    document.getElementById('align-right-btn').addEventListener('click', () => {
        document.execCommand('justifyRight');
    });

    // Update active state when cursor moves
    editor.addEventListener('keyup', updateToolbarState);
    editor.addEventListener('mouseup', updateToolbarState);
    editor.addEventListener('mousedown', () => {
        imageLayer.querySelectorAll('.image-wrapper').forEach(w => w.classList.remove('selected'));
    });

    function updateToolbarState() {
        document.getElementById('bold-btn').classList.toggle('active', document.queryCommandState('bold'));
        document.getElementById('italic-btn').classList.toggle('active', document.queryCommandState('italic'));
        document.getElementById('underline-btn').classList.toggle('active', document.queryCommandState('underline'));
    }
    // IMAGE INSERT
    document.getElementById('add-image-btn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = async () => {
            const file = input.files[0];
            if (!file) return;

            const compressed = await compressImage(file);
            const hash = await hashFile(compressed);
            const fileName = `${hash}.webp`;

            let publicUrl;

            const { data: existingFiles } = await supabase.storage
                .from('images')
                .list('', { search: fileName });

            if (existingFiles && existingFiles.length > 0) {
                const { data } = supabase.storage.from('images').getPublicUrl(fileName);
                publicUrl = data.publicUrl;
            } else {
                const { error } = await supabase.storage
                    .from('images')
                    .upload(fileName, compressed, { contentType: 'image/webp' });

                if (error) return alertPopups(error.message);

                const { data } = supabase.storage.from('images').getPublicUrl(fileName);
                publicUrl = data.publicUrl;
            }

            insertImageAtCursor(publicUrl);
        };

        input.click();
    });

    function insertImageAtCursor(url) {
        const wrapper = document.createElement('div');
        wrapper.className = 'image-wrapper';

        const img = document.createElement('img');
        img.src = url;
        img.className = 'post-image';
        img.style.width = '300px';

        const handle = document.createElement('div');
        handle.className = 'resize-handle';

        // ✅ Add delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'image-delete-btn';
        deleteBtn.textContent = '✕';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            wrapper.remove();
        });

        wrapper.appendChild(img);
        wrapper.appendChild(handle);
        wrapper.appendChild(deleteBtn);
        wrapper.style.left = '20px';
        wrapper.style.top = '20px';

        imageLayer.appendChild(wrapper);

        enableResize(wrapper, img, handle);
        enableDrag(wrapper);
    }
    imageLayer.addEventListener('mousedown', (e) => {
        const wrapper = e.target.closest('.image-wrapper');
        imageLayer.querySelectorAll('.image-wrapper').forEach(w => w.classList.remove('selected'));
        if (wrapper) {
            wrapper.classList.add('selected');
            e.preventDefault();
        }
    });
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement !== editor) {
            const selected = imageLayer.querySelector('.image-wrapper.selected');
            if (selected) {
                e.preventDefault();
                selected.remove();
            }
        }
    });

    function enableDrag(wrapper) {
        let isDragging = false;

        wrapper.addEventListener('mousedown', (e) => {
            if (!wrapper.classList.contains('selected')) return;
            if (e.target.classList.contains('resize-handle')) return;

            isDragging = true;

            const rect = wrapper.getBoundingClientRect();
            const offsetX = e.clientX - rect.left;
            const offsetY = e.clientY - rect.top;

            function onMove(e) {
                if (!isDragging) return;

                const containerRect = document.getElementById('editor-container').getBoundingClientRect(); // ← changed
                let x = e.clientX - containerRect.left - offsetX;
                let y = e.clientY - containerRect.top - offsetY;

                wrapper.style.left = x + 'px';
                wrapper.style.top = y + 'px';
            }
            function onUp() {
                isDragging = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function enableResize(wrapper, img, handle) {
        let isResizing = false;

        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // prevent drag conflict
            isResizing = true;

            const startX = e.clientX;
            const startWidth = img.offsetWidth;

            function onMove(e) {
                if (!isResizing) return;

                const newWidth = startWidth + (e.clientX - startX);
                img.style.width = Math.max(newWidth, 50) + 'px';
            }

            function onUp() {
                isResizing = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    // SUBMIT
    document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return alertPopups("Not logged in.");

        const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .maybeSingle();

        const path = document.getElementById('blogPath').value;
        const title = document.getElementById('blogTitle').value;
        const genre = document.getElementById('blogGenre').value;

        const wrappers = imageLayer.querySelectorAll('.image-wrapper');

        wrappers.forEach(w => {
            w.setAttribute('data-x', w.style.left);
            w.setAttribute('data-y', w.style.top);

            const img = w.querySelector('img');
            w.setAttribute('data-width', img.style.width);
        });
        const contentHTML = editor.innerHTML;

        const editorContainer = document.getElementById('editor-container');
        const containerRect = editorContainer.getBoundingClientRect();

        const images = [];
        imageLayer.querySelectorAll('.image-wrapper').forEach(w => {
            const img = w.querySelector('img');
            images.push({
                src: img.src,
                x: (parseFloat(w.style.left) / containerRect.width * 100).toFixed(2) + '%',
                y: (parseFloat(w.style.top) / containerRect.height * 100).toFixed(2) + '%',
                width: (parseFloat(img.style.width) / containerRect.width * 100).toFixed(2) + '%',
                bottomPx: parseFloat(w.style.top) + img.offsetHeight  // ← add this
            });
        });

        if (!contentHTML.trim()) {
            return alertPopups("Content empty.");
        }

        const { error } = await supabase
            .from('bloginfo')
            .insert([{
                blogPath: path,
                genre,
                blogData: {
                    PostName: title,
                    Post: contentHTML,
                    Author: profile.display_name,
                    Images: images
                }
            }]);

        if (error) {
            alertPopups(error.message);
        } else {
            window.location.hash = "";
        }
    });
}