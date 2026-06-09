# Multi-Photo Gallery Implementation Guide

## Overview
This guide provides the complete implementation for supporting multiple photos with geo-tagging in the Photo section.

## Backend Changes

### 1. Update Data Model (app/main.py)

Change the photo section data structure from:
```python
{
  "photo": "data:image/png;base64,...",
  "maps_url": "https://maps.google.com/..."
}
```

To:
```python
{
  "photos": [
    {
      "photo": "data:image/png;base64,...",
      "maps_url": "https://maps.google.com/...",
      "timestamp": "2026-06-05T19:29:49",
      "location_text": "13th st, Hanuman Nagar Colony..."
    },
    // ... more photos
  ]
}
```

### 2. Update Excel Export (app/main.py)

Find the photo export section (around line 520-540) and replace with:

```python
# Photos section
photos_data = sections.get("photo", {})
photos_list = photos_data.get("photos", [])

if photos_list:
    ws = wb.create_sheet("Photos")
    ws.append(["Photo #", "Timestamp", "Location", "Google Maps Link"])
    
    for idx, photo_item in enumerate(photos_list, 1):
        timestamp = photo_item.get("timestamp", "N/A")
        location = photo_item.get("location_text", "N/A")
        maps_url = photo_item.get("maps_url", "N/A")
        
        ws.append([f"Photo {idx}", timestamp, location, maps_url])
        
        # Embed image
        try:
            photo_data = photo_item.get("photo", "")
            if photo_data.startswith("data:image"):
                img_data = photo_data.split(",")[1]
                img_bytes = base64.b64decode(img_data)
                img = PILImage.open(io.BytesIO(img_bytes))
                
                # Resize if too large
                max_size = (400, 300)
                img.thumbnail(max_size, PILImage.Resampling.LANCZOS)
                
                buf = io.BytesIO()
                img.save(buf, format='PNG')
                buf.seek(0)
                
                excel_img = OpenpyxlImage(buf)
                # Position: Column B, Row after the data row
                cell_position = f"B{idx + 1}"
                ws.add_image(excel_img, cell_position)
                ws.row_dimensions[idx + 1].height = 225  # Adjust row height
        except Exception as e:
            logger.warning(f"Failed to embed photo {idx}: {e}")
    
    # Adjust column widths
    ws.column_dimensions['A'].width = 15
    ws.column_dimensions['B'].width = 60  # Wide for image
    ws.column_dimensions['C'].width = 50
    ws.column_dimensions['D'].width = 50
else:
    ws = wb.create_sheet("Photos")
    ws.append(["No photos captured"])
```

## Frontend Changes

### 3. Update HTML Structure (static/index.html)

Replace the photo section (around line 80-95) with:

```html
<!-- Photo Section -->
<div id="photo-section" class="hidden container mx-auto p-6 max-w-4xl">
    <h2 class="text-2xl font-semibold text-gray-800 mb-4">Photo Gallery</h2>
    
    <!-- Photo Gallery Grid -->
    <div id="photo-gallery" class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6"></div>
    
    <!-- Camera/Upload Interface -->
    <div class="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 mb-4">
        <video id="video" class="w-full rounded-lg mb-3 hidden" playsinline autoplay></video>
        <canvas id="photo-canvas" class="w-full rounded-lg mb-3"></canvas>
        
        <div class="flex flex-wrap gap-2">
            <button type="button" id="take-photo" class="flex-1 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">
                <i class="fas fa-camera mr-2"></i>Take Photo
            </button>
            <button type="button" id="upload-photo-btn" class="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700">
                <i class="fas fa-upload mr-2"></i>Upload
            </button>
            <input type="file" id="photo-file-input" accept="image/*" capture="environment" class="hidden">
            <button type="button" id="retake-photo" class="hidden flex-1 bg-yellow-600 text-white py-2 rounded-lg hover:bg-yellow-700">
                <i class="fas fa-redo mr-2"></i>Retake
            </button>
            <button type="button" id="add-geo-label" class="hidden flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700">
                <i class="fas fa-map-marker-alt mr-2"></i>Add Location
            </button>
            <button type="button" id="add-to-gallery-btn" class="hidden flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                <i class="fas fa-plus mr-2"></i>Add to Gallery
            </button>
        </div>
    </div>
    
    <button type="button" id="save-photo" class="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 font-semibold">
        <i class="fas fa-save mr-2"></i>Save All Photos
    </button>
</div>
```

### 4. Update JavaScript Logic (static/js/script.js)

Add this at the beginning of the photo section handler (after line 819):

