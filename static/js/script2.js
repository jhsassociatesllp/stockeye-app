// const API_BASE_URL = "http://localhost:8000";

// Automatically detect correct backend base URL
let API_BASE_URL = "";
let completionStatus = {}; 
let submitButton = document.getElementById('submit-audit');
// 🛑 Prevent accidental exit with custom modal
let isExitConfirmed = false;
// ✅ Skip exit confirmation for internal navigation (like login redirect)
let isNavigatingInternally = false;


if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    API_BASE_URL = "http://localhost:8000";
} else {
    // Use current host if running via IP or ngrok
    API_BASE_URL = `${window.location.origin}`;
}

// 🔒 Ensure both hidden from the start
document.addEventListener("DOMContentLoaded", () => {
    const photoSection = document.getElementById("photo-section");
    const signatureSection = document.getElementById("signature-section");
    if (photoSection) photoSection.classList.add("hidden");
    if (signatureSection) signatureSection.classList.add("hidden");
});


/* -------- Utility Functions -------- */
function validatePassword(password) {
    if (password.length < 8) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[a-z]/.test(password)) return false;
    if (!/\d/.test(password)) return false;
    if (!/[!@#$%^&*()]/.test(password)) return false;
    return true;
}

function updateSectionTick(section) {
    completionStatus[section] = true;
    // Persist to localStorage as a fallback
    localStorage.setItem('completionStatus', JSON.stringify(completionStatus));
    const card = document.querySelector(`[data-section="${section}"]`);
    if (card) {
        const statusSpan = card.querySelector('.status-icon');
        if (statusSpan) {
            statusSpan.innerHTML = '<i class="fas fa-check-circle text-green-500"></i>';
        } else {
            const span = document.createElement('span');
            span.className = 'status-icon';
            span.innerHTML = '<i class="fas fa-check-circle text-green-500"></i>';
            const flexDiv = card.querySelector('div') || card;
            flexDiv.appendChild(span);
        }
    } else {
        // Card might not be mounted/visible — that's ok, we'll keep local state.
        console.warn(`updateSectionTick: card for section "${section}" not found in DOM (will persist in state).`);
    }
}

function updateButtons() {
    const sectionList = document.getElementById('section-list');
    const sectionContent = document.getElementById('section-content');
    const sendEmailSection = document.getElementById('send-email-section');
    const submitBtn = document.getElementById('submit-audit');
    const exportBtn = document.getElementById('export-excel');

    const isDashboardVisible = 
        !sectionList.classList.contains('hidden') &&
        sectionContent.classList.contains('hidden') &&
        sendEmailSection.classList.contains('hidden');
    const isDesktop = window.innerWidth > 640;

    if (submitBtn) submitBtn.classList.toggle('hidden', !isDashboardVisible);
    if (exportBtn) exportBtn.classList.toggle('hidden', !isDashboardVisible); // Ignore isDesktop for now
}

// Custom Popup (Modal)
function showPopup(message, type = "info", autoClose = true, redirect = null) {
    // Remove existing popups
    const oldPopup = document.getElementById("popup-message");
    if (oldPopup) oldPopup.remove();

    const colors = {
        success: "bg-green-500",
        error: "bg-red-500",
        info: "bg-blue-500",
        warning: "bg-yellow-500"
    };

    const popup = document.createElement("div");
    popup.id = "popup-message";
    popup.className = `fixed top-5 left-1/2 transform -translate-x-1/2 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50 text-center transition-opacity duration-300`;
    popup.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(popup);

    if (autoClose) {
        setTimeout(() => {
            popup.style.opacity = "0";
            setTimeout(() => {
                popup.remove();
                if (redirect) window.location.href = redirect;
            }, 400);
        }, 2000);
    }
}


const registerForm = document.getElementById("register-form");
if (registerForm) {
    registerForm.onsubmit = async (e) => {
        e.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirm_password = document.getElementById("confirm_password").value;

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) return showPopup("Invalid email address", "error");
        if (!validatePassword(password))
            return showPopup("Password must include uppercase, lowercase, number, and special character", "warning");
        if (password !== confirm_password) return showPopup("Passwords do not match", "error");

        try {
            const res = await fetch(`${API_BASE_URL}/api/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password, confirm_password }),
            });

            const text = await res.text(); // ✅ Read once
            let data = {};
            try {
                data = JSON.parse(text);
            } catch {
                return showPopup("Invalid server response", "error");
            }

            if (!res.ok) {
                showPopup(data.message || "Something went wrong", "error");
                return;
            }

            showPopup("Registration successful! Redirecting to login...", "success");
            isNavigatingInternally = true; // ✅ prevent reload alert
            setTimeout(() => (window.location.href = "/static/login.html"), 1500);
        } catch (err) {
            console.error("Register error:", err);
            showPopup("Network or server error: " + err.message, "error");
        }
    };
}


const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        try {
            const res = await fetch(`${API_BASE_URL}/api/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const text = await res.text();
            let data = {};
            try {
                data = JSON.parse(text);
            } catch {
                return showPopup("Invalid server response", "error");
            }

            if (!res.ok) {
                showPopup(data.message || "Invalid credentials", "error");
                return;
            }

            localStorage.setItem("access_token", data.data.access_token);
            showPopup("Login successful! Redirecting...", "success");

            // 🟩 Add this line before redirect
            isNavigatingInternally = true;
            setTimeout(() => (window.location.href = "/static/index.html"), 1500);
        } catch (err) {
            console.error("Login error:", err);
            showPopup("Network or server error: " + err.message, "error");
        }
    };
}


function toggleSubmitButton() {
    const isDashboard = !document.getElementById('section-content')?.classList.contains('hidden');
    const submitButton = document.getElementById('submit-audit');
    if (submitButton) submitButton.classList.toggle('hidden', isDashboard);
}

// Global back-to-dashboard handler
const backToDashboardButton = document.getElementById('back-to-dashboard');
if (backToDashboardButton) {
    backToDashboardButton.onclick = () => {
        document.getElementById('section-content')?.classList.add('hidden');
        document.getElementById('section-list')?.classList.remove('hidden');

        document.getElementById('photo-section').classList.add('hidden');
        document.getElementById('signature-section').classList.add('hidden');

        // Stop camera stream if active
        const video = document.getElementById('video');
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }

        if (typeof window.loadDashboard === 'function') {
            window.loadDashboard();
        } else {
            console.warn('loadDashboard not available');
            // fallback: re-trigger initial load flow
            document.dispatchEvent(new Event('DOMContentLoaded'));
        }
        document.getElementById('submit-audit')?.classList.remove('hidden');
        document.getElementById('export-excel')?.classList.remove('hidden');

        toggleSubmitButton();
    };
}

