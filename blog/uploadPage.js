import { alertPopups } from './main.js';
let imageCount = 0;
function renumberImages() {
    const rows = document.querySelectorAll('.image-input-row');
    rows.forEach((row, i) => {
        row.querySelector('.image-input-label').textContent = `Image ${i + 1}`;
    });
    imageCount = rows.length;
}
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
        <textarea id="blogContent" placeholder="Write your content here. Type [image(image number)] where you want an image to appear."></textarea>
        <div id="image-inputs"></div>
        <button type="button" id="add-image-btn">+ Add Image</button>
        <button type="submit">Submit</button>
    </form>`;

// Dynamically add image inputs
document.getElementById('add-image-btn').addEventListener('click', () => {
    imageCount++;
    const div = document.createElement('div');
    div.className = 'image-input-row';
    div.innerHTML = `
    <span class="image-input-label">Image ${imageCount}</span>
    <div class="image-input-controls">
        <label class="file-input-btn">
            Choose File
            <input type="file" class="blog-image-input" accept="image/*">
        </label>
        <span class="file-name-display">No file chosen</span>
        <button type="button" class="remove-image-btn" onclick="this.parentElement.parentElement.remove();">✕</button>
    </div>
    <img class="image-preview" src="" alt="preview" style="display:none;">
`;

const fileInput = div.querySelector('.blog-image-input');
const fileNameDisplay = div.querySelector('.file-name-display');
fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    const preview = div.querySelector('.image-preview');
    if (file) {
        fileNameDisplay.textContent = file.name;
        preview.src = URL.createObjectURL(file);
        preview.style.display = 'block';
    } else {
        fileNameDisplay.textContent = 'No file chosen';
        preview.style.display = 'none';
    }
});
const removeBtn = div.querySelector('.remove-image-btn');
removeBtn.addEventListener('click', () => {
    div.remove();
    renumberImages();
});

    document.getElementById('image-inputs').appendChild(div);
});

    const form = document.getElementById('upload-form');
    
    // We pass 'supabase' directly into the function call here
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        uploadData(supabase); 
    });
}

// Make sure 'supabase' is listed here as a parameter!
async function uploadData(supabase) {
    if (!supabase) return;

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) { alertPopups("Not logged in."); return; }

    const { data: profile, error: profileError } = await supabase
        .from('profiles').select('display_name').eq('id', user.id).maybeSingle();
    if (profileError) { alertPopups("Profile error: " + profileError.message); return; }
    if (!profile) { alertPopups("No profile found."); return; }

    const path = document.getElementById('blogPath').value;
    const title = document.getElementById('blogTitle').value;
    const content = document.getElementById('blogContent').value;
    const genre = document.getElementById('blogGenre').value;
    const author = profile.display_name;

    if (!genre) { alertPopups("Please select a genre."); return; }

    // Check for duplicate path
    const { data: existing, error: checkError } = await supabase
        .from('bloginfo').select('blogPath').eq('blogPath', path).maybeSingle();
    if (checkError) { alertPopups("Check Error: " + checkError.message); return; }
    if (existing) { alertPopups("A post with this path already exists."); return; }

    // Upload all images in order
    const imageFiles = document.querySelectorAll('.blog-image-input');
    const imageUrls = [];

    for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i].files[0];
        if (!file) {
            alertPopups(`Image ${i + 1} has no file selected.`);
            return;
        }
        const compressed = await compressImage(file);
        const fileName = `${path}-${Date.now()}-${i}.webp`;

        const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(fileName, compressed, { contentType: 'image/webp' });

        if (uploadError) { alertPopups("Image Upload Error: " + uploadError.message); return; }

        const { data: urlData } = supabase.storage
            .from('images').getPublicUrl(fileName);

        imageUrls.push(urlData.publicUrl);
    }

    // Count [image] markers in content and validate
    const markerCount = (content.match(/\[image\d+\]/g) || []).length;
    if (markerCount !== imageUrls.length) {
        alertPopups(`You have ${markerCount} [image] markers but ${imageUrls.length} images. They must match.`);
        return;
    }

    const { error } = await supabase
        .from('bloginfo')
        .insert([{
            blogPath: path,
            genre: genre,
            blogData: {
                PostName: title,
                Post: content,
                Author: author,
                Images: imageUrls
            }
        }]);

    if (error) {
        alertPopups("Upload Error: " + error.message);
    } else {
        window.location.hash = "";
    }
}