```javascript
} else if (section === 'photo') {
    // Hide form, show photo section
    const sectionForm = document.getElementById('section-form');
    if (sectionForm) sectionForm.classList.add('hidden');
    document.getElementById('photo-section').classList.remove('hidden');
    
    // Initialize variables
    let photoGalleryData = [];  // Array of {photo, maps_url, timestamp, location_text}
    let currentPhotoData = null;
    let currentMapsUrl = '';
    let currentLocationText = '';
    
    const video = document.getElementById('video');
    const canvas = document.getElementById('photo-canvas');
    const ctx = canvas.getContext('2d');
    const takePhotoBtn = document.getElementById('take-photo');
    const uploadBtn = document.getElementById('upload-photo-btn');
    const fileInput = document.getElementById('photo-file-input');
    const retakeBtn = document.getElementById('retake-photo');
    const addLabelBtn = document.getElementById('add-geo-label');
    const addToGalleryBtn = document.getElementById('add-to-gallery-btn');
    const saveAllBtn = document.getElementById('save-photo');
    const gallery = document.getElementById('photo-gallery');
    
    // Load existing photos
    try {
        const res = await fetch(`${API_BASE_URL}/api/get-section/photo`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.success && data.data.section_data) {
            const savedData = data.data.section_data;
            // Handle both old (single photo) and new (multiple photos) format
            if (savedData.photos && Array.isArray(savedData.photos)) {
                photoGalleryData = savedData.photos;
            } else if (savedData.photo) {
                // Migrate old format
                photoGalleryData = [{
                    photo: savedData.photo,
                    maps_url: savedData.maps_url || '',
                    timestamp: new Date().toISOString(),
                    location_text: 'Legacy photo'
                }];
            }
            renderGallery();
        }
    } catch (err) {
        console.log('No existing photos:', err);
    }
    
    // Render gallery
    const renderGallery = () => {
        if (photoGalleryData.length === 0) {
            gallery.innerHTML = '<p class="col-span-full text-center text-gray-500 py-8">No photos yet. Capture or upload photos below.</p>';
            return;
        }
        gallery.innerHTML = photoGalleryData.map((p, idx) => `
            <div class="relative border rounded-lg overflow-hidden bg-white shadow-md hover:shadow-lg transition">
                <img src="${p.photo}" class="w-full h-40 object-cover cursor-pointer" onclick="viewFullPhoto(${idx})">
                <div class="p-2">
                    <div class="text-xs text-gray-600 mb-1">
                        <i class="fas fa-clock mr-1"></i>${new Date(p.timestamp).toLocaleString()}
                    </div>
                    ${p.maps_url ? `
                        <a href="${p.maps_url}" target="_blank" class="text-xs text-blue-600 hover:underline block truncate">
                            <i class="fas fa-map-marker-alt mr-1"></i>View on Maps
                        </a>
                    ` : '<span class="text-xs text-gray-400">No location</span>'}
                </div>
                <button onclick="deletePhotoFromGallery(${idx})" 
                    class="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center hover:bg-red-600 shadow-lg">
                    <i class="fas fa-trash text-xs"></i>
                </button>
            </div>
        `).join('');
    };
    
    // Delete photo
    window.deletePhotoFromGallery = (idx) => {
        if (confirm('Delete this photo?')) {
            photoGalleryData.splice(idx, 1);
            renderGallery();
            showPopup('Photo deleted', 'success');
        }
    };
    
    // View full photo
    window.viewFullPhoto = (idx) => {
        const p = photoGalleryData[idx];
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="relative max-w-4xl w-full bg-white rounded-lg overflow-hidden">
                <button onclick="this.parentElement.parentElement.remove()" 
                    class="absolute top-4 right-4 bg-white text-gray-800 rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-200 z-10">
                    <i class="fas fa-times"></i>
                </button>
                <img src="${p.photo}" class="w-full">
                <div class="p-4 bg-gray-50">
                    <p class="text-sm text-gray-600"><i class="fas fa-clock mr-2"></i>${new Date(p.timestamp).toLocaleString()}</p>
                    ${p.location_text ? `<p class="text-sm text-gray-600 mt-1"><i class="fas fa-map-marker-alt mr-2"></i>${p.location_text}</p>` : ''}
                    ${p.maps_url ? `<a href="${p.maps_url}" target="_blank" class="text-sm text-blue-600 hover:underline mt-2 inline-block">Open in Google Maps →</a>` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    };
    
    // Reset canvas
    const resetCanvas = () => {
        currentPhotoData = null;
        currentMapsUrl = '';
        currentLocationText = '';
        canvas.width = 400;
        canvas.height = 300;
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📷 Capture or upload a photo', canvas.width / 2, canvas.height / 2);
        
        takePhotoBtn.classList.remove('hidden');
        uploadBtn.classList.remove('hidden');
        retakeBtn.classList.add('hidden');
        addLabelBtn.classList.add('hidden');
        addToGalleryBtn.classList.add('hidden');
        video.classList.add('hidden');
        canvas.classList.remove('hidden');
    };
    
    resetCanvas();
    
    // Take photo logic
    takePhotoBtn.onclick = () => {
        if (navigator.mediaDevices && window.isSecureContext) {
            video.classList.remove('hidden');
            canvas.classList.add('hidden');
            takePhotoBtn.textContent = '📸 Capture';
            
            navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
            }).then(stream => {
                video.srcObject = stream;
                video.play();
                
                takePhotoBtn.onclick = () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0);
                    currentPhotoData = canvas.toDataURL('image/png');
                    
                    // Stop camera
                    video.srcObject.getTracks().forEach(t => t.stop());
                    video.classList.add('hidden');
                    canvas.classList.remove('hidden');
                    
                    takePhotoBtn.classList.add('hidden');
                    uploadBtn.classList.add('hidden');
                    retakeBtn.classList.remove('hidden');
                    addLabelBtn.classList.remove('hidden');
                };
            }).catch(() => {
                showPopup('Camera access denied. Use upload instead.', 'warning');
                resetCanvas();
            });
        } else {
            fileInput.click();
        }
    };
    
    // Upload photo
    uploadBtn.onclick = () => fileInput.click();
    
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
                const maxW = 640;
                const scale = img.width > maxW ? maxW / img.width : 1;
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                currentPhotoData = canvas.toDataURL('image/png');
                
                takePhotoBtn.classList.add('hidden');
                uploadBtn.classList.add('hidden');
                retakeBtn.classList.remove('hidden');
                addLabelBtn.classList.remove('hidden');
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    };
    
    // Retake
    retakeBtn.onclick = () => {
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(t => t.stop());
        }
        resetCanvas();
        takePhotoBtn.textContent = '📷 Take Photo';
        takePhotoBtn.onclick = arguments.callee.caller;  // Restore original handler
    };
    
    // Add geo label (reuse existing geo-tagging logic)
    addLabelBtn.onclick = async () => {
        addLabelBtn.disabled = true;
        addLabelBtn.textContent = 'Getting location...';
        
        // [Insert your existing geo-tagging code here from fetchAndDrawLocation]
        // This should draw the location label on the canvas and update currentMapsUrl and currentLocationText
        
        // After geo-tagging completes:
        addLabelBtn.classList.add('hidden');
        addToGalleryBtn.classList.remove('hidden');
        currentPhotoData = canvas.toDataURL('image/png');  // Update with labeled image
    };
    
    // Add to gallery
    addToGalleryBtn.onclick = () => {
        photoGalleryData.push({
            photo: currentPhotoData,
            maps_url: currentMapsUrl,
            timestamp: new Date().toISOString(),
            location_text: currentLocationText
        });
        renderGallery();
        resetCanvas();
        showPopup('Photo added to gallery!', 'success');
    };
    
    // Save all photos
    saveAllBtn.onclick = async () => {
        if (photoGalleryData.length === 0) {
            showPopup('Please capture at least one photo', 'warning');
            return;
        }
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/save-section`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    section: 'photo',
                    data: { photos: photoGalleryData },
                    date: new Date().toISOString().split('T')[0]
                })
            });
            
            const data = await res.json();
            if (!res.ok) {
                showPopup(data.message || 'Failed to save', 'error');
                return;
            }
            
            updateSectionTick('photo');
            showPopup(`Successfully saved ${photoGalleryData.length} photo(s)!`, 'success');
            document.getElementById('back-to-dashboard')?.click();
        } catch (err) {
            showPopup('Error: ' + err.message, 'error');
        }
    };
    
    // [Rest of your existing photo section code continues...]
```

## Testing Steps

1. **Refresh the application**
2. **Go to Photo section**
3. **Take or upload first photo**
4. **Click "Add Location" to geo-tag it**
5. **Click "Add to Gallery"**
6. **Repeat for more photos**
7. **Click "Save All Photos"**
8. **Export to Excel** - Should see all photos embedded

## Notes

- Each photo is stored with its own geo-tag
- Gallery shows thumbnails with delete option
- Click photo to view full size
- All photos are saved together
- Excel export includes all photos in a grid