// Handle dashboard and section loading
if (document.getElementById('section-list')) {
    let sections = [];
    document.addEventListener('DOMContentLoaded', loadDashboard);

    async function loadDashboard() {
        const token = localStorage.getItem('access_token');
        if (!token) {
            console.warn('No token found, redirecting to login');
            window.location.href = '/static/login.html';
            return;
        }
        console.log("Token found:", token);

        try {
            const res = await fetch(`${API_BASE_URL}/api/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const text = await res.text();
            console.log("Called api me");
            console.log('Me response:', { status: res.status, body: text });

            let data;
            try {
                data = JSON.parse(text);
            } catch {
                console.error('Failed to parse /me response:', text);
                showPopup('Failed to load user info: Invalid server response');
                localStorage.removeItem('access_token');
                window.location.href = '/static/login.html';
                return;
            }

            if (!res.ok) {
                console.warn('Redirecting to login due to auth failure:', text);
                localStorage.removeItem('access_token');
                window.location.href = '/static/login.html';
                return;
            }

            document.getElementById('user-info').textContent = `Welcome, ${data.data.name}`;

            const sectionsRes = await fetch(`${API_BASE_URL}/api/get-sections`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const sectionsText = await sectionsRes.text();
            console.log('Get-sections response:', { status: sectionsRes.status, body: sectionsText });

            let sectionsData;
            try {
                sectionsData = JSON.parse(sectionsText);
            } catch {
                console.error('Failed to parse /get-sections response:', sectionsText);
                showPopup('Failed to load sections: Invalid server response');
                return;
            }

            if (!sectionsRes.ok) {
                showPopup(sectionsData.message || 'Failed to load sections');
                return;
            }

            // Log server completion status
            console.log('Server completion_status:', sectionsData.data.completion_status);

            // Load local completion status as fallback
            const localCompletionStatus = JSON.parse(localStorage.getItem('completionStatus')) || {};
            const serverStatus = sectionsData.data.completion_status || {};
            completionStatus = { ...localCompletionStatus, ...serverStatus };

            // <-- UPDATED: include 'stock_reconciliation' right after general_report -->
            sections = [
                'general_report', 'stock_reconciliation',
                'observations_on_stacking', 'observations_on_warehouse_operations',
                'observations_on_warehouse_record_keeping', 'observations_on_wh_infrastructure',
                'observations_on_quality_operation', 'checklist_wrt_exchange_circular_mentha_oil',
                'checklist_wrt_mcxCCL_circular_metal', 'checklist_wrt_mcxCCL_circular_cotton_bales',
                'signature', 'photo'
            ];

            const sectionList = document.getElementById('section-list');
            sectionList.innerHTML = '';
            sections.forEach((section, index) => {
                if (submitButton) submitButton.classList.remove('hidden');
                if (exportBtn) exportBtn.classList.remove('hidden');

                const card = document.createElement('div');
                card.className = 'section-card bg-white p-4 rounded-lg shadow-md cursor-pointer';
                card.dataset.section = section; // <- add this so we can find it later

                // show title on left and a status-icon container on right
                const title = section.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                card.innerHTML = `
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-medium text-gray-800">${title}</h3>
                    <span class="status-icon">${ completionStatus[section] ? '<i class="fas fa-check-circle text-green-500"></i>' : '' }</span>
                </div>
                `;

                card.onclick = () => loadSection(section);
                sectionList.appendChild(card);
            });
        updateButtons();
            
    if (submitButton) {
        submitButton.classList.remove('hidden');
        submitButton.onclick = async () => {
            const allCompleted = Object.values(completionStatus).every(v => v === true);
            if (!allCompleted) {
                showPopup('Please fill the data for all the sections and save that.');
                return;
            }
            try {
                const res = await fetch(`${API_BASE_URL}/api/submit-audit`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const text = await res.text();
                let dataRes;
                try {
                    dataRes = JSON.parse(text);
                } catch {
                    showPopup('Failed to submit audit: Invalid server response');
                    return;
                }
                if (!res.ok) {
                    showPopup(dataRes.message || 'Failed to submit audit');
                    return;
                }
                
                // ✅ Show success message
                showPopup('Audit submitted successfully ✅', 'success');
                
                // ✅ Clear completion status
                completionStatus = {};
                localStorage.removeItem('completionStatus');

                // ✅ Clear all section data and green ticks
                await clearAllSectionData();
                
                // Reload dashboard to reset tick marks
                await loadDashboard();
                
            } catch (err) {
                console.error('Submit audit error:', err);
                showPopup('Error: ' + err.message);
            }
        };
    }
            toggleSubmitButton();
        } catch (err) {
            console.error('Dashboard error:', err);
            showPopup('Error: ' + err.message);
        }
    }

    const exportBtn = document.getElementById('export-excel');  // Changed ID
if (exportBtn) {
    exportBtn.onclick = async () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
            showPopup('Please login again before exporting.', 'warning');
            return;
        }

        exportBtn.disabled = true;
        exportBtn.textContent = 'Checking...';

        try {
            // Step 1: Check if all sections completed
            const resSections = await fetch(`${API_BASE_URL}/api/get-sections`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const text = await resSections.text();
            let data = {};
            try { data = JSON.parse(text); } catch { data = {}; }

            if (!resSections.ok) {
                showPopup(data.message || 'Unable to validate sections.', 'error');
                exportBtn.disabled = false;
                exportBtn.textContent = 'Export to Excel';
                return;
            }

            const completion = data.data?.completion_status || {};
            const allCompleted = Object.values(completion).every(v => v === true);
            if (!allCompleted) {
                showPopup('Please complete all sections before exporting.', 'warning');
                exportBtn.disabled = false;
                exportBtn.textContent = 'Export to Excel';
                return;
            }

            // Step 2: Trigger backend export
            exportBtn.textContent = 'Preparing Excel file...';
            const res = await fetch(`${API_BASE_URL}/api/export-excel`, {  // Changed endpoint
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                let msg = await res.text();
                try { msg = JSON.parse(msg).message; } catch {}
                showPopup(msg || 'Failed to export file.', 'error');
                exportBtn.disabled = false;
                exportBtn.textContent = 'Export to Excel';
                return;
            }

            // Step 3: Download file
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Audit_Report.xlsx';  // Changed extension
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            showPopup('Download started successfully.', 'success');
        } catch (err) {
            console.error('Export error:', err);
            showPopup('Error exporting: ' + err.message, 'error');
        } finally {
            exportBtn.disabled = false;
            exportBtn.textContent = 'Export to Excel';
        }
    };
}

    // make available to handlers defined outside this block
    window.loadDashboard = loadDashboard;

    async function loadSection(section) {
        // Clear the form content immediately to avoid flickering
        const sectionForm = document.getElementById('section-form');
        if (sectionForm) {
            sectionForm.innerHTML = '<p class="text-gray-600">Loading...</p>'; // Temporary loading message to prevent flicker
        }

        const token = localStorage.getItem('access_token');
        document.getElementById('section-list')?.classList.add('hidden');
        document.getElementById('section-content')?.classList.remove('hidden');
        // Hide submit & export when inside a section
        document.getElementById('submit-audit')?.classList.add('hidden');
        document.getElementById('export-excel')?.classList.add('hidden');
        
        // 🔒 Always hide both before any section logic runs
        const photoSection = document.getElementById('photo-section');
        const signatureSection = document.getElementById('signature-section');
        if (photoSection) photoSection.classList.add('hidden');
        if (signatureSection) signatureSection.classList.add('hidden');

        // Stop camera if active
        const video = document.getElementById('video');
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }


        try {
            const res = await fetch(`${API_BASE_URL}/api/get-section/${section}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const text = await res.text();
            console.log(`Get-section ${section} response:`, { status: res.status, body: text });

            let data;
            try {
                data = JSON.parse(text);
            } catch {
                console.error(`Failed to parse /get-section/${section} response:`, text);
                showPopup('Failed to load section: Invalid server response');
                return;
            }

            if (!res.ok) {
                showPopup(data.message || `Failed to load ${section}`);
                return;
            }

            // Now populate the form after fetch
            const form = document.getElementById('section-form');
            form.innerHTML = '';
            let isSaved = false;
            const sectionData = data.data.section_data || {};

            // ---------- GENERAL REPORT (existing) ----------
            if (section === 'general_report') {
                form.innerHTML = `
                    <div class="mb-4">
                        <label for="audit_date" class="block text-gray-800 font-medium mb-2">Audit Date <span class="mandatory-star">*</span></label>
                        <input type="date" id="audit_date" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required>
                    </div>
                    <div class="mb-4">
                        <label for="delivery_centre" class="block text-gray-800 font-medium mb-2">Delivery Centre <span class="mandatory-star">*</span></label>
                        <input type="text" id="delivery_centre" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required>
                    </div>
                    <div class="mb-4">
                        <label for="time_in" class="block text-gray-800 font-medium mb-2">Time In <span class="mandatory-star">*</span></label>
                        <input type="time" id="time_in" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required>
                    </div>
                    <div class="mb-4">
                        <label for="time_out" class="block text-gray-800 font-medium mb-2">Time Out <span class="mandatory-star">*</span></label>
                        <input type="time" id="time_out" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required>
                    </div>
                    <div class="mb-4">
                        <label for="working_hours" class="block text-gray-800 font-medium mb-2">Working Hours <span class="mandatory-star">*</span></label>
                        <input type="text" id="working_hours" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" readonly>
                    </div>
                    <div class="mb-4">
                        <label for="warehouse_address" class="block text-gray-800 font-medium mb-2">Warehouse Address <span class="mandatory-star">*</span></label>
                        <textarea id="warehouse_address" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required></textarea>
                    </div>
                    <div class="mb-4">
                        <label for="warehouse_name" class="block text-gray-800 font-medium mb-2">Warehouse Name <span class="mandatory-star">*</span></label>
                        <input type="text" id="warehouse_name" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required>
                    </div>
                    <div class="mb-4">
                        <label for="auditor_name" class="block text-gray-800 font-medium mb-2">Auditor Name <span class="mandatory-star">*</span></label>
                        <input type="text" id="auditor_name" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required>
                    </div>
                    <div class="mb-4">
                        <label for="warehouse_manager_name" class="block text-gray-800 font-medium mb-2">Warehouse Manager <span class="mandatory-star">*</span></label>
                        <input type="text" id="warehouse_manager_name" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required>
                    </div>
                    <div class="mb-4">
                        <label for="previous_audit_date" class="block text-gray-800 font-medium mb-2">Previous Audit Date <span class="mandatory-star">*</span></label>
                        <input type="date" id="previous_audit_date" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required>
                    </div>
                    <div class="mb-4">
                        <label for="previous_auditor_name" class="block text-gray-800 font-medium mb-2">Previous Auditor <span class="mandatory-star">*</span></label>
                        <input type="text" id="previous_auditor_name" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required>
                    </div>
                    <div class="mb-4">
                        <label for="previous_auditor_type" class="block text-gray-800 font-medium mb-2">Previous Auditor Type <span class="mandatory-star">*</span></label>
                        <select id="previous_auditor_type" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required>
                            <option value="MCXCCL">MCXCCL</option>
                            <option value="WSP">WSP</option>
                            <option value="External">External</option>
                        </select>
                    </div>
                    <div id="agency_name_container" class="mb-4" style="display: none;">
                        <label for="agency_name" class="block text-gray-800 font-medium mb-2">Agency Name <span class="mandatory-star">*</span></label>
                        <input type="text" id="agency_name" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    </div>
                    <div class="mb-4">
                        <label for="warehouse_capacity" class="block text-gray-800 font-medium mb-2">Warehouse Capacity <span class="mandatory-star">*</span></label>
                        <input type="number" id="warehouse_capacity" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required min="0">
                    </div>
                    <div class="mb-4">
                        <label for="capacity_utilization" class="block text-gray-800 font-medium mb-2">Capacity Utilization (%) <span class="mandatory-star">*</span></label>
                        <input type="number" id="capacity_utilization" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" required min="0" max="100" step="0.01">
                    </div>
                    <button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button>
                    <button type="button" id="edit-section" class="w-full bg-gray-300 text-gray-800 p-2.5 rounded-lg mt-2 hidden">Edit</button>
                `;
                // Populate data
                document.getElementById('audit_date').value = sectionData.audit_date || '';
                document.getElementById('delivery_centre').value = sectionData.delivery_centre || '';
                document.getElementById('time_in').value = sectionData.time_in || '';
                document.getElementById('time_out').value = sectionData.time_out || '';
                document.getElementById('working_hours').value = sectionData.working_hours || '';
                document.getElementById('warehouse_address').value = sectionData.warehouse_address || '';
                document.getElementById('warehouse_name').value = sectionData.warehouse_name || '';
                document.getElementById('auditor_name').value = sectionData.auditor_name || '';
                document.getElementById('warehouse_manager_name').value = sectionData.warehouse_manager_name || '';
                document.getElementById('previous_audit_date').value = sectionData.previous_audit_date || '';
                document.getElementById('previous_auditor_name').value = sectionData.previous_auditor_name || '';
                document.getElementById('previous_auditor_type').value = sectionData.previous_auditor_type || '';
                document.getElementById('agency_name').value = sectionData.agency_name || '';
                document.getElementById('warehouse_capacity').value = sectionData.warehouse_capacity || '';
                document.getElementById('capacity_utilization').value = sectionData.capacity_utilization || '';
                // Trigger events
                if (sectionData.time_in && sectionData.time_out) {
                    document.getElementById('time_out').dispatchEvent(new Event('change'));
                }
                document.getElementById('previous_auditor_type').dispatchEvent(new Event('change'));
                // Auto-calculate Working Hours
                const timeIn = document.getElementById('time_in');
                const timeOut = document.getElementById('time_out');
                const workingHours = document.getElementById('working_hours');
                timeOut.addEventListener('change', () => {
                    if (timeIn.value && timeOut.value) {
                        const start = new Date(`1970-01-01T${timeIn.value}Z`);
                        const end = new Date(`1970-01-01T${timeOut.value}Z`);
                        if (end > start) {
                            const diffMs = end - start;
                            const hours = Math.floor(diffMs / (1000 * 60 * 60));
                            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                            workingHours.value = `${hours}h ${minutes}m`;
                        }
                    }
                });
                // Show/hide agency name based on type
                document.getElementById('previous_auditor_type').addEventListener('change', () => {
                    document.getElementById('agency_name_container').style.display = 
                        document.getElementById('previous_auditor_type').value === 'External' ? 'block' : 'none';
                });
            } 
            // ---------- STOCK RECONCILIATION - NEW SECTION ----------
            else if (section === 'stock_reconciliation') {
                form.innerHTML = `
                    <div class="mb-4">
                        <h3 class="text-lg font-semibold text-gray-800">Stock Reconciliation</h3>
                    </div>
                    <div id="commodity-list" class="space-y-3"></div>
                    <div class="mt-3 flex justify-between">
                        <button type="button" id="add-commodity" class="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600">Add Commodity</button>
                        <div class="text-sm text-gray-500 self-center">(*) Mandatory fields</div>
                    </div>
                    <div class="mt-4">
                        <button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button>
                        <button type="button" id="edit-section" class="w-full bg-gray-300 text-gray-800 p-2.5 rounded-lg mt-2 hidden">Edit</button>
                    </div>
                `;

                const commodityList = document.getElementById('commodity-list');
                const addBtn = document.getElementById('add-commodity');
                let commodityCounter = 0;

                function createCommodityCard(dataObj = null) {
                    const card = document.createElement('div');
                    card.className = 'border rounded-lg p-3 bg-white shadow-sm';
                    
                    // append card before assigning index
                    commodityList.appendChild(card);

                    // dynamically compute index based on order
                    const idx = Array.from(commodityList.children).indexOf(card) + 1;
                    card.id = `commodity-card-${idx}`;

                    card.innerHTML = `
                        <div class="flex justify-between items-center cursor-pointer" id="commodity-header-${idx}">
                            <div>
                                <h4 class="text-md font-medium text-gray-800" id="commodity-title-${idx}">Commodity ${idx}</h4>
                                <div class="text-xs text-gray-500" id="commodity-subtitle-${idx}">${dataObj ? (dataObj.commodity_name || '') : ''}</div>
                            </div>
                            <button type="button" class="text-red-500 hover:text-red-700" id="delete-${idx}" title="Delete Commodity">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                        <div class="mt-3" id="commodity-body-${idx}">
                            <div class="mb-2">
                                <label class="block text-gray-700 mb-1">Commodity Name <span class="mandatory-star">*</span></label>
                                <input type="text" id="commodity-name-${idx}" class="w-full p-2 border rounded-lg" placeholder="Enter Commodity Name">
                            </div>
                            <div class="mb-2">
                                <label class="block text-gray-700 mb-1">Stock <span class="mandatory-star">*</span></label>
                                <select id="commodity-select-${idx}" class="w-full p-2 border rounded-lg">
                                    <option value="">-- Select Stock --</option>
                                    <option value="Valid Stock">Valid Stock</option>
                                    <option value="Under QC">Under QC</option>
                                    <option value="Rejected">Rejected</option>
                                    <option value="FED">FED</option>
                                    <option value="Non-exchange">Non-exchange</option>
                                </select>
                            </div>
                            <div class="mb-2">
                                <label class="block text-gray-700 mb-1">Quantity as per Registered <span class="mandatory-star">*</span></label>
                                <input type="number" id="qty-registered-${idx}" min="0" step="any" class="w-full p-2 border rounded-lg">
                            </div>
                            <div class="mb-2">
                                <label class="block text-gray-700 mb-1">Quantity as per Physical <span class="mandatory-star">*</span></label>
                                <input type="number" id="qty-physical-${idx}" min="0" step="any" class="w-full p-2 border rounded-lg">
                            </div>
                            <div class="mb-2">
                                <label class="block text-gray-700 mb-1">Difference (Registered - Physical)</label>
                                <input type="text" id="difference-${idx}" readonly class="w-full p-2 border rounded-lg bg-gray-100">
                            </div>
                            <div class="mb-2">
                                <label class="block text-gray-700 mb-1">Remarks</label>
                                <input type="text" id="remarks-${idx}" class="w-full p-2 border rounded-lg" placeholder="Remarks (optional)">
                            </div>
                        </div>
                    `;

                    // populate data if available
                    if (dataObj) {
                        document.getElementById(`commodity-name-${idx}`).value = dataObj.commodity_name || '';
                        document.getElementById(`commodity-select-${idx}`).value = dataObj.commodity || '';
                        document.getElementById(`qty-registered-${idx}`).value = dataObj.qty_registered || '';
                        document.getElementById(`qty-physical-${idx}`).value = dataObj.qty_physical || '';
                        document.getElementById(`difference-${idx}`).value = dataObj.difference || '';
                        document.getElementById(`remarks-${idx}`).value = dataObj.remarks || '';
                        document.getElementById(`commodity-subtitle-${idx}`).textContent = dataObj.commodity_name || '';
                    }

                    // function to recompute display
                    function recompute() {
                        const name = document.getElementById(`commodity-name-${idx}`).value.trim();
                        const stock = document.getElementById(`commodity-select-${idx}`).value.trim();
                        const reg = parseFloat(document.getElementById(`qty-registered-${idx}`).value || 0);
                        const phy = parseFloat(document.getElementById(`qty-physical-${idx}`).value || 0);
                        const diff = reg - phy;
                        document.getElementById(`difference-${idx}`).value = isNaN(diff) ? '' : diff;

                        document.getElementById(`commodity-title-${idx}`).textContent =
                            name ? `Commodity ${idx} - ${name}` : `Commodity ${idx}`;
                        document.getElementById(`commodity-subtitle-${idx}`).textContent = stock || '';
                    }

                    ['commodity-name-', 'commodity-select-', 'qty-registered-', 'qty-physical-'].forEach(prefix => {
                        const el = document.getElementById(prefix + idx);
                        if (el) el.addEventListener('input', recompute);
                        if (el) el.addEventListener('change', recompute);
                    });

                    // expand/collapse toggle
                    document.getElementById(`commodity-header-${idx}`).addEventListener('click', (ev) => {
                        if (ev.target.closest(`#delete-${idx}`)) return;
                        const body = document.getElementById(`commodity-body-${idx}`);
                        if (body) body.classList.toggle('hidden');
                    });

                    // delete commodity and reindex
                    document.getElementById(`delete-${idx}`).addEventListener('click', () => {
                        card.remove();
                        reindexCommodities();
                    });
                }

                // 🔁 Reindexing after delete
                function reindexCommodities() {
                    const cards = Array.from(commodityList.children);
                    cards.forEach((card, newIndex) => {
                        const idx = newIndex + 1;
                        const title = card.querySelector('h4[id^="commodity-title-"]');
                        const nameInput = card.querySelector('input[id^="commodity-name-"]');
                        const nameValue = nameInput ? nameInput.value.trim() : '';
                        title.textContent = nameValue ? `Commodity ${idx} - ${nameValue}` : `Commodity ${idx}`;
                    });
                }


                const initialCommodities = Array.isArray(sectionData.commodities) ? sectionData.commodities : [];
                if (initialCommodities.length > 0) {
                    initialCommodities.forEach(obj => createCommodityCard(obj));
                } else {
                    createCommodityCard();
                }

                addBtn.onclick = () => {
                    createCommodityCard();
                    const last = commodityList.lastElementChild;
                    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'center' });
                };
            }

            else if (section === 'observations_on_stacking') {
                // document.getElementById('photo-section').classList.add('hidden');
                // document.getElementById('signature-section')?.classList.add('hidden');
                const questions = [
                    "Whether the appearance of the stored stocks is neat and free from dust/stains of oil, rust, cracks etc.?",
                    "Whether Packaging condition of stock deposited is as per MCXCCL norms/ procedure guidelines/ relevant circulars as mentioned below? Cotton - Circular no. MCXCCL/WHL/249/2023 dated October 16, 2023 Mentha Oil- Circular no. MCXCCL/WHL/141/2021 dated May 31, 2021 Aluminium: Circular no. MCXCCL/WHL/045/2023 dated February 16, 2023 Lead: Circular no. MCXCCL/WHL/220/2023 dated September 15, 2023 Copper: Circular no. MCXCCL/WHL/868/2020 dated November 23, 2020 Zinc: Circular no. MCXCCL/WHL/044/2023 dated February 16, 2023 Nickel: Circular no. MCXCCL/WHL/868/2020 dated November 23, 2020 Note: any subsequent circular issued for above mentioned commodity shall be referred for compliance Metal & Cotton - no straps should be broken in exchange deliverable stocks",
                    "Whether the stacking of the stock is done as per WDRA guidelines (as applicable) or as per MCXCCL? Whether stock is in countable position, stacking done appropriately & is there any co-mingling of lots?",
                    "Whether adequate alleyways & gangways between stacks & wall to stacks are kept for easy movement, aeration & chemical treatments, physical verification, etc.?",
                    "Whether proper stack layout / stacks plan displayed at warehouse floor?",
                    "Whether lot cards in WSP format are placed on all the stored stocks with up to date entries of all transactions within two working days of transaction/receipt creation?",
                    "Whether overwriting / corrections are found in lot cards?",
                    "Whether suitable dunnage material, as per good warehousing practices available (except mentha oil/ metals) for stored goods?",
                    "Whether lot sealing/drum/drum sealing (for Mentha Oil) for all lots/drums deposited /retested is done within two working days of transaction?",
                    "Whether the Warehouse staff has checked the seal intactness of stocks every month? (Pls verify lot seal register & Monthly declaration stating seals have been checked)",
                    "Is there any spillage or damage material lying spread across the stack or floor? If yes, whether the same is appropriately packed and is kept in demarcated area on the same day?",
                    "Is there a designated area inside the warehouse mentioning the floor area in square feet/meter for FED goods, rejected goods and non-Exchange goods available for storage in the warehouse?",
                    "Is any FED Stock lying for more than 3 months? / Any rejected stock lying in warehouse? If Yes, whether marking/ tagging/placard on such lot card or Stock and follow-up with client for lifting of such stocks is done by WSP?",
                    "Is any stock of identical (exchange grade) agri commodity,for which MCXCCL has accredited the warehouse, stored in the warehouse?",
                    "Is there any other agri commodity which is not in the WDRA registration certificate, stored in the warehouse?",
                    "Has WSP stored its ‘own’ commodity in the warehouse?",
                    "Is any stock of identical non-agri commodity stored in MCXCCL accredited Metal warehouse Other than approved commodity?",
                    "Whether visual demarcation between MCX deliverable, Non-exchange & Rejected stock is done or not?",
                    "In case Non Exchange stock kept in MCXCCL accredited capacity is it kept with clear demarcation?",
                    "Whether details like hypothecation / lien / pledge to any financial institutions for the purpose of funding has been displayed on the stock and the same has been recorded?",
                    "Whether non exchange goods stored in accredited space and approval from MCXCCL is taken and available at warehouse?"
                ];
                questions.forEach((q, i) => {
                    form.innerHTML += `
                        <div class="mb-4">
                            <label class="block text-gray-800 font-medium mb-2">${i + 1}. ${q} <span class="mandatory-star">*</span></label>
                            <div class="flex space-x-4 mb-2">
                                <label><input type="radio" name="q${i}" value="Yes" required> Yes</label>
                                <label><input type="radio" name="q${i}" value="No"> No</label>
                            </div>
                            <input type="text" id="remarks${i}" class="w-full p-2.5 border border-gray-300 rounded-lg" placeholder="Remarks">
                        </div>
                    `;
                });
                form.innerHTML += `
                    <button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button>
                    <button type="button" id="edit-section" class="w-full bg-gray-300 text-gray-800 p-2.5 rounded-lg mt-2 hidden">Edit</button>
                `;
                // Populate data
                if (sectionData.questions && sectionData.questions.length === questions.length) {
                    sectionData.questions.forEach((qd, i) => {
                        const radio = document.querySelector(`input[name="q${i}"][value="${qd.answer}"]`);
                        if (radio) radio.checked = true;
                        document.getElementById(`remarks${i}`).value = qd.remarks || '';
                    });
                }
            } else if (section === 'observations_on_warehouse_operations') {
                // document.getElementById('photo-section').classList.add('hidden');
                // document.getElementById('signature-section')?.classList.add('hidden');
                const questions = [
                    "Whether custody of Navtal brand lock and key of the warehouse/godown is with WSP/WH Owner/others? (Pls specify) Whether additional key of Warehouse available at WSP Head office/WSP regional office and details are updated in Key distribution register?",
                    "Does the WSP use Navtal brand lock seals at every lock of all shutters which are used for transaction of goods? Whether seal details are captured in register.",
                    "Does the warehouse change Navtal brand locks every six months in June and December? Verify the serial number of lock and key, date when it was last changed.",
                    "Specify the number of WH staffs deployed at the warehouse/warehouse complex.",
                    "Indicate number of security guards deployed shift wise.",
                    "Mention name of the Security Agency offering security services at the WH.",
                    "Whether WH staff and Security personnel carrying their identity cards, and are in proper uniform and with baton, torch, whistle etc? Whether security guards checks for any presence of matchbox, gas lighter, chemicals and inflammable items of person entering the warehouse?",
                    "Whether security guard stays inside or outside the warehouse premises?",
                    "Whether there are proper night lighting in warehouse premises for the security purpose?",
                    "Whether proper WSP Sign Board (flex/board/wall-painting) and sign board of MCXCCL accreditation with WSP contact details, No Smoking signage in local dialect, emergency numbers, unauthorized entry, unauthorized parking etc are displayed?",
                    "Whether the board of “Complaint/feedback register available at warehouse” is displayed at the warehouse? (Pls mention the place of display of the board)",
                    "Whether Fire Fighting equipment available as per the WDRA guidelines? Please specify below; a. No. of Fire Extinguishers b. No. of Sand Buckets c. Capacity of water tank available as per operational guidelines? d. Is water pump attached to storage tank with hose pipe? e. Availability of water fire hydrant points/sprinkler system for Cotton Bales. f. Whether fire extinguishers are valid & in working condition? Are the expiry dates/next-due date clearly visible?",
                    "Whether the warehouse staff have undergone the training of fire safety & handling of firefighting equipment from the date of joining? (Please verify with records)",
                    "Whether mock drill for fire fighting is conducted at least once in a year? Verify the record of mock drill.",
                    "Is the Warehouse Manager/ Supervisor of the WSP trained in handling warehousing operations, specifically for MCXCCL? Is the skill enhancement training given to the staff in an interval of 6 months? Verify the training record.",
                    "Whether the security personnel have undergone training on fire safety & handling of firefighting equipment from the date of joining? (verify with records and frequency) Mention the name of the official by whom training is provided. Is the follow up training provided on annual basis to the warehouse staff by the WSP?",
                    "Is the arrangement for Prophylactic Measures for Pest Control available at the WH as per WDRA guidelines? (Verify the records of the treatment)",
                    "Is anti-termite treatment at cotton bales warehouses conducted through MCXCCL specified agencies? (Verify the records of the treatment).",
                    "Whether Live Electricity connection found inside the godown where cotton is stored?",
                    "Is the WSP using electricity for weighment purpose only at Mentha oil and metals at warehouses?",
                    "Whether Storage of hazardous Stock (Like fertilizer, Cement, Chemical etc.) in warehouse premises is done that may affect exchange deliverable stock?",
                    "Whether LPG cylinder kept inside warehouse or outside warehouse? (Applicable for Mentha oil)",
                    "Availability of functional, Valid and calibrated weighbridge (Inside / Outside complex)-for base metals – 3 /5 MT capacity (Yes/No) Name of weighbridge/manual weigh scale –WB capacity (MT)- Expiry date of calibration A B C",
                    "Is a written consent of client and approval from MCXCCL sought in case weighment of the commodity is done on any other weighbridge when MCXCCL approved weighbridges are non-functional?",
                    "Whether the list of weighbridge (accredited weighbridge for cotton bales) along with calibration certificate displayed in the warehouse?",
                    "Whether periodic stock audit done by Independent team other than of the same warehouse deployed staffs? (verify with visitor register at the warehouse)",
                    "Whether the storage structure (warehouse) is far away (150 meter) from the source of fire-hazard, such as timber stores, petrol/CNG/PNG pumping stations/LPG bottling plant?"
                ];
                questions.forEach((q, i) => {
                    form.innerHTML += `
                        <div class="mb-4">
                            <label class="block text-gray-800 font-medium mb-2">${i + 1}. ${q} <span class="mandatory-star">*</span></label>
                            <div class="flex space-x-4 mb-2">
                                <label><input type="radio" name="q${i}" value="Yes" required> Yes</label>
                                <label><input type="radio" name="q${i}" value="No"> No</label>
                            </div>
                            <input type="text" id="remarks${i}" class="w-full p-2.5 border border-gray-300 rounded-lg" placeholder="Remarks">
                        </div>
                    `;
                });
                form.innerHTML += `
                    <button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button>
                    <button type="button" id="edit-section" class="w-full bg-gray-300 text-gray-800 p-2.5 rounded-lg mt-2 hidden">Edit</button>
                `;
                // Populate data
                if (sectionData.questions && sectionData.questions.length === questions.length) {
                    sectionData.questions.forEach((qd, i) => {
                        const radio = document.querySelector(`input[name="q${i}"][value="${qd.answer}"]`);
                        if (radio) radio.checked = true;
                        document.getElementById(`remarks${i}`).value = qd.remarks || '';
                    });
                }
            } else if (section === 'observations_on_warehouse_record_keeping') {
                // document.getElementById('photo-section').classList.add('hidden');
                // document.getElementById('signature-section')?.classList.add('hidden');
                const questions = [
                    "Whether copy of KYD with requisite documents available for all beneficiaries/depositors at warehouse? Mention the names of depositor(s) incase of incomplete documents.",
                    "Are the soft copy/digital signed copy/original DTD with requisite documents available at warehouse? Mention the names of depositors incase of incomplete documents.",
                    "Whether eNWR/E-receipt is generated based on receipt of original DTD/ photo copy/ DTD Digitally signed by the beneficiary client/ depositor?",
                    "Whether the following registers are available and updated at Warehouse or not? Are the records kept in safe custody with lock facility? • Warehouse opening-closing Register • Daily Transaction Register • Complaint Register • Stack wise/Lot wise register Physical/Electronic form • PV Register • Instrument/Equipment Internal Calibration Register • Gate in gate out cum Visitor Register • Spot Rejection Register • Sample register • Incidence records /Notices register • Lien register • Pest control activity register • Key distribution register",
                    "Whether any Overwriting/correction is found in the above Registers? If yes, check whether approval from WSP HO has been obtained or not",
                    "Whether the transaction wise weighbridge receipts for deposit/withdrawal are available at the warehouse or not?",
                    "Whether the Commodity deposits & all required documents along with original delivery orders withdrawal document are available at warehouse or not?",
                    "Whether WSP has taken approval from MCXCCL for storage of partial lot created out of overload of lorry in a demarcated area?",
                    "Whether separate entries are done for Exchange & Non-Exchange stock?",
                    "Whether a copy of updated WSP SOP and warehouse operations manual available at the warehouse?",
                    "Whether the Warehouse is registered under relevant State/ Central Warehousing Authority/Gram Panchyat? If Yes, License copy to be available at warehouse.",
                    "Whether the Warehouse License copy/ WDRA registration copy is available and displayed at the warehouse?",
                    "Whether lot wise beneficiary details and electronic receipts available at the warehouse either in electronic or printed form?",
                    "Whether the valid stocks are as per CCRL/Comris system record?",
                    "Whether warehouse maintains Weighment slip for record for all commodities during inward and outward movement?"
                ];
                questions.forEach((q, i) => {
                    form.innerHTML += `
                        <div class="mb-4">
                            <label class="block text-gray-800 font-medium mb-2">${i + 1}. ${q} <span class="mandatory-star">*</span></label>
                            <div class="flex space-x-4 mb-2">
                                <label><input type="radio" name="q${i}" value="Yes" required> Yes</label>
                                <label><input type="radio" name="q${i}" value="No"> No</label>
                            </div>
                            <input type="text" id="remarks${i}" class="w-full p-2.5 border border-gray-300 rounded-lg" placeholder="Remarks">
                        </div>
                    `;
                });
                form.innerHTML += `
                    <button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button>
                    <button type="button" id="edit-section" class="w-full bg-gray-300 text-gray-800 p-2.5 rounded-lg mt-2 hidden">Edit</button>
                `;
                // Populate data
                if (sectionData.questions && sectionData.questions.length === questions.length) {
                    sectionData.questions.forEach((qd, i) => {
                        const radio = document.querySelector(`input[name="q${i}"][value="${qd.answer}"]`);
                        if (radio) radio.checked = true;
                        document.getElementById(`remarks${i}`).value = qd.remarks || '';
                    });
                }
            } else if (section === 'observations_on_wh_infrastructure') {
                // document.getElementById('photo-section').classList.add('hidden');
                // document.getElementById('signature-section')?.classList.add('hidden');
                const questions = [
                    "Warehouse condition (both internal/external) is in sound and store worthy condition?",
                    "Is there any roof leakage / Infrastructure damage? If Yes, whether the incident record updated with details?",
                    "Whether the warehouse is well-protected by pucca boundary wall / barbed wire fencing?",
                    "Whether warehouse is having good drivable approach road & adequate parking space for vehicles?",
                    "Whether flooring is even without major cracks / crevices/ dampness or required major structural repairing?",
                    "Whether hygiene & cleanliness inside the warehouse & premises and vegetation cleaning surrounding the warehouse maintained? Whether dusting of stock, cleaning of bird droppings on stacks, floor cleaning and any minor/major structural repair conducted on a periodic basis? Is the record of the house keeping maintained?",
                    "Whether any infestation by termites/ white ants and rodents in the buildings and warehouse premises is noticed? Whether annual termite treatment record is maintained at cotton/kapas warehouse? Whether termite treatment certificate is available at cotton/kapas warehouse?",
                    "Whether rat cages are placed inside the warehouse? Whether rodenticides used to control rodents?",
                    "Whether surveillance cameras (CCTV) are installed at the warehouse?",
                    "Whether warehouse maintains 90 days CCTV footage of surveillance? mention the date from which CCTV footage is available.",
                    "Whether the cctv camera positioned towards weighment scale inside the warehouse? Verify the cctv footage.",
                    "Whether Handling equipment available?",
                    "Whether the walls are properly plastered and painted/white washed and are free from cracks and crevices?",
                    "Whether adequate ventilators and air inlets are available? (Mention no. of ventilators and air inlets)",
                    "Whether the WH office is inside the godown? (not acceptable for cotton)",
                    "Mention type of Flooring: Concrete / Stones / Tiles / trimix/ Bricks flooring (Mentha Oil WH) /No flooring/Other",
                    "Whether the warehouse has adequate plinth (elevation from ground level) as per WDRA norm?",
                    "Whether there are adequate arrangements for drainage of rainwater to avoid flooding?",
                    "Whether load bearing capacity certificate available at warehouse? (in case of metal warehouse)",
                    "Whether Sufficient office space available for equipment viz. computers with internet facility, telephone and furniture (table, chairs almirah, etc.)"
                ];
                questions.forEach((q, i) => {
                    form.innerHTML += `
                        <div class="mb-4">
                            <label class="block text-gray-800 font-medium mb-2">${i + 1}. ${q} <span class="mandatory-star">*</span></label>
                            <div class="flex space-x-4 mb-2">
                                <label><input type="radio" name="q${i}" value="Yes" required> Yes</label>
                                <label><input type="radio" name="q${i}" value="No"> No</label>
                            </div>
                            <input type="text" id="remarks${i}" class="w-full p-2.5 border border-gray-300 rounded-lg" placeholder="Remarks">
                        </div>
                    `;
                });
                form.innerHTML += `
                    <button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button>
                    <button type="button" id="edit-section" class="w-full bg-gray-300 text-gray-800 p-2.5 rounded-lg mt-2 hidden">Edit</button>
                `;
                // Populate data
                if (sectionData.questions && sectionData.questions.length === questions.length) {
                    sectionData.questions.forEach((qd, i) => {
                        const radio = document.querySelector(`input[name="q${i}"][value="${qd.answer}"]`);
                        if (radio) radio.checked = true;
                        document.getElementById(`remarks${i}`).value = qd.remarks || '';
                    });
                }
            } else if (section === 'observations_on_quality_operation') {
                // document.getElementById('photo-section').classList.add('hidden');
                // document.getElementById('signature-section')?.classList.add('hidden');
                const questions = [
                    "Is cotton bales moisture meter in working condition or Not? If not then has the same been recorded in incident register available at warehouse?",
                    "Is moisture meter available at warehouse?",
                    "Last calibrated on …………. (dd/mm/yyyy)",
                    "Is inward /outward moisture checked or not? (lot wise moisture record) in case of cotton",
                    "Are necessary sampling details updated on sample tag within one working day? (Name of warehouse, date of sampling, stack no, lot No.)",
                    "Is Reference sample duly sealed & signed by the WH official/in charge?",
                    "Is signature of beneficiary/Client or authorized personal of the client is taken on reference sample?",
                    "Is the sample storage area secure and demarcated? Are the samples kept in rack / pallet / in Almirah or trunk in the sample storage area?",
                    "Whether Reference samples with all relevant details kept in proper custody until the lot is present in the warehouse?",
                    "Is record for courier of samples to the assayer available?",
                    "Do the Goods stored come into direct contact with water or excess moisture which can be detrimental to its usability or quality?"
                ];
                questions.forEach((q, i) => {
                    form.innerHTML += `
                        <div class="mb-4">
                            <label class="block text-gray-800 font-medium mb-2">${i + 1}. ${q} <span class="mandatory-star">*</span></label>
                            <div class="flex space-x-4 mb-2">
                                <label><input type="radio" name="q${i}" value="Yes" required> Yes</label>
                                <label><input type="radio" name="q${i}" value="No"> No</label>
                            </div>
                            <input type="text" id="remarks${i}" class="w-full p-2.5 border border-gray-300 rounded-lg" placeholder="Remarks">
                        </div>
                    `;
                });
                form.innerHTML += `
                    <button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button>
                    <button type="button" id="edit-section" class="w-full bg-gray-300 text-gray-800 p-2.5 rounded-lg mt-2 hidden">Edit</button>
                `;
                // Populate data
                if (sectionData.questions && sectionData.questions.length === questions.length) {
                    sectionData.questions.forEach((qd, i) => {
                        const radio = document.querySelector(`input[name="q${i}"][value="${qd.answer}"]`);
                        if (radio) radio.checked = true;
                        document.getElementById(`remarks${i}`).value = qd.remarks || '';
                    });
                }
            } else if (section === 'checklist_wrt_exchange_circular_mentha_oil') {
                // document.getElementById('photo-section').classList.add('hidden');
                // document.getElementById('signature-section')?.classList.add('hidden');
                const questions = [
                    "Any records available regarding person visits to depositor place for weighing the empty drums?",
                    "Are there any proof / records available stating that the empty drum Weighment is done on calibrated weighbridge or weighing scale?",
                    "Whether the white sticker is non-tearable and non-removable?",
                    "Whether sticker is signed and date mentioned with permanent marker?",
                    "Any Drums accepted without white stickers?",
                    "Whether any record of preliminary testing is available or not?",
                    "Whether the weight of the Mentha Oil in drum is 180 kg Net or within tolerance limit of 1% (i.e. +/- 1.8 Kg) as prescribed in Procedure for dealing with Mentha oil? Check the weight randomly",
                    "Whether the lot numbers are mentioned on drums with permanent marker?",
                    "Whether the drums in same lot are kept together and traceable?",
                    "Whether any record available for revalidation? (If any)",
                    "Is any undertaking taken from the Beneficiary/Client, if required or applicable?",
                    "In case of damaged/leaked drums, whether the drum is changed immediately & record of the same is maintained/updated in incidence register?",
                    "Whether the firm/ company depositing Mentha Oil is registered in the respective local Mandi? (verify the records)"
                ];
                questions.forEach((q, i) => {
                    form.innerHTML += `
                        <div class="mb-4">
                            <label class="block text-gray-800 font-medium mb-2">${i + 1}. ${q} <span class="mandatory-star">*</span></label>
                            <div class="flex space-x-4 mb-2">
                                <label><input type="radio" name="q${i}" value="Yes" required> Yes</label>
                                <label><input type="radio" name="q${i}" value="No"> No</label>
                            </div>
                            <input type="text" id="remarks${i}" class="w-full p-2.5 border border-gray-300 rounded-lg" placeholder="Remarks">
                        </div>
                    `;
                });
                form.innerHTML += `
                    <button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button>
                    <button type="button" id="edit-section" class="w-full bg-gray-300 text-gray-800 p-2.5 rounded-lg mt-2 hidden">Edit</button>
                `;
                // Populate data
                if (sectionData.questions && sectionData.questions.length === questions.length) {
                    sectionData.questions.forEach((qd, i) => {
                        const radio = document.querySelector(`input[name="q${i}"][value="${qd.answer}"]`);
                        if (radio) radio.checked = true;
                        document.getElementById(`remarks${i}`).value = qd.remarks || '';
                    });
                }
            } else if (section === 'checklist_wrt_mcxCCL_circular_metal') {
                // document.getElementById('photo-section').classList.add('hidden');
                // document.getElementById('signature-section')?.classList.add('hidden');
                const questions = [
                    "Whether the Certificate of Analysis (CoA) of the producer at the time of deposits with containing details like Brand name of the associated lots, Producer’s name, Batch No & certificate date been collected by warehouse?",
                    "Whether the packing list for deposited goods are available as per the latest circular or not with following details; - Contains net weight - Contains gross weight - Contains batch no - No. of units in bundles/lot.",
                    "Whether the copy of Invoice available for all deposits?",
                    "Whether the copy of Certificate of Origin and Custom clearance documents are available in case of Imported goods or not?",
                    "Whether the producer’s sticker is available or not on each ingots/ bundle?",
                    "Whether the following details are mentioned in sticker or not? • Producer/ manufacturer name • Net Weight • Batch No (printed/sticker/stenciled/laser?) • Purity • Date of Manufacturing/ Production • Number of Pieces of Ingots/ sheets in each bundle",
                    "Whether batch number/lot number is hand written?",
                    "Whether the Ingots/ bundle are physically sound and free of harmful/ any defects? (such as segregation, piping, spilt /broken, inclusions or visible contamination of metal)",
                    "Whether mixing of bundle(s) of different brands are observed?",
                    "Whether the annual Inspection of electrical points done or not? Check the record.",
                    "In case, more than 1 strap is broken, whether re-strapping is done every 07 working days from the date of strap broken & record of the strap break and re-strapping is maintained? In incidence register?",
                    "Same commodity non-exchange goods shall not be kept mingled in the same warehouse which is used for MCXCCL purposes.",
                    "Whether all re-mated stock physically delivered from the warehouse and not stored as non-exchange/professional goods.",
                    "Is there any sign of corrosion in stored stocks?"
                ];
                questions.forEach((q, i) => {
                    form.innerHTML += `
                        <div class="mb-4">
                            <label class="block text-gray-800 font-medium mb-2">${i + 1}. ${q} <span class="mandatory-star">*</span></label>
                            <div class="flex space-x-4 mb-2">
                                <label><input type="radio" name="q${i}" value="Yes" required> Yes</label>
                                <label><input type="radio" name="q${i}" value="No"> No</label>
                            </div>
                            <input type="text" id="remarks${i}" class="w-full p-2.5 border border-gray-300 rounded-lg" placeholder="Remarks">
                        </div>
                    `;
                });
                form.innerHTML += `
                    <button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button>
                    <button type="button" id="edit-section" class="w-full bg-gray-300 text-gray-800 p-2.5 rounded-lg mt-2 hidden">Edit</button>
                `;
                // Populate data
                if (sectionData.questions && sectionData.questions.length === questions.length) {
                    sectionData.questions.forEach((qd, i) => {
                        const radio = document.querySelector(`input[name="q${i}"][value="${qd.answer}"]`);
                        if (radio) radio.checked = true;
                        document.getElementById(`remarks${i}`).value = qd.remarks || '';
                    });
                }
            } else if (section === 'checklist_wrt_mcxCCL_circular_cotton_bales') {
                // document.getElementById('photo-section').classList.add('hidden');
                // document.getElementById('signature-section')?.classList.add('hidden');
                const questions = [
                    "Whether bales have all the proper markings in the form of unique press running number (PRN) Whether every bale has a label giving details of variety weight, crop year when checked randomly? And any other details as may be required from time to time? Does each bale have a label / sticker giving the bale number in figures along with ginner details?",
                    "Whether warehouse has put in a deposit stamp / sticker, containing the date of deposit of the goods on each bale deposited?",
                    "Forklift – battery operated or fuel operated?",
                    "Placement of the Firefighting equipment? Inside the godown or outside? (Placement inside the godown is not allowed)",
                    "Proximity to source of fire hazard if any. whether any fire-risk is noticed in close vicinity of the warehouse? Mention the approximate distance of source of fire risk.",
                    "Whether cotton samples are stored inside the godown?",
                    "Whether opening and closing of cotton godown is done under supervision of Warehouse Manager and the register maintained indicating the purpose of opening and date and time of opening/closing?",
                    "In case, more than 3 straps of bales are broken, whether re-strapping of the bales is done within 10 working days from the date of strap broken & record of the strap break and re-strapping is maintained? In incidence register?"
                ];
                questions.forEach((q, i) => {
                    form.innerHTML += `
                        <div class="mb-4">
                            <label class="block text-gray-800 font-medium mb-2">${i + 1}. ${q} <span class="mandatory-star">*</span></label>
                            <div class="flex space-x-4 mb-2">
                                <label><input type="radio" name="q${i}" value="Yes" required> Yes</label>
                                <label><input type="radio" name="q${i}" value="No"> No</label>
                            </div>
                            <input type="text" id="remarks${i}" class="w-full p-2.5 border border-gray-300 rounded-lg" placeholder="Remarks">
                        </div>
                    `;
                });
                form.innerHTML += `
                    <button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button>
                    <button type="button" id="edit-section" class="w-full bg-gray-300 text-gray-800 p-2.5 rounded-lg mt-2 hidden">Edit</button>
                `;
                // Populate data
                if (sectionData.questions && sectionData.questions.length === questions.length) {
                    sectionData.questions.forEach((qd, i) => {
                        const radio = document.querySelector(`input[name="q${i}"][value="${qd.answer}"]`);
                        if (radio) radio.checked = true;
                        document.getElementById(`remarks${i}`).value = qd.remarks || '';
                    });
                }
            } 
            // --- SIGNATURE SECTION ---
            else if (section === 'signature') {
                const sectionForm = document.getElementById('section-form');
                if (sectionForm) sectionForm.classList.add('hidden');
                // document.getElementById('section-form').innerHTML = '';
                document.getElementById('signature-section').classList.remove('hidden');
                document.getElementById('photo-section').classList.add('hidden');

                const canvas = document.getElementById('signature-canvas');
                // Dynamically resize the signature canvas based on screen
                function resizeSignatureCanvas() {
                    const ratio = Math.max(window.devicePixelRatio || 1, 1);
                    const canvasContainerWidth = Math.min(window.innerWidth * 0.9, 500);
                    const canvasContainerHeight = Math.min(window.innerHeight * 0.35, 300);
                    canvas.width = canvasContainerWidth * ratio;
                    canvas.height = canvasContainerHeight * ratio;
                    canvas.style.width = `${canvasContainerWidth}px`;
                    canvas.style.height = `${canvasContainerHeight}px`;
                    const ctx = canvas.getContext('2d');
                    ctx.scale(ratio, ratio);
                }
                resizeSignatureCanvas();
                window.addEventListener('resize', resizeSignatureCanvas);

                const ctx = canvas.getContext('2d');
                let isDrawing = false;

                // Common drawing function
                const draw = (x, y) => {
                    if (!isDrawing) return;
                    ctx.lineTo(x, y);
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.stroke();
                };

                // Mouse events (Laptop/Desktop)
                canvas.onmousedown = e => {
                    isDrawing = true;
                    ctx.beginPath();
                    ctx.moveTo(e.offsetX, e.offsetY);
                };
                canvas.onmousemove = e => draw(e.offsetX, e.offsetY);
                canvas.onmouseup = () => (isDrawing = false);
                canvas.onmouseout = () => (isDrawing = false);

                // ✅ Touch events (Mobile)
                canvas.addEventListener('touchstart', e => {
                    e.preventDefault();
                    const rect = canvas.getBoundingClientRect();
                    const touch = e.touches[0];
                    isDrawing = true;
                    ctx.beginPath();
                    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
                });

                canvas.addEventListener('touchmove', e => {
                    e.preventDefault();
                    if (!isDrawing) return;
                    const rect = canvas.getBoundingClientRect();
                    const touch = e.touches[0];
                    draw(touch.clientX - rect.left, touch.clientY - rect.top);
                });

                canvas.addEventListener('touchend', () => (isDrawing = false));

                document.getElementById('clear-signature').onclick = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                };

                document.getElementById('save-signature').onclick = async () => {
                    const token = localStorage.getItem('access_token');
                    const dataUrl = canvas.toDataURL('image/png');
                    const date = new Date().toISOString().split('T')[0];
                    try {
                    const res = await fetch(`${API_BASE_URL}/api/save-section`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ section: 'signature', data: { signature: dataUrl }, date })
                    });
                    const text = await res.text();
                    const data = JSON.parse(text);
                    if (!res.ok) return showPopup(data.message || 'Failed to save signature');

                    // mark signature completed and update card
                    updateSectionTick('signature');

                    showPopup('Signature saved successfully', 'success');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    document.getElementById('signature-section').classList.add('hidden');
                    document.getElementById('back-to-dashboard').click();

                    } catch (err) {
                    showPopup('Error: ' + err.message);
                    }
                };
            }
            // --- PHOTO SECTION ---
            else if (section === 'photo') {
                const sectionForm = document.getElementById('section-form');
                if (sectionForm) sectionForm.classList.add('hidden');

                let mapsUrl = ""; // ✅ declare globally for photo section

                // document.getElementById('section-form').innerHTML = '';
                document.getElementById('photo-section').classList.remove('hidden');
                document.getElementById('signature-section').classList.add('hidden');

                const video = document.getElementById('video');
                const canvas = document.getElementById('photo-canvas');
                const ctx = canvas.getContext('2d');
                const takePhotoButton = document.getElementById('take-photo');
                const retakeButton = document.getElementById('retake-photo');
                const saveButton = document.getElementById('save-photo');

                // ✅ Add Location Label button dynamically
                let addLabelButton = document.getElementById('add-label');
                if (!addLabelButton) {
                    addLabelButton = document.createElement('button');
                    addLabelButton.id = 'add-label';
                    addLabelButton.textContent = 'Add Location Label';
                    addLabelButton.className =
                    'hidden bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600';
                    document.querySelector('#photo-section .flex').appendChild(addLabelButton);
                }

                // ✅ Clickable overlay for Maps URL
                let mapLinkOverlay = document.getElementById('map-overlay');
                if (!mapLinkOverlay) {
                    mapLinkOverlay = document.createElement('a');
                    mapLinkOverlay.id = 'map-overlay';
                    mapLinkOverlay.target = '_blank';
                    mapLinkOverlay.style.position = 'absolute';
                    mapLinkOverlay.style.bottom = '45px';
                    mapLinkOverlay.style.left = '10px';
                    mapLinkOverlay.style.width = '380px';
                    mapLinkOverlay.style.height = '20px';
                    mapLinkOverlay.style.opacity = '0';
                    mapLinkOverlay.style.cursor = 'pointer';
                    mapLinkOverlay.style.zIndex = '5';
                    document.getElementById('photo-section').appendChild(mapLinkOverlay);
                }
                mapLinkOverlay.style.display = 'none';

                takePhotoButton.disabled = true;

                navigator.mediaDevices
                    .getUserMedia({
                    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
                    })
                    .then((stream) => {
                    video.srcObject = stream;
                    video.onloadedmetadata = () => {
                        video.play().then(() => {
                        takePhotoButton.disabled = false;
                        });
                    };
                    })
                    .catch((err) => showPopup('Camera access denied: ' + err.message));

                // 📸 TAKE PHOTO
                takePhotoButton.onclick = () => {
                    if (video.videoWidth === 0 || video.videoHeight === 0) {
                    showPopup('Camera not ready yet. Please wait.');
                    return;
                    }

                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    video.classList.add('hidden');
                    canvas.classList.remove('hidden');
                    takePhotoButton.classList.add('hidden');
                    retakeButton.classList.remove('hidden');
                    addLabelButton.classList.remove('hidden');
                    saveButton.classList.add('hidden');

                    addLabelButton.textContent = 'Add Location Label';
                    addLabelButton.disabled = false;
                    mapLinkOverlay.style.display = 'none';
                };

                // 🔁 RETAKE
                retakeButton.onclick = () => {
                    video.classList.remove('hidden');
                    canvas.classList.add('hidden');
                    takePhotoButton.classList.remove('hidden');
                    retakeButton.classList.add('hidden');
                    addLabelButton.classList.add('hidden');
                    saveButton.classList.add('hidden');
                    addLabelButton.textContent = 'Add Location Label';
                    addLabelButton.disabled = false;
                    mapLinkOverlay.style.display = 'none';
                };

                // 📍 ADD LOCATION LABEL
                addLabelButton.onclick = async () => {
                    addLabelButton.textContent = 'Fetching location...';
                    addLabelButton.disabled = true;

                    navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        const lat = pos.coords.latitude;
                        const lon = pos.coords.longitude;

                        try {
                        const apiUrl = `${API_BASE_URL}/api/get-location?lat=${lat}&lon=${lon}`;
                        const res = await fetch(apiUrl);
                        const data = await res.json();
                        console.log('📍 Location data:', data);

                        const address = data.plus_code || 'Address not found';
                        mapsUrl = data.maps_url || '';
                        const timestamp = new Date().toLocaleString();

                        // ✅ Proper readable label layout
                        const labelLines = [
                            `📍 ${lat.toFixed(5)}, ${lon.toFixed(5)}`,
                            `🏠 ${address}`,
                            `🌍 ${mapsUrl ? mapsUrl : 'Maps URL unavailable'}`,
                            `🕒 ${timestamp}`,
                        ];

                        const boxHeight = 110;
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                        ctx.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);

                        ctx.fillStyle = 'white';
                        ctx.font = '16px Arial';
                        ctx.textBaseline = 'top';
                        const startY = canvas.height - boxHeight + 10;

                        labelLines.forEach((line, i) => {
                            // If the line is too long, truncate for readability
                            let text = line.length > 70 ? line.slice(0, 67) + '...' : line;
                            ctx.fillText(text, 10, startY + i * 22);
                        });

                        // ✅ clickable maps overlay
                        if (mapsUrl) {
                            mapLinkOverlay.href = mapsUrl;
                            mapLinkOverlay.style.display = 'block';
                        }

                        addLabelButton.textContent = 'Label Added ✅';
                        saveButton.classList.remove('hidden');
                        } catch (err) {
                        showPopup('Failed to fetch location: ' + err.message);
                        addLabelButton.textContent = 'Add Location Label';
                        addLabelButton.disabled = false;
                        }
                    },
                    (err) => {
                        showPopup('Location access denied: ' + err.message);
                        addLabelButton.textContent = 'Add Location Label';
                        addLabelButton.disabled = false;
                    }
                    );
                };

                // 💾 SAVE PHOTO
                saveButton.onclick = async () => {
                    const token = localStorage.getItem('access_token');
                    const dataUrl = canvas.toDataURL('image/png');
                    const date = new Date().toISOString().split('T')[0];

                    try {
                    const res = await fetch(`${API_BASE_URL}/api/save-section`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ section: 'photo', data: { photo: dataUrl, maps_url: mapsUrl }, date }),
                    });

                    const text = await res.text();
                    const data = JSON.parse(text);
                    if (!res.ok) return showPopup(data.message || 'Failed to save photo');

                    // showPopup('Photo saved successfully', 'success');

                    if (video.srcObject) {
                        video.srcObject.getTracks().forEach((t) => t.stop());
                        video.srcObject = null;
                    }

                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    video.classList.remove('hidden');
                    canvas.classList.add('hidden');
                    takePhotoButton.classList.remove('hidden');
                    retakeButton.classList.add('hidden');
                    addLabelButton.classList.add('hidden');
                    saveButton.classList.add('hidden');
                    mapLinkOverlay.style.display = 'none';

                    // mark photo completed and update card
                    updateSectionTick('photo');

                    showPopup('Photo saved successfully', 'success');
                    
                    document.getElementById('photo-section').classList.add('hidden');
                    document.getElementById('back-to-dashboard').click();

                    } catch (err) {
                    showPopup('Error: ' + err.message);
                    }
                };
                }
             else {
                form.innerHTML = `
                    <p class="text-gray-600">Placeholder for future questions.</p>
                    <button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button>
                    <button type="button" id="edit-section" class="w-full bg-gray-300 text-gray-800 p-2.5 rounded-lg mt-2 hidden">Edit</button>
                `;
            }

            // Handle saved state
            isSaved = completionStatus[section] || false;
            const allInputs = form.querySelectorAll('input, select, textarea');
            if (isSaved) {
                allInputs.forEach(inp => inp.disabled = true);
                const saveButton = document.getElementById('save-section');
                const editButton = document.getElementById('edit-section');
                if (saveButton) saveButton.classList.add('hidden');
                if (editButton) editButton.classList.remove('hidden');
            }

            // Edit button
            const editButton = document.getElementById('edit-section');
            if (editButton) {
                editButton.onclick = () => {
                    allInputs.forEach(inp => inp.disabled = false);
                    const saveButton = document.getElementById('save-section');
                    if (saveButton) saveButton.classList.remove('hidden');
                    editButton.classList.add('hidden');
                };
            }

            const saveButton = document.getElementById('save-section');
            if (saveButton) {
                saveButton.onclick = () => saveSection(section);
            }
        } catch (err) {
            console.error(`Load section ${section} error:`, err);
            showPopup('Error: ' + err.message);
        }
    }

    async function saveSection(section) {
        const token = localStorage.getItem('access_token');
        const data = {};
        let validationErrors = [];

        if (section === 'general_report') {
            const auditDate = document.getElementById('audit_date').value;
            const deliveryCentre = document.getElementById('delivery_centre').value;
            const timeIn = document.getElementById('time_in').value;
            const timeOut = document.getElementById('time_out').value;
            const workingHours = document.getElementById('working_hours').value;
            const warehouseAddress = document.getElementById('warehouse_address').value;
            const warehouseName = document.getElementById('warehouse_name').value;
            const auditorName = document.getElementById('auditor_name').value;
            const warehouseManagerName = document.getElementById('warehouse_manager_name').value;
            const previousAuditDate = document.getElementById('previous_audit_date').value;
            const previousAuditorName = document.getElementById('previous_auditor_name').value;
            const previousAuditorType = document.getElementById('previous_auditor_type').value;
            const agencyName = document.getElementById('agency_name').value || '';
            const warehouseCapacity = document.getElementById('warehouse_capacity').value;
            const capacityUtilization = document.getElementById('capacity_utilization').value;

            if (!auditDate || !deliveryCentre || !timeIn || !timeOut || !workingHours || !warehouseAddress || !warehouseName || !auditorName || !warehouseManagerName || !previousAuditDate || !previousAuditorName || !previousAuditorType || !warehouseCapacity || !capacityUtilization) {
                validationErrors.push("All questions are mandatory. Please complete all fields before saving.");
            }
            if (previousAuditorType === 'External' && !agencyName) {
                validationErrors.push("Agency Name is mandatory for External auditor type.");
            }

            data.audit_date = auditDate;
            data.delivery_centre = deliveryCentre;
            data.time_in = timeIn;
            data.time_out = timeOut;
            data.working_hours = workingHours;
            data.warehouse_address = warehouseAddress;
            data.warehouse_name = warehouseName;
            data.auditor_name = auditorName;
            data.warehouse_manager_name = warehouseManagerName;
            data.previous_audit_date = previousAuditDate;
            data.previous_auditor_name = previousAuditorName;
            data.previous_auditor_type = previousAuditorType;
            data.agency_name = agencyName;
            data.warehouse_capacity = parseFloat(warehouseCapacity);
            data.capacity_utilization = parseFloat(capacityUtilization);
        } 
        // ---------- SAVE: STOCK RECONCILIATION ----------
        else if (section === 'stock_reconciliation') {
            data.commodities = [];
            const commodityList = document.getElementById('commodity-list');
            if (!commodityList) {
                validationErrors.push("No commodity rows found.");
            } else {
                const cards = Array.from(commodityList.children);
                if (cards.length === 0) {
                    validationErrors.push("Please add at least one commodity row before saving.");
                } else {
                    cards.forEach((card, idx) => {
                        const idSuffix = card.id.split('commodity-card-')[1]; // index assigned when created
                        // if idSuffix missing, fallback to idx+1
                        const suf = idSuffix || (idx + 1);
                        const sel = document.getElementById(`commodity-select-${suf}`);
                        const reg = document.getElementById(`qty-registered-${suf}`);
                        const phy = document.getElementById(`qty-physical-${suf}`);
                        const diff = document.getElementById(`difference-${suf}`);
                        const rem = document.getElementById(`remarks-${suf}`);

                        const commodity = sel ? sel.value.trim() : '';
                        const qtyRegisteredRaw = reg ? reg.value.trim() : '';
                        const qtyPhysicalRaw = phy ? phy.value.trim() : '';
                        const qtyRegistered = qtyRegisteredRaw === '' ? null : parseFloat(qtyRegisteredRaw);
                        const qtyPhysical = qtyPhysicalRaw === '' ? null : parseFloat(qtyPhysicalRaw);

                        if (!commodity) {
                            validationErrors.push(`Commodity is required for row ${idx + 1}.`);
                        }
                        if (qtyRegisteredRaw === '' || isNaN(qtyRegistered)) {
                            validationErrors.push(`Quantity as per Registered is required and must be numeric for row ${idx + 1}.`);
                        }
                        if (qtyPhysicalRaw === '' || isNaN(qtyPhysical)) {
                            validationErrors.push(`Quantity as per Physical is required and must be numeric for row ${idx + 1}.`);
                        }

                        const difference = (qtyRegistered !== null && qtyPhysical !== null) ? (qtyRegistered - qtyPhysical) : null;

                        data.commodities.push({
                            commodity,
                            qty_registered: qtyRegistered,
                            qty_physical: qtyPhysical,
                            difference,
                            remarks: (rem && rem.value) ? rem.value.trim() : ''
                        });
                    });
                }
            }
        }
        else if (section === 'observations_on_stacking' || section === 'observations_on_warehouse_operations' || section === 'observations_on_warehouse_record_keeping' || section === 'observations_on_wh_infrastructure' || section === 'observations_on_quality_operation' || section === 'checklist_wrt_exchange_circular_mentha_oil' || section === 'checklist_wrt_mcxCCL_circular_metal' || section === 'checklist_wrt_mcxCCL_circular_cotton_bales') {
            data.questions = [];
            const remarksInputs = document.querySelectorAll('[id^="remarks"]');
            let allAnswered = true;
            remarksInputs.forEach((input, i) => {
                const radios = document.querySelectorAll(`input[name="q${i}"]`);
                const questionLabel = input.parentElement.querySelector('label.block');
                let answer = '';
                let isAnswered = false;
                radios.forEach(r => { if (r.checked) { answer = r.value; isAnswered = true; } });
                const remarks = input.value;
                if (!isAnswered) allAnswered = false;
                if (answer === 'No' && !remarks) {
                    validationErrors.push(`Remarks are required for all questions answered as 'No'.`);
                }
                const questionText = questionLabel.innerText.replace(/^\d+\.\s/, '').replace(/\s\*$/, '');
                data.questions.push({ question: questionText, answer, remarks });
            });
            if (!allAnswered) {
                validationErrors.push("All questions are mandatory. Please complete all fields before saving.");
            }
        }

        if (validationErrors.length > 0) {
            showPopup(validationErrors.join("\n"));
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/save-section`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ section, data, date: new Date().toISOString().split('T')[0] })
            });
            const text = await res.text();
            console.log(`Save-section ${section} response:`, { status: res.status, body: text });

            let dataRes;
            try {
                dataRes = JSON.parse(text);
            } catch {
                console.error(`Failed to parse /save-section/${section} response:`, text);
                showPopup('Failed to save section: Invalid server response');
                return;
            }

            if (!res.ok) {
                showPopup(dataRes.message || `Failed to save ${section}`);
                return;
            }

            // update memory + UI immediately
            updateSectionTick(section);

            // show success popup
            showPopup("Data Saved Successfully ✅", "success");

            // go back to dashboard view
            document.getElementById('back-to-dashboard')?.click();

        } catch (err) {
            console.error(`Save section ${section} error:`, err);
            showPopup('Error: ' + err.message);
        }
    }

    document.getElementById('logout').addEventListener('click', () => {
    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = "fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50";

    const modal = document.createElement('div');
    modal.className = "bg-white p-6 rounded-xl shadow-lg text-center w-80";
    modal.innerHTML = `
        <h2 class="text-lg font-semibold mb-3 text-gray-800">Do you want to logout?</h2>
        <div class="flex justify-center gap-4 mt-4">
            <button id="confirm-logout" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">Yes</button>
            <button id="cancel-logout" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">No</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('cancel-logout').onclick = () => overlay.remove();

    document.getElementById('confirm-logout').onclick = async () => {
        const token = localStorage.getItem('access_token');
        try {
            await fetch(`${API_BASE_URL}/api/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (err) {
            console.warn('Logout API error:', err);
        }

        localStorage.removeItem('access_token');
        localStorage.removeItem('completionStatus');

        // ✅ No success popup — directly redirect
        isNavigatingInternally = true;
        overlay.remove();
        window.location.href = "/static/login.html";
    };
});

}


window.addEventListener("beforeunload", function (e) {
    const nextURL = document.activeElement?.href || ""; // where user is clicking to go
    const isInternal = nextURL.includes("/static/"); // check if internal navigation

    if (isNavigatingInternally || isInternal) {
        // ✅ Skip confirmation if internal page navigation
        return;
    }

    if (!isExitConfirmed) {
        e.preventDefault();
        e.returnValue = "";
        showExitModal();
        return "";
    }
});


function showExitModal() {
    // Avoid multiple popups
    if (document.getElementById('exit-modal')) return;

    const overlay = document.createElement('div');
    overlay.id = 'exit-modal';
    overlay.className = "fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50";

    const modal = document.createElement('div');
    modal.className = "bg-white p-6 rounded-xl shadow-lg text-center w-80";
    modal.innerHTML = `
        <h2 class="text-lg font-semibold mb-3 text-gray-800">Do you want to exit the application?</h2>
        <div class="flex justify-center gap-4 mt-4">
            <button id="confirm-exit" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">Yes</button>
            <button id="cancel-exit" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">No</button>
        </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById('cancel-exit').onclick = () => overlay.remove();

    document.getElementById('confirm-exit').onclick = () => {
        isExitConfirmed = true;
        overlay.remove();
        window.location.href = "about:blank"; // Exit or redirect
    };
}

// 🟦 Sidebar toggle
const menuIcon = document.getElementById('menu-icon');
const sidebar = document.getElementById('sidebar');
const closeSidebar = document.getElementById('close-sidebar');

menuIcon.onclick = () => {
    sidebar.classList.remove('-translate-x-full');
};
closeSidebar.onclick = () => {
    sidebar.classList.add('-translate-x-full');
};

// 🟩 Navigation actions
document.getElementById('nav-checklist').onclick = () => {
    sidebar.classList.add('-translate-x-full');
    document.getElementById('send-email-section').classList.add('hidden');
    document.getElementById('section-list').classList.remove('hidden');

    document.getElementById('submit-audit')?.classList.remove('hidden');
    document.getElementById('export-excel')?.classList.remove('hidden');

};

document.getElementById('nav-send-email').onclick = () => {
    sidebar.classList.add('-translate-x-full');
    document.getElementById('section-list').classList.add('hidden');
    document.getElementById('send-email-section').classList.remove('hidden');

    // 🔒 Hide Submit and Export buttons when viewing Send Email section
    document.getElementById('submit-audit')?.classList.add('hidden');
    document.getElementById('export-excel')?.classList.add('hidden');
};


const sendEmailForm = document.getElementById('send-email-form');
if (sendEmailForm) {
    sendEmailForm.onsubmit = async (e) => {
        e.preventDefault();

        const token = localStorage.getItem('access_token');
        if (!token) return showPopup('Please login first.', 'warning');

        const to = document.getElementById('email-to').value.trim();
        const fileInput = document.getElementById('email-file');
        const sendBtn = sendEmailForm.querySelector('button[type="submit"]');

        if (fileInput.files.length === 0) {
            showPopup('Please upload a PDF file.', 'warning');
            return;
        }

        // 🌀 Step 1: Add "Sending..." state
        sendBtn.disabled = true;
        const originalText = sendBtn.textContent;
        sendBtn.textContent = "Sending Email...";

        const formData = new FormData();
        formData.append('to_email', to);
        formData.append('attachment', fileInput.files[0]);

        try {
            const res = await fetch(`${API_BASE_URL}/api/send-email`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const text = await res.text();
            let data = {};
            try { data = JSON.parse(text); } catch {}

            // 🧾 Step 2: Restore button + show popup
            sendBtn.disabled = false;
            sendBtn.textContent = originalText;

            if (!res.ok) {
                showPopup(data.message || 'Failed to send email', 'error');
                return;
            }

            // ✅ Step 3: Clear form fields after success
            document.getElementById('email-to').value = '';
            document.getElementById('email-file').value = '';

            // 🎉 Step 4: Success popup
            showPopup('Email sent successfully ✅', 'success');

        } catch (err) {
            sendBtn.disabled = false;
            sendBtn.textContent = originalText;
            showPopup('Error sending email: ' + err.message, 'error');
        }
    };
}

document.addEventListener("DOMContentLoaded", () => {
    const goRegister = document.getElementById("go-register");
    const goLogin = document.getElementById("go-login");

    if (goRegister) {
        goRegister.addEventListener("click", (e) => {
            e.preventDefault();
            isNavigatingInternally = true;
            window.location.href = "/static/register.html";
        });
    }

    if (goLogin) {
        goLogin.addEventListener("click", (e) => {
            e.preventDefault();
            isNavigatingInternally = true;
            window.location.href = "/static/login.html";
        });
    }
});


function updateButtonVisibility(isDashboard) {
    const submitButton = document.getElementById('submit-audit');
    const exportButton = document.getElementById('export-excel'); // Ensure this matches your HTML ID
    if (submitButton) submitButton.classList.toggle('hidden', !isDashboard);
    if (exportButton) exportButton.classList.toggle('hidden', !isDashboard);
}

// ✅ Ensure button visibility is consistent on page load and navigation
document.addEventListener("DOMContentLoaded", () => {
    const submitBtn = document.getElementById('submit-audit');
    const exportBtn = document.getElementById('export-excel');
    const sectionList = document.getElementById('section-list');
    const sectionContent = document.getElementById('section-content');
    const sendEmailSection = document.getElementById('send-email-section');

    // function updateButtons() {
    //     const isDashboardVisible =
    //         !sectionList.classList.contains('hidden') &&
    //         sectionContent.classList.contains('hidden') &&
    //         sendEmailSection.classList.contains('hidden');

    //     if (submitBtn) submitBtn.classList.toggle('hidden', !isDashboardVisible);
    //     if (exportBtn) exportBtn.classList.toggle('hidden', !isDashboardVisible);
    // }


    // Run on load and on navigation
    document.addEventListener("DOMContentLoaded", updateButtons);
    document.body.addEventListener("click", (e) => {
        const id = e.target.id || e.target.closest("button")?.id || "";
        if (id === "back-to-dashboard" || id === "nav-checklist" || id === "nav-send-email" || id.startsWith("section-")) {
            setTimeout(updateButtons, 400); // Delay for UI transition
        }
    });

    // Run once on load
    updateButtons();

    // Listen for clicks that change sections
    document.body.addEventListener("click", (e) => {
        const id = e.target.id || e.target.closest("button")?.id || "";
        if (
            id === "back-to-dashboard" ||
            id === "nav-checklist" ||
            id === "nav-send-email" ||
            id.startsWith("section-")
        ) {
            setTimeout(updateButtons, 400); // delay for UI transition
        }
    });
});
