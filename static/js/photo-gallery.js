// Multi-Photo Gallery Implementation
// This code should replace the photo section handler in script.js

// Insert this code at line 819 in script.js (replacing the existing photo section)

} else if (section === 'photo') {
    // Hide form, show photo section
    const sectionForm = document.getElementById('section-form');
    if (sectionForm) sectionForm.classList.add('hidden');
    document.getElementById('photo-section').classList.remove('hidden');
    document.getElementById('signature-section').classList.add('hidden');
    
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
            gallery.innerHTML = '<p class="col-span-full text-center text-gray-500 py-8 text-sm">No photos yet. Capture or upload photos below.</p>';
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
                    class="absolute top-4 right-4 bg-white text-gray-800 rounded-full w-10 h-10 flex items-center justify-center hover:bg-gray-200 z-10 shadow-lg">
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
        
        // Stop any active camera stream
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(t => t.stop());
            video.srcObject = null;
        }
    };
    
    resetCanvas();
    
    // Take photo logic
    let originalTakePhotoHandler = null;
    const initializeTakePhoto = () => {
        takePhotoBtn.onclick = () => {
            if (navigator.mediaDevices && window.isSecureContext) {
                video.classList.remove('hidden');
                canvas.classList.add('hidden');
                takePhotoBtn.innerHTML = '<i class="fas fa-camera"></i> Capture';
                
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
                        video.srcObject = null;
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
    };
    
    initializeTakePhoto();
    
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
        fileInput.value = '';  // Reset input
    };
    
    // Retake
    retakeBtn.onclick = () => {
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(t => t.stop());
        }
        resetCanvas();
        initializeTakePhoto();
    };
    
    // Add geo label - Uses existing geo-tagging logic
    addLabelBtn.onclick = async () => {
        addLabelBtn.disabled = true;
        addLabelBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting location...';
        
        const drawGeoTag = (lat, lon, plusCode, mapsUrlParam) => {
            const base = new Image();
            base.onload = () => {
                canvas.width = base.width;
                canvas.height = base.height;
                ctx.drawImage(base, 0, 0);
                
                const timestamp = new Date().toLocaleString();
                const labelLines = [
                    `📍 ${lat.toFixed(6)}, ${lon.toFixed(6)}`,
                    `📮 ${plusCode}`,
                    `🌍 ${mapsUrlParam || 'Maps URL unavailable'}`,
                    `🕒 ${timestamp}`
                ];
                
                const boxHeight = 110;
                ctx.fillStyle = 'rgba(0,0,0,0.65)';
                ctx.fillRect(0, canvas.width - boxHeight, canvas.width, boxHeight);
                ctx.fillStyle = 'white';
                ctx.font = '14px Arial';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                
                const startY = canvas.height - boxHeight + 10;
                labelLines.forEach((line, i) => {
                    ctx.fillText(line.length > 70 ? line.slice(0, 67) + '...' : line, 10, startY + i * 23);
                });
                
                currentMapsUrl = mapsUrlParam;
                currentLocationText = plusCode;
                currentPhotoData = canvas.toDataURL('image/png');
                
                addLabelBtn.classList.add('hidden');
                addToGalleryBtn.classList.remove('hidden');
                addLabelBtn.disabled = false;
                addLabelBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Add Location';
            };
            base.src = currentPhotoData;
        };
        
        const fetchAndDrawLocation = async (lat, lon) => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/get-location?lat=${lat}&lon=${lon}`, {
                    signal: AbortSignal.timeout(8000)
                });
                const data = await res.json();
                drawGeoTag(lat, lon, data.plus_code || 'Address not found', data.maps_url || '');
            } catch (err) {
                console.warn('Location API failed');
                drawGeoTag(lat, lon, 'Location unavailable', '');
            }
        };
        
        const fallbackIpLocation = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/get-ip-location`, {
                    signal: AbortSignal.timeout(8000)
                });
                
                if (!res.ok) throw new Error('Backend IP geolocation failed');
                
                const data = await res.json();
                if (!data.success || !data.latitude || !data.longitude) {
                    throw new Error('No location data');
                }
                
                await fetchAndDrawLocation(data.latitude, data.longitude);
            } catch (err) {
                console.log("Fallback IP location failed: " + err);
                showPopup('Could not get location. You can still add the photo.', 'warning');
                addLabelBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Add Location';
                addLabelBtn.disabled = false;
                addToGalleryBtn.classList.remove('hidden');
            }
        };
        
        const isSecure = window.isSecureContext;
        
        if (isSecure && "geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                async pos => {
                    await fetchAndDrawLocation(pos.coords.latitude, pos.coords.longitude);
                },
                async (error) => {
                    console.warn('Browser geolocation error:', error.message);
                    
                    if (error.code === error.PERMISSION_DENIED) {
                        showPopup('Location permission denied. Enable GPS for accurate location.', 'warning');
                    } else if (error.code === error.POSITION_UNAVAILABLE) {
                        showPopup('GPS unavailable. Using approximate location.', 'warning');
                    } else if (error.code === error.TIMEOUT) {
                        showPopup('GPS timeout. Using approximate location.', 'warning');
                    }
                    
                    await fallbackIpLocation();
                },
                { 
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            console.log('Using backend IP geolocation');
            showPopup('Using approximate location. Enable location for GPS.', 'warning');
            await fallbackIpLocation();
        }
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
        initializeTakePhoto();
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
}
