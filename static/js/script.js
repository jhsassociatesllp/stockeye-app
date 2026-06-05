// const API_BASE_URL = "http://localhost:8000";

let API_BASE_URL = "";
let completionStatus = {};
let isExitConfirmed = false;
let isNavigatingInternally = false;
let userRole = 'user';

if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    API_BASE_URL = "http://localhost:8000";
} else {
    API_BASE_URL = `${window.location.origin}`;
}

document.addEventListener("DOMContentLoaded", () => {
    const photoSection = document.getElementById("photo-section");
    const signatureSection = document.getElementById("signature-section");
    if (photoSection) photoSection.classList.add("hidden");
    if (signatureSection) signatureSection.classList.add("hidden");

    // ── Checklist Tab Switching ──
    const checklistTabCurrent = document.getElementById('checklist-tab-current');
    const checklistTabHistory = document.getElementById('checklist-tab-history');
    const checklistCurrentContent = document.getElementById('checklist-current-content');
    const checklistHistoryContent = document.getElementById('checklist-history-content');

    if (checklistTabCurrent && checklistTabHistory) {
        checklistTabCurrent.addEventListener('click', () => {
            checklistTabCurrent.className = 'px-4 py-2 font-semibold text-indigo-600 border-b-2 border-indigo-600 text-sm';
            checklistTabHistory.className = 'px-4 py-2 font-semibold text-gray-500 border-b-2 border-transparent text-sm';
            checklistCurrentContent.classList.remove('hidden');
            checklistHistoryContent.classList.add('hidden');
        });

        checklistTabHistory.addEventListener('click', () => {
            checklistTabHistory.className = 'px-4 py-2 font-semibold text-indigo-600 border-b-2 border-indigo-600 text-sm';
            checklistTabCurrent.className = 'px-4 py-2 font-semibold text-gray-500 border-b-2 border-transparent text-sm';
            checklistHistoryContent.classList.remove('hidden');
            checklistCurrentContent.classList.add('hidden');
            loadChecklistHistory();
        });
    }

    // ── Stock Count Tab Switching ──
    const scTabPending = document.getElementById('sc-tab-pending');
    const scTabCompleted = document.getElementById('sc-tab-completed');
    const scTabHistory = document.getElementById('sc-tab-history');
    const scPendingContent = document.getElementById('sc-pending-content');
    const scCompletedContent = document.getElementById('sc-completed-content');
    const scHistoryContent = document.getElementById('sc-history-content');

    if (scTabPending && scTabCompleted && scTabHistory) {
        scTabPending.addEventListener('click', () => {
            scTabPending.className = 'px-4 py-2 font-semibold text-indigo-600 border-b-2 border-indigo-600 text-sm';
            scTabCompleted.className = 'px-4 py-2 font-semibold text-gray-500 border-b-2 border-transparent text-sm';
            scTabHistory.className = 'px-4 py-2 font-semibold text-gray-500 border-b-2 border-transparent text-sm';
            scPendingContent.classList.remove('hidden');
            scCompletedContent.classList.add('hidden');
            scHistoryContent.classList.add('hidden');
        });

        scTabCompleted.addEventListener('click', () => {
            scTabCompleted.className = 'px-4 py-2 font-semibold text-indigo-600 border-b-2 border-indigo-600 text-sm';
            scTabPending.className = 'px-4 py-2 font-semibold text-gray-500 border-b-2 border-transparent text-sm';
            scTabHistory.className = 'px-4 py-2 font-semibold text-gray-500 border-b-2 border-transparent text-sm';
            scCompletedContent.classList.remove('hidden');
            scPendingContent.classList.add('hidden');
            scHistoryContent.classList.add('hidden');
            loadStockCountHistory('completed');
        });

        scTabHistory.addEventListener('click', () => {
            scTabHistory.className = 'px-4 py-2 font-semibold text-indigo-600 border-b-2 border-indigo-600 text-sm';
            scTabPending.className = 'px-4 py-2 font-semibold text-gray-500 border-b-2 border-transparent text-sm';
            scTabCompleted.className = 'px-4 py-2 font-semibold text-gray-500 border-b-2 border-transparent text-sm';
            scHistoryContent.classList.remove('hidden');
            scPendingContent.classList.add('hidden');
            scCompletedContent.classList.add('hidden');
            loadStockCountHistory('history');
        });
    }
});

function getUserRole(email) {
    const managerKeywords = [
        ['vasu', 'gadde'],
        ['huzefa', 'kaka'],
        ['aditya', 'more']
    ];
    const emailLower = email.toLowerCase();
    for (const keywords of managerKeywords) {
        if (keywords.every(keyword => emailLower.includes(keyword))) return 'manager';
    }
    return 'user';
}

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
            (card.querySelector('div') || card).appendChild(span);
        }
    } else {
        console.warn(`updateSectionTick: card for section "${section}" not found in DOM`);
    }
}

function updateButtons() {
    const checklistContainer = document.getElementById('checklist-container');
    const sectionContent = document.getElementById('section-content');
    const sendEmailSection = document.getElementById('send-email-section');
    const stockCountSection = document.getElementById('stock-count-section');
    const uploadDataSection = document.getElementById('upload-data-section');
    const submitBtn = document.getElementById('submit-audit');
    const exportBtn = document.getElementById('export-excel');

    const isDashboardVisible =
        checklistContainer && !checklistContainer.classList.contains('hidden') &&
        sectionContent && sectionContent.classList.contains('hidden') &&
        (!sendEmailSection || sendEmailSection.classList.contains('hidden')) &&
        (!stockCountSection || stockCountSection.classList.contains('hidden')) &&
        (!uploadDataSection || uploadDataSection.classList.contains('hidden'));

    if (submitBtn) submitBtn.classList.toggle('hidden', !isDashboardVisible);
    if (exportBtn) exportBtn.classList.toggle('hidden', !isDashboardVisible);
}

function showPopup(message, type = "info", autoClose = true, redirect = null) {
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
            const text = await res.text();
            let data = {};
            try { data = JSON.parse(text); } catch { return showPopup("Invalid server response", "error"); }
            if (!res.ok) { showPopup(data.message || "Something went wrong", "error"); return; }
            showPopup("Registration successful! Redirecting to login...", "success");
            isNavigatingInternally = true;
            setTimeout(() => (window.location.href = "/static/login.html"), 1500);
        } catch (err) {
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
            try { data = JSON.parse(text); } catch { return showPopup("Invalid server response", "error"); }
            if (!res.ok) { showPopup(data.message || "Invalid credentials", "error"); return; }
            localStorage.setItem("access_token", data.data.access_token);
            showPopup("Login successful! Redirecting...", "success");
            isNavigatingInternally = true;
            setTimeout(() => (window.location.href = "/static/index.html"), 1500);
        } catch (err) {
            showPopup("Network or server error: " + err.message, "error");
        }
    };
}

function toggleSubmitButton() {
    const isDashboard = !document.getElementById('section-content')?.classList.contains('hidden');
    const submitButton = document.getElementById('submit-audit');
    if (submitButton) submitButton.classList.toggle('hidden', isDashboard);
}

const backToDashboardButton = document.getElementById('back-to-dashboard');
if (backToDashboardButton) {
    backToDashboardButton.onclick = () => {
        document.getElementById('section-content')?.classList.add('hidden');
        document.getElementById('checklist-container')?.classList.remove('hidden');
        document.getElementById('section-list')?.classList.remove('hidden');
        document.getElementById('photo-section').classList.add('hidden');
        document.getElementById('signature-section').classList.add('hidden');
        document.getElementById('send-email-section').classList.add('hidden');
        document.getElementById('stock-count-section')?.classList.add('hidden');
        document.getElementById('upload-data-section')?.classList.add('hidden');
        const video = document.getElementById('video');
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        }
        if (typeof window.loadDashboard === 'function') window.loadDashboard();
        toggleSubmitButton();
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  DASHBOARD & SECTION LOADING
// ─────────────────────────────────────────────────────────────────────────────
if (document.getElementById('section-list')) {
    let sections = [];
    document.addEventListener('DOMContentLoaded', loadDashboard);

    async function loadDashboard(postSubmission = false) {
        const token = localStorage.getItem('access_token');
        if (!token) { window.location.href = '/static/login.html'; return; }

        try {
            const res = await fetch(`${API_BASE_URL}/api/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch {
                showPopup('Failed to load user info: Invalid server response');
                localStorage.removeItem('access_token');
                window.location.href = '/static/login.html';
                return;
            }
            if (!res.ok) {
                localStorage.removeItem('access_token');
                window.location.href = '/static/login.html';
                return;
            }

            document.getElementById('user-info').textContent = `Welcome, ${data.data.name}`;
            userRole = getUserRole(data.data.email);

            try {
                const adminRes = await fetch(`${API_BASE_URL}/api/check-admin`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (adminRes.ok) {
                    const aData = await adminRes.json();
                    const switchAdminBtn = document.getElementById('switch-admin-btn');
                    if (aData.data?.is_admin && switchAdminBtn) {
                        switchAdminBtn.classList.remove('hidden');
                        switchAdminBtn.onclick = () => {
                            const overlay = document.createElement('div');
                            overlay.className = "fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50";
                            const modal = document.createElement('div');
                            modal.className = "bg-white p-6 rounded-xl shadow-lg text-center w-80";
                            modal.innerHTML = `<h2 class="text-lg font-semibold mb-3 text-gray-800">Do you want to switch to Control Panel?</h2><div class="flex justify-center gap-4 mt-4"><button id="confirm-switch" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">Yes</button><button id="cancel-switch" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">No</button></div>`;
                            overlay.appendChild(modal);
                            document.body.appendChild(overlay);
                            document.getElementById('cancel-switch').onclick = () => overlay.remove();
                            document.getElementById('confirm-switch').onclick = () => {
                                isNavigatingInternally = true;
                                window.location.href = '/static/admin.html';
                            };
                        };
                    }
                }
            } catch (e) { }

            const sectionsRes = await fetch(`${API_BASE_URL}/api/get-sections`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const sectionsText = await sectionsRes.text();
            let sectionsData;
            try { sectionsData = JSON.parse(sectionsText); } catch {
                showPopup('Failed to load sections: Invalid server response'); return;
            }
            if (!sectionsRes.ok) { showPopup(sectionsData.message || 'Failed to load sections'); return; }

            const localCompletionStatus = JSON.parse(localStorage.getItem('completionStatus')) || {};
            const serverStatus = sectionsData.data.completion_status || {};
            completionStatus = { ...localCompletionStatus, ...serverStatus };

            sections = [
                'general_report', 'stock_reconciliation',
                'observations_on_stacking', 'observations_on_warehouse_operations',
                'observations_on_warehouse_record_keeping', 'observations_on_wh_infrastructure',
                'observations_on_quality_operation', 'checklist_wrt_exchange_circular_mentha_oil',
                'checklist_wrt_exchange_circular_metal', 'checklist_wrt_exchange_circular_cotton_bales',
                'signature', 'photo'
            ];

            const sectionList = document.getElementById('section-list');
            sectionList.innerHTML = '';
            sections.forEach(section => {
                const card = document.createElement('div');
                card.className = 'section-card bg-white p-4 rounded-lg shadow-md cursor-pointer';
                card.dataset.section = section;
                const title = section.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const isPostSubmission = postSubmission || Object.keys(completionStatus).length === 0;
                card.innerHTML = `
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-medium text-gray-800">${title}</h3>
                        <span class="status-icon">${!isPostSubmission && completionStatus[section] ? '<i class="fas fa-check-circle text-green-500"></i>' : ''}</span>
                    </div>
                `;
                card.onclick = () => loadSection(card.dataset.section);
                sectionList.appendChild(card);
            });
            updateButtons();
            toggleSubmitButton();

            const submitButton = document.getElementById('submit-audit');
            if (submitButton) {
                submitButton.classList.remove('hidden');
                submitButton.onclick = () => {
                    const allCompleted = Object.values(completionStatus).every(v => v === true);
                    if (!allCompleted) { showPopup('Please fill the data for all the sections and save that.'); return; }

                    document.getElementById('confirm-submit-msg').textContent = 'Do you want to submit the Checklist Audit?';
                    const confirmModal = document.getElementById('confirm-submit-modal');
                    confirmModal.classList.remove('hidden');

                    document.getElementById('btn-submit-no').onclick = () => confirmModal.classList.add('hidden');
                    document.getElementById('btn-submit-yes').onclick = async () => {
                        confirmModal.classList.add('hidden');
                        try {
                            const res = await fetch(`${API_BASE_URL}/api/submit-audit`, {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({})
                            });
                            const text = await res.text();
                            let dataRes;
                            try { dataRes = JSON.parse(text); } catch { showPopup('Failed to submit audit: Invalid server response'); return; }
                            if (!res.ok) { showPopup(dataRes.message || 'Failed to submit audit'); return; }
                            showPopup('Audit submitted successfully ✅', 'success');
                            completionStatus = {};
                            localStorage.removeItem('completionStatus');
                            await clearAllSectionData();
                            await loadDashboard(true);
                            openEmailModal('checklist');
                        } catch (err) { showPopup('Error: ' + err.message); }
                    };
                };
            }
            toggleSubmitButton();
        } catch (err) { showPopup('Error: ' + err.message); }
    }

    const exportBtn = document.getElementById('export-excel');
    if (exportBtn) {
        exportBtn.onclick = async () => {
            const token = localStorage.getItem('access_token');
            if (!token) { showPopup('Please login again before exporting.', 'warning'); return; }
            exportBtn.disabled = true;
            exportBtn.textContent = 'Checking...';
            try {
                const resSections = await fetch(`${API_BASE_URL}/api/get-sections`, { headers: { 'Authorization': `Bearer ${token}` } });
                const text = await resSections.text();
                let data = {};
                try { data = JSON.parse(text); } catch { data = {}; }
                if (!resSections.ok) { showPopup(data.message || 'Unable to validate sections.', 'error'); exportBtn.disabled = false; exportBtn.textContent = 'Export to Excel'; return; }
                const completion = data.data?.completion_status || {};
                const allCompleted = Object.values(completion).every(v => v === true);
                if (!allCompleted) { showPopup('Please complete all sections before exporting.', 'warning'); exportBtn.disabled = false; exportBtn.textContent = 'Export to Excel'; return; }
                exportBtn.textContent = 'Preparing Excel file...';
                const res = await fetch(`${API_BASE_URL}/api/export-excel`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
                if (!res.ok) { let msg = await res.text(); try { msg = JSON.parse(msg).message; } catch { } showPopup(msg || 'Failed to export file.', 'error'); exportBtn.disabled = false; exportBtn.textContent = 'Export to Excel'; return; }
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'Audit_Report.xlsx';
                document.body.appendChild(a); a.click(); a.remove();
                window.URL.revokeObjectURL(url);
                showPopup('Download started successfully.', 'success');
            } catch (err) { showPopup('Error exporting: ' + err.message, 'error'); }
            finally { exportBtn.disabled = false; exportBtn.textContent = 'Export to Excel'; }
        };
    }

    window.loadDashboard = loadDashboard;

    async function loadSection(section) {
        const sectionForm = document.getElementById('section-form');
        if (sectionForm) { sectionForm.innerHTML = '<p class="text-gray-600">Loading...</p>'; sectionForm.classList.remove('hidden'); }
        const token = localStorage.getItem('access_token');
        document.getElementById('section-list')?.classList.add('hidden');
        document.getElementById('section-content')?.classList.remove('hidden');
        document.getElementById('submit-audit')?.classList.add('hidden');
        document.getElementById('export-excel')?.classList.add('hidden');
        const photoSection = document.getElementById('photo-section');
        const signatureSection = document.getElementById('signature-section');
        if (photoSection) photoSection.classList.add('hidden');
        if (signatureSection) signatureSection.classList.add('hidden');
        const video = document.getElementById('video');
        if (video && video.srcObject) { video.srcObject.getTracks().forEach(track => track.stop()); video.srcObject = null; }

        try {
            const res = await fetch(`${API_BASE_URL}/api/get-section/${section}`, { headers: { 'Authorization': `Bearer ${token}` } });
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch { showPopup('Failed to load section: Invalid server response'); return; }
            if (!res.ok) { showPopup(data.message || `Failed to load ${section}`); return; }

            const form = document.getElementById('section-form');
            form.innerHTML = '';
            const sectionData = data.data.section_data || {};

            if (section === 'general_report') {
                form.innerHTML = `
                    <div class="mb-4"><label for="audit_date" class="block text-gray-800 font-medium mb-2">Audit Date <span class="mandatory-star">*</span></label><input type="date" id="audit_date" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" required></div>
                    <div class="mb-4"><label for="delivery_centre" class="block text-gray-800 font-medium mb-2">Delivery Centre <span class="mandatory-star">*</span></label><input type="text" id="delivery_centre" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" required></div>
                    <div class="mb-4"><label for="time_in" class="block text-gray-800 font-medium mb-2">Time In <span class="mandatory-star">*</span></label><input type="time" id="time_in" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" required></div>
                    <div class="mb-4"><label for="time_out" class="block text-gray-800 font-medium mb-2">Time Out <span class="mandatory-star">*</span></label><input type="time" id="time_out" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" required></div>
                    <div class="mb-4"><label for="working_hours" class="block text-gray-800 font-medium mb-2">Working Hours <span class="mandatory-star">*</span></label><input type="text" id="working_hours" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" readonly></div>
                    <div class="mb-4">
                        <label for="warehouse_name" class="block text-gray-800 font-medium mb-2">Warehouse Name <span class="mandatory-star">*</span></label>
                        <select id="warehouse_name" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" required>
                            <option value="">-- Loading warehouses… --</option>
                        </select>
                    </div>
                    <div class="mb-4"><label for="warehouse_address" class="block text-gray-800 font-medium mb-2">Warehouse Address <span class="mandatory-star">*</span></label><textarea id="warehouse_address" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" rows="2" required></textarea></div>
                    <div class="mb-4"><label for="auditor_name" class="block text-gray-800 font-medium mb-2">Auditor Name <span class="mandatory-star">*</span></label><input type="text" id="auditor_name" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" required></div>
                    <div class="mb-4"><label for="warehouse_manager_name" class="block text-gray-800 font-medium mb-2">Warehouse Manager <span class="mandatory-star">*</span></label><input type="text" id="warehouse_manager_name" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" required></div>

                    <!-- Previous Audit Records (multiple) -->
                    <div class="mb-4">
                        <div class="flex items-center justify-between mb-2">
                            <label class="block text-gray-800 font-medium">Previous Audit Records <span class="mandatory-star">*</span></label>
                            <button type="button" id="add-prev-audit" class="text-sm bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg hover:bg-indigo-200 font-medium">+ Add Record</button>
                        </div>
                        <div id="prev-audit-list" class="space-y-3"></div>
                    </div>

                    <div class="mb-4">
                        <label for="warehouse_capacity" class="block text-gray-800 font-medium mb-2">Warehouse Capacity <span class="mandatory-star">*</span></label>
                        <div class="flex gap-2">
                            <input type="number" id="warehouse_capacity" class="flex-1 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" required min="0" placeholder="Enter capacity">
                            <select id="warehouse_capacity_uom" class="w-28 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                                <option value="MT">MT</option>
                                <option value="KG">KG</option>
                                <option value="Bales">Bales</option>
                                <option value="Bags">Bags</option>
                                <option value="Drums">Drums</option>
                                <option value="Bundles">Bundles</option>
                                <option value="Bars">Bars</option>
                                <option value="Nos">Nos</option>
                            </select>
                        </div>
                    </div>
                    <div class="mb-4"><label for="capacity_utilization" class="block text-gray-800 font-medium mb-2">Capacity Utilization (%) <span class="mandatory-star">*</span></label><input type="number" id="capacity_utilization" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" required min="0" max="100" step="0.01"></div>
                    <button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button>
                `;

                // ── Previous Audit Records helpers ──────────────────────────
                const prevAuditList = document.getElementById('prev-audit-list');

                function createPrevAuditRow(rowData = {}) {
                    const idx = prevAuditList.children.length + 1;
                    const row = document.createElement('div');
                    row.className = 'prev-audit-row border border-gray-200 rounded-lg p-3 bg-gray-50 relative';
                    row.innerHTML = `
                        <div class="grid grid-cols-1 gap-2">
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-sm text-gray-600 mb-1">Date <span class="mandatory-star">*</span></label>
                                    <input type="date" class="prev-audit-date w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400">
                                </div>
                                <div>
                                    <label class="block text-sm text-gray-600 mb-1">Auditor Name <span class="mandatory-star">*</span></label>
                                    <input type="text" class="prev-auditor-name w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400" placeholder="Auditor name">
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-sm text-gray-600 mb-1">Auditor Type <span class="mandatory-star">*</span></label>
                                    <select class="prev-auditor-type w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400">
                                        <option value="MCXCCL">MCXCCL</option>
                                        <option value="WSP">WSP</option>
                                        <option value="External">External</option>
                                    </select>
                                </div>
                                <div class="prev-agency-container" style="display:none;">
                                    <label class="block text-sm text-gray-600 mb-1">Agency Name <span class="mandatory-star">*</span></label>
                                    <input type="text" class="prev-agency-name w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400" placeholder="Agency name">
                                </div>
                            </div>
                        </div>
                        ${idx > 1 ? '<button type="button" class="remove-prev-audit absolute top-2 right-2 text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>' : ''}
                    `;
                    prevAuditList.appendChild(row);

                    // Show/hide agency field based on type
                    const typeSelect = row.querySelector('.prev-auditor-type');
                    const agencyContainer = row.querySelector('.prev-agency-container');
                    typeSelect.addEventListener('change', () => {
                        agencyContainer.style.display = typeSelect.value === 'External' ? 'block' : 'none';
                    });

                    // Remove row
                    row.querySelector('.remove-prev-audit')?.addEventListener('click', () => {
                        row.remove();
                    });

                    // Populate saved data
                    if (rowData.date) row.querySelector('.prev-audit-date').value = rowData.date;
                    if (rowData.auditor_name) row.querySelector('.prev-auditor-name').value = rowData.auditor_name;
                    if (rowData.auditor_type) {
                        typeSelect.value = rowData.auditor_type;
                        typeSelect.dispatchEvent(new Event('change'));
                    }
                    if (rowData.agency_name) row.querySelector('.prev-agency-name').value = rowData.agency_name;
                }

                document.getElementById('add-prev-audit').addEventListener('click', () => createPrevAuditRow());

                // Restore saved previous audit records or create one blank row
                const savedPrevAudits = Array.isArray(sectionData.previous_audits) ? sectionData.previous_audits : [];
                if (savedPrevAudits.length > 0) {
                    savedPrevAudits.forEach(r => createPrevAuditRow(r));
                } else {
                    // Migrate legacy single-record fields if present
                    createPrevAuditRow({
                        date: sectionData.previous_audit_date || '',
                        auditor_name: sectionData.previous_auditor_name || '',
                        auditor_type: sectionData.previous_auditor_type || 'MCXCCL',
                        agency_name: sectionData.agency_name || ''
                    });
                }

                // ── Populate other fields ───────────────────────────────────
                document.getElementById('audit_date').value = sectionData.audit_date || '';
                document.getElementById('delivery_centre').value = sectionData.delivery_centre || '';
                document.getElementById('time_in').value = sectionData.time_in || '';
                document.getElementById('time_out').value = sectionData.time_out || '';
                document.getElementById('working_hours').value = sectionData.working_hours || '';
                document.getElementById('auditor_name').value = sectionData.auditor_name || '';
                document.getElementById('warehouse_manager_name').value = sectionData.warehouse_manager_name || '';
                document.getElementById('warehouse_capacity').value = sectionData.warehouse_capacity || '';
                document.getElementById('warehouse_capacity_uom').value = sectionData.warehouse_capacity_uom || 'MT';
                document.getElementById('capacity_utilization').value = sectionData.capacity_utilization || '';

                // ── Load warehouse dropdown ─────────────────────────────────
                (async () => {
                    const whSelect = document.getElementById('warehouse_name');
                    const whAddress = document.getElementById('warehouse_address');
                    let warehouseList = [];
                    try {
                        const whRes = await fetch(`${API_BASE_URL}/api/warehouses`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        });
                        const whData = await whRes.json();
                        warehouseList = whData.data?.warehouses || [];
                    } catch { }

                    if (warehouseList.length > 0) {
                        whSelect.innerHTML = '<option value="">-- Select Warehouse --</option>' +
                            warehouseList.map(w => `<option value="${w.warehouse_name}" data-address="${w.warehouse_address || ''}">${w.warehouse_name}</option>`).join('');
                        // Restore saved value
                        if (sectionData.warehouse_name) {
                            whSelect.value = sectionData.warehouse_name;
                            // If saved name not in list, add it as a custom option
                            if (!whSelect.value) {
                                const opt = document.createElement('option');
                                opt.value = sectionData.warehouse_name;
                                opt.textContent = sectionData.warehouse_name;
                                opt.dataset.address = sectionData.warehouse_address || '';
                                whSelect.appendChild(opt);
                                whSelect.value = sectionData.warehouse_name;
                            }
                        }
                        whAddress.value = sectionData.warehouse_address || whSelect.selectedOptions[0]?.dataset.address || '';
                        // Auto-fill address on selection
                        whSelect.addEventListener('change', () => {
                            const addr = whSelect.selectedOptions[0]?.dataset.address || '';
                            whAddress.value = addr;
                        });
                    } else {
                        // No warehouse master — fall back to free text
                        whSelect.outerHTML = `<input type="text" id="warehouse_name" class="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" value="${sectionData.warehouse_name || ''}" required>`;
                        whAddress.value = sectionData.warehouse_address || '';
                    }
                })();

                if (sectionData.time_in && sectionData.time_out) document.getElementById('time_out').dispatchEvent(new Event('change'));

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
            } else if (section === 'stock_reconciliation') {
                form.innerHTML = `
                    <div class="mb-4"><h3 class="text-lg font-semibold text-gray-800">Stock Reconciliation</h3></div>
                    <div id="commodity-list" class="space-y-3"></div>
                    <div class="mt-3 flex justify-between">
                        <button type="button" id="add-commodity" class="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600">Add Commodity</button>
                        <div class="text-sm text-gray-500 self-center">(*) Mandatory fields</div>
                    </div>
                    <div class="mt-4"><button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button></div>
                `;
                const commodityList = document.getElementById('commodity-list');
                const addBtn = document.getElementById('add-commodity');

                function createCommodityCard(dataObj = null) {
                    const card = document.createElement('div');
                    card.className = 'border rounded-lg p-3 bg-white shadow-sm';
                    commodityList.appendChild(card);
                    const idx = Array.from(commodityList.children).indexOf(card) + 1;
                    card.id = `commodity-card-${idx}`;
                    card.innerHTML = `
                        <div class="flex justify-between items-center cursor-pointer" id="commodity-header-${idx}">
                            <div>
                                <h4 class="text-md font-medium text-gray-800" id="commodity-title-${idx}">Commodity ${idx}</h4>
                                <div class="text-xs text-gray-500" id="commodity-subtitle-${idx}">${dataObj ? (dataObj.commodity_name || '') : ''}</div>
                            </div>
                            <button type="button" class="text-red-500 hover:text-red-700" id="delete-${idx}" title="Delete Commodity"><i class="fas fa-trash-alt"></i></button>
                        </div>
                        <div class="mt-3" id="commodity-body-${idx}">
                            <div class="mb-2"><label class="block text-gray-700 mb-1">Commodity Name <span class="mandatory-star">*</span></label><input type="text" id="commodity-name-${idx}" class="w-full p-2 border rounded-lg" placeholder="Enter Commodity Name"></div>
                            <div class="mb-2"><label class="block text-gray-700 mb-1">Stock <span class="mandatory-star">*</span></label><select id="commodity-select-${idx}" class="w-full p-2 border rounded-lg"><option value="">-- Select Stock --</option><option value="Valid Stock">Valid Stock</option><option value="Under QC">Under QC</option><option value="Rejected">Rejected</option><option value="FED">FED</option><option value="Non-exchange">Non-exchange</option></select></div>
                            <div class="mb-2"><label class="block text-gray-700 mb-1">Quantity as per MCXCCL <span class="mandatory-star">*</span></label><input type="number" id="qty-mcxccl-${idx}" min="0" step="any" class="w-full p-2 border rounded-lg"></div>
                            <div class="mb-2"><label class="block text-gray-700 mb-1">Quantity as per Registered <span class="mandatory-star">*</span></label><input type="number" id="qty-registered-${idx}" min="0" step="any" class="w-full p-2 border rounded-lg"></div>
                            <div class="mb-2"><label class="block text-gray-700 mb-1">Quantity as per Physical <span class="mandatory-star">*</span></label><input type="number" id="qty-physical-${idx}" min="0" step="any" class="w-full p-2 border rounded-lg"></div>
                            <div class="mb-2"><label class="block text-gray-700 mb-1">Difference (Registered - Physical)</label><input type="text" id="difference-${idx}" readonly class="w-full p-2 border rounded-lg bg-gray-100"></div>
                            <div class="mb-2"><label class="block text-gray-700 mb-1">Remarks</label><input type="text" id="remarks-${idx}" class="w-full p-2 border rounded-lg" placeholder="Remarks (optional)"></div>
                        </div>
                    `;
                    if (dataObj) {
                        document.getElementById(`commodity-name-${idx}`).value = dataObj.commodity_name || '';
                        document.getElementById(`commodity-select-${idx}`).value = dataObj.commodity || '';
                        document.getElementById(`qty-mcxccl-${idx}`).value = dataObj.qty_mcxccl || '';
                        document.getElementById(`qty-registered-${idx}`).value = dataObj.qty_registered || '';
                        document.getElementById(`qty-physical-${idx}`).value = dataObj.qty_physical || '';
                        document.getElementById(`difference-${idx}`).value = dataObj.difference || '';
                        document.getElementById(`remarks-${idx}`).value = dataObj.remarks || '';
                        document.getElementById(`commodity-subtitle-${idx}`).textContent = dataObj.commodity_name || '';
                    }
                    function recompute() {
                        const name = document.getElementById(`commodity-name-${idx}`).value.trim();
                        const stock = document.getElementById(`commodity-select-${idx}`).value.trim();
                        const reg = parseFloat(document.getElementById(`qty-registered-${idx}`).value || 0);
                        const phy = parseFloat(document.getElementById(`qty-physical-${idx}`).value || 0);
                        const diff = reg - phy;
                        document.getElementById(`difference-${idx}`).value = isNaN(diff) ? '' : diff;
                        document.getElementById(`commodity-title-${idx}`).textContent = name ? `Commodity ${idx} - ${name}` : `Commodity ${idx}`;
                        document.getElementById(`commodity-subtitle-${idx}`).textContent = stock || '';
                    }
                    ['commodity-name-', 'commodity-select-', 'qty-mcxccl-', 'qty-registered-', 'qty-physical-'].forEach(prefix => {
                        const el = document.getElementById(prefix + idx);
                        if (el) { el.addEventListener('input', recompute); el.addEventListener('change', recompute); }
                    });
                    document.getElementById(`commodity-header-${idx}`).addEventListener('click', (ev) => {
                        if (ev.target.closest(`#delete-${idx}`)) return;
                        document.getElementById(`commodity-body-${idx}`)?.classList.toggle('hidden');
                    });
                    document.getElementById(`delete-${idx}`).addEventListener('click', () => {
                        card.remove();
                        Array.from(commodityList.children).forEach((c, ni) => {
                            const title = c.querySelector('h4[id^="commodity-title-"]');
                            const nameInput = c.querySelector('input[id^="commodity-name-"]');
                            if (title) title.textContent = `Commodity ${ni + 1}${nameInput?.value.trim() ? ' - ' + nameInput.value.trim() : ''}`;
                        });
                    });
                }

                const initialCommodities = Array.isArray(sectionData.commodities) ? sectionData.commodities : [];
                if (initialCommodities.length > 0) initialCommodities.forEach(obj => createCommodityCard(obj));
                else createCommodityCard();
                addBtn.onclick = () => { createCommodityCard(); commodityList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
            } else if (['observations_on_stacking', 'observations_on_warehouse_operations', 'observations_on_warehouse_record_keeping',
                'observations_on_wh_infrastructure', 'observations_on_quality_operation',
                'checklist_wrt_exchange_circular_mentha_oil', 'checklist_wrt_exchange_circular_metal',
                'checklist_wrt_exchange_circular_cotton_bales'].includes(section)) {
                // All question-based sections — questions array comes from existing code unchanged
                const questionsMap = {
                    observations_on_stacking: ["Whether the appearance of the stored stocks is neat and free from dust/stains of oil, rust, cracks etc.?", "Whether Packaging condition of stock deposited is as per MCXCCL norms/ procedure guidelines/ relevant circulars as mentioned below? Cotton - Circular no. MCXCCL/WHL/249/2023 dated October 16, 2023 Mentha Oil- Circular no. MCXCCL/WHL/141/2021 dated May 31, 2021 Aluminium: Circular no. MCXCCL/WHL/045/2023 dated February 16, 2023 Lead: Circular no. MCXCCL/WHL/220/2023 dated September 15, 2023 Copper: Circular no. MCXCCL/WHL/868/2020 dated November 23, 2020 Zinc: Circular no. MCXCCL/WHL/044/2023 dated February 16, 2023 Nickel: Circular no. MCXCCL/WHL/868/2020 dated November 23, 2020 Note: any subsequent circular issued for above mentioned commodity shall be referred for compliance Metal & Cotton - no straps should be broken in exchange deliverable stocks", "Whether the stacking of the stock is done as per WDRA guidelines (as applicable) or as per MCXCCL? Whether stock is in countable position, stacking done appropriately & is there any co-mingling of lots?", "Whether adequate alleyways & gangways between stacks & wall to stacks are kept for easy movement, aeration & chemical treatments, physical verification, etc.?", "Whether proper stack layout / stacks plan displayed at warehouse floor?", "Whether lot cards in WSP format are placed on all the stored stocks with up to date entries of all transactions within two working days of transaction/receipt creation?", "Whether overwriting / corrections are found in lot cards?", "Whether suitable dunnage material, as per good warehousing practices available (except mentha oil/ metals) for stored goods?", "Whether lot sealing/drum/drum sealing (for Mentha Oil) for all lots/drums deposited /retested is done within two working days of transaction?", "Whether the Warehouse staff has checked the seal intactness of stocks every month? (Pls verify lot seal register & Monthly declaration stating seals have been checked)", "Is there any spillage or damage material lying spread across the stack or floor? If yes, whether the same is appropriately packed and is kept in demarcated area on the same day?", "Is there a designated area inside the warehouse mentioning the floor area in square feet/meter for FED goods, rejected goods and non-Exchange goods available for storage in the warehouse?", "Is any FED Stock lying for more than 3 months? / Any rejected stock lying in warehouse? If Yes, whether marking/ tagging/placard on such lot card or Stock and follow-up with client for lifting of such stocks is done by WSP?", "Is any stock of identical (exchange grade) agri commodity,for which MCXCCL has accredited the warehouse, stored in the warehouse?", "Is there any other agri commodity which is not in the WDRA registration certificate, stored in the warehouse?", "Has WSP stored its 'own' commodity in the warehouse?", "Is any stock of identical non-agri commodity stored in MCXCCL accredited Metal warehouse Other than approved commodity?", "Whether visual demarcation between MCX deliverable, Non-exchange & Rejected stock is done or not?", "In case Non Exchange stock kept in MCXCCL accredited capacity is it kept with clear demarcation?", "Whether details like hypothecation / lien / pledge to any financial institutions for the purpose of funding has been displayed on the stock and the same has been recorded?", "Whether non exchange goods stored in accredited space and approval from MCXCCL is taken and available at warehouse?"],
                    observations_on_warehouse_operations: ["Whether custody of Navtal brand lock and key of the warehouse/godown is with WSP/WH Owner/others? (Pls specify) Whether additional key of Warehouse available at WSP Head office/WSP regional office and details are updated in Key distribution register?", "Does the WSP use Navtal brand lock seals at every lock of all shutters which are used for transaction of goods? Whether seal details are captured in register.", "Does the warehouse change Navtal brand locks every six months in June and December? Verify the serial number of lock and key, date when it was last changed.", "Specify the number of WH staffs deployed at the warehouse/warehouse complex.", "Indicate number of security guards deployed shift wise.", "Mention name of the Security Agency offering security services at the WH.", "Whether WH staff and Security personnel carrying their identity cards, and are in proper uniform and with baton, torch, whistle etc? Whether security guards checks for any presence of matchbox, gas lighter, chemicals and inflammable items of person entering the warehouse?", "Whether security guard stays inside or outside the warehouse premises?", "Whether there are proper night lighting in warehouse premises for the security purpose?", "Whether proper WSP Sign Board (flex/board/wall-painting) and sign board of MCXCCL accreditation with WSP contact details, No Smoking signage in local dialect, emergency numbers, unauthorized entry, unauthorized parking etc are displayed?", "Whether the board of \"Complaint/feedback register available at warehouse\" is displayed at the warehouse? (Pls mention the place of display of the board)", "Whether Fire Fighting equipment available as per the WDRA guidelines? Please specify below; a. No. of Fire Extinguishers b. No. of Sand Buckets c. Capacity of water tank available as per operational guidelines? d. Is water pump attached to storage tank with hose pipe? e. Availability of water fire hydrant points/sprinkler system for Cotton Bales. f. Whether fire extinguishers are valid & in working condition? Are the expiry dates/next-due date clearly visible?", "Whether the warehouse staff have undergone the training of fire safety & handling of firefighting equipment from the date of joining? (Please verify with records)", "Whether mock drill for fire fighting is conducted at least once in a year? Verify the record of mock drill.", "Is the Warehouse Manager/ Supervisor of the WSP trained in handling warehousing operations, specifically for MCXCCL? Is the skill enhancement training given to the staff in an interval of 6 months? Verify the training record.", "Whether the security personnel have undergone training on fire safety & handling of firefighting equipment from the date of joining? (verify with records and frequency) Mention the name of the official by whom training is provided. Is the follow up training provided on annual basis to the warehouse staff by the WSP?", "Is the arrangement for Prophylactic Measures for Pest Control available at the WH as per WDRA guidelines? (Verify the records of the treatment)", "Is anti-termite treatment at cotton bales warehouses conducted through MCXCCL specified agencies? (Verify the records of the treatment).", "Whether Live Electricity connection found inside the godown where cotton is stored?", "Is the WSP using electricity for weighment purpose only at Mentha oil and metals at warehouses?", "Whether Storage of hazardous Stock (Like fertilizer, Cement, Chemical etc.) in warehouse premises is done that may affect exchange deliverable stock?", "Whether LPG cylinder kept inside warehouse or outside warehouse? (Applicable for Mentha oil)", "Availability of functional, Valid and calibrated weighbridge (Inside / Outside complex)-for base metals – 3 /5 MT capacity (Yes/No) Name of weighbridge/manual weigh scale –WB capacity (MT)- Expiry date of calibration A B C", "Is a written consent of client and approval from MCXCCL sought in case weighment of the commodity is done on any other weighbridge when MCXCCL approved weighbridges are non-functional?", "Whether the list of weighbridge (accredited weighbridge for cotton bales) along with calibration certificate displayed in the warehouse?", "Whether periodic stock audit done by Independent team other than of the same warehouse deployed staffs? (verify with visitor register at the warehouse)", "Whether the storage structure (warehouse) is far away (150 meter) from the source of fire-hazard, such as timber stores, petrol/CNG/PNG pumping stations/LPG bottling plant?"],
                    observations_on_warehouse_record_keeping: ["Whether copy of KYD with requisite documents available for all beneficiaries/depositors at warehouse? Mention the names of depositor(s) incase of incomplete documents.", "Are the soft copy/digital signed copy/original DTD with requisite documents available at warehouse? Mention the names of depositors incase of incomplete documents.", "Whether eNWR/E-receipt is generated based on receipt of original DTD/ photo copy/ DTD Digitally signed by the beneficiary client/ depositor?", "Whether the following registers are available and updated at Warehouse or not? Are the records kept in safe custody with lock facility? • Warehouse opening-closing Register • Daily Transaction Register • Complaint Register • Stack wise/Lot wise register Physical/Electronic form • PV Register • Instrument/Equipment Internal Calibration Register • Gate in gate out cum Visitor Register • Spot Rejection Register • Sample register • Incidence records /Notices register • Lien register • Pest control activity register • Key distribution register", "Whether any Overwriting/correction is found in the above Registers? If yes, check whether approval from WSP HO has been obtained or not", "Whether the transaction wise weighbridge receipts for deposit/withdrawal are available at the warehouse or not?", "Whether the Commodity deposits & all required documents along with original delivery orders withdrawal document are available at warehouse or not?", "Whether WSP has taken approval from MCXCCL for storage of partial lot created out of overload of lorry in a demarcated area?", "Whether separate entries are done for Exchange & Non-Exchange stock?", "Whether a copy of updated WSP SOP and warehouse operations manual available at the warehouse?", "Whether the Warehouse is registered under relevant State/ Central Warehousing Authority/Gram Panchyat? If Yes, License copy to be available at warehouse.", "Whether the Warehouse License copy/ WDRA registration copy is available and displayed at the warehouse?", "Whether lot wise beneficiary details and electronic receipts available at the warehouse either in electronic or printed form?", "Whether the valid stocks are as per CCRL/Comris system record?", "Whether warehouse maintains Weighment slip for record for all commodities during inward and outward movement?"],
                    observations_on_wh_infrastructure: ["Warehouse condition (both internal/external) is in sound and store worthy condition?", "Is there any roof leakage / Infrastructure damage? If Yes, whether the incident record updated with details?", "Whether the warehouse is well-protected by pucca boundary wall / barbed wire fencing?", "Whether warehouse is having good drivable approach road & adequate parking space for vehicles?", "Whether flooring is even without major cracks / crevices/ dampness or required major structural repairing?", "Whether hygiene & cleanliness inside the warehouse & premises and vegetation cleaning surrounding the warehouse maintained? Whether dusting of stock, cleaning of bird droppings on stacks, floor cleaning and any minor/major structural repair conducted on a periodic basis? Is the record of the house keeping maintained?", "Whether any infestation by termites/ white ants and rodents in the buildings and warehouse premises is noticed? Whether annual termite treatment record is maintained at cotton/kapas warehouse? Whether termite treatment certificate is available at cotton/kapas warehouse?", "Whether rat cages are placed inside the warehouse? Whether rodenticides used to control rodents?", "Whether surveillance cameras (CCTV) are installed at the warehouse?", "Whether warehouse maintains 90 days CCTV footage of surveillance? mention the date from which CCTV footage is available.", "Whether the cctv camera positioned towards weighment scale inside the warehouse? Verify the cctv footage.", "Whether Handling equipment available?", "Whether the walls are properly plastered and painted/white washed and are free from cracks and crevices?", "Whether adequate ventilators and air inlets are available? (Mention no. of ventilators and air inlets)", "Whether the WH office is inside the godown? (not acceptable for cotton)", "Mention type of Flooring: Concrete / Stones / Tiles / trimix/ Bricks flooring (Mentha Oil WH) /No flooring/Other", "Whether the warehouse has adequate plinth (elevation from ground level) as per WDRA norm?", "Whether there are adequate arrangements for drainage of rainwater to avoid flooding?", "Whether load bearing capacity certificate available at warehouse? (in case of metal warehouse)", "Whether Sufficient office space available for equipment viz. computers with internet facility, telephone and furniture (table, chairs almirah, etc.)"],
                    observations_on_quality_operation: ["Is cotton bales moisture meter in working condition or Not? If not then has the same been recorded in incident register available at warehouse?", "Is moisture meter available at warehouse?", "Last calibrated on …………. (dd/mm/yyyy)", "Is inward /outward moisture checked or not? (lot wise moisture record) in case of cotton", "Are necessary sampling details updated on sample tag within one working day? (Name of warehouse, date of sampling, stack no, lot No.)", "Is Reference sample duly sealed & signed by the WH official/in charge?", "Is signature of beneficiary/Client or authorized personal of the client is taken on reference sample?", "Is the sample storage area secure and demarcated? Are the samples kept in rack / pallet / in Almirah or trunk in the sample storage area?", "Whether Reference samples with all relevant details kept in proper custody until the lot is present in the warehouse?", "Is record for courier of samples to the assayer available?", "Do the Goods stored come into direct contact with water or excess moisture which can be detrimental to its usability or quality?"],
                    checklist_wrt_exchange_circular_mentha_oil: ["Any records available regarding person visits to depositor place for weighing the empty drums?", "Are there any proof / records available stating that the empty drum Weighment is done on calibrated weighbridge or weighing scale?", "Whether the white sticker is non-tearable and non-removable?", "Whether sticker is signed and date mentioned with permanent marker?", "Any Drums accepted without white stickers?", "Whether any record of preliminary testing is available or not?", "Whether the weight of the Mentha Oil in drum is 180 kg Net or within tolerance limit of 1% (i.e. +/- 1.8 Kg) as prescribed in Procedure for dealing with Mentha oil? Check the weight randomly", "Whether the lot numbers are mentioned on drums with permanent marker?", "Whether the drums in same lot are kept together and traceable?", "Whether any record available for revalidation? (If any)", "Is any undertaking taken from the Beneficiary/Client, if required or applicable?", "In case of damaged/leaked drums, whether the drum is changed immediately & record of the same is maintained/updated in incidence register?", "Whether the firm/ company depositing Mentha Oil is registered in the respective local Mandi? (verify the records)"],
                    checklist_wrt_exchange_circular_metal: ["Whether the Certificate of Analysis (CoA) of the producer at the time of deposits with containing details like Brand name of the associated lots, Producer's name, Batch No & certificate date been collected by warehouse?", "Whether the packing list for deposited goods are available as per the latest circular or not with following details; - Contains net weight - Contains gross weight - Contains batch no - No. of units in bundles/lot.", "Whether the copy of Invoice available for all deposits?", "Whether the copy of Certificate of Origin and Custom clearance documents are available in case of Imported goods or not?", "Whether the producer's sticker is available or not on each ingots/ bundle?", "Whether the following details are mentioned in sticker or not? • Producer/ manufacturer name • Net Weight • Batch No (printed/sticker/stenciled/laser?) • Purity • Date of Manufacturing/ Production • Number of Pieces of Ingots/ sheets in each bundle", "Whether batch number/lot number is hand written?", "Whether the Ingots/ bundle are physically sound and free of harmful/ any defects? (such as segregation, piping, spilt /broken, inclusions or visible contamination of metal)", "Whether mixing of bundle(s) of different brands are observed?", "Whether the annual Inspection of electrical points done or not? Check the record.", "In case, more than 1 strap is broken, whether re-strapping is done every 07 working days from the date of strap broken & record of the strap break and re-strapping is maintained? In incidence register?", "Same commodity non-exchange goods shall not be kept mingled in the same warehouse which is used for MCXCCL purposes.", "Whether all re-mated stock physically delivered from the warehouse and not stored as non-exchange/professional goods.", "Is there any sign of corrosion in stored stocks?", "Whether the goods stored at MAW are bearing Standard Mark under a license from Bureau of Indian Standards (BIS) for metals where BIS is applicable.", "Whether approval for storing non-exchange metal goods of exchange deliverable grades taken from MCXCCL prior to storage? Whether approval sought for storage of non-exchange goods are as per list of approved brands of LME/MCX?", "Whether WSP has sought approval for how much quantity to be stored? Whether quantity lying at warehouse are as per the approval taken?", "Whether any metal goods of brands stored which is in the restrictive list of LME/MCX and for which approval is not taken?"],
                    checklist_wrt_exchange_circular_cotton_bales: ["Whether bales have all the proper markings in the form of unique press running number (PRN) Whether every bale has a label giving details of variety weight, crop year when checked randomly? And any other details as may be required from time to time? Does each bale have a label / sticker giving the bale number in figures along with ginner details?", "Whether warehouse has put in a deposit stamp / sticker, containing the date of deposit of the goods on each bale deposited?", "Forklift – battery operated or fuel operated?", "Placement of the Firefighting equipment? Inside the godown or outside? (Placement inside the godown is not allowed)", "Proximity to source of fire hazard if any. whether any fire-risk is noticed in close vicinity of the warehouse? Mention the approximate distance of source of fire risk.", "Whether cotton samples are stored inside the godown?", "Whether opening and closing of cotton godown is done under supervision of Warehouse Manager and the register maintained indicating the purpose of opening and date and time of opening/closing?", "In case, more than 3 straps of bales are broken, whether re-strapping of the bales is done within 10 working days from the date of strap broken & record of the strap break and re-strapping is maintained? In incidence register?"]
                };
                const questions = questionsMap[section] || [];
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
                form.innerHTML += `<button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button>`;
                if (sectionData.questions && sectionData.questions.length === questions.length) {
                    sectionData.questions.forEach((qd, i) => {
                        const radio = document.querySelector(`input[name="q${i}"][value="${qd.answer}"]`);
                        if (radio) radio.checked = true;
                        document.getElementById(`remarks${i}`).value = qd.remarks || '';
                    });
                }

                // Clear red flag when user answers a question
                form.querySelectorAll('input[type="radio"]').forEach(radio => {
                    radio.addEventListener('change', () => {
                        const questionDiv = radio.closest('.mb-4');
                        if (questionDiv) {
                            questionDiv.classList.remove('border', 'border-red-500', 'bg-red-50', 'rounded-lg', 'p-2');
                        }
                    });
                });
            } else if (section === 'signature') {
                const sectionForm = document.getElementById('section-form');
                if (sectionForm) sectionForm.classList.add('hidden');
                document.getElementById('signature-section').classList.remove('hidden');
                document.getElementById('photo-section').classList.add('hidden');
                const canvas = document.getElementById('signature-canvas');
                function resizeSignatureCanvas() {
                    const ratio = Math.max(window.devicePixelRatio || 1, 1);
                    const w = Math.min(window.innerWidth * 0.9, 500);
                    const h = Math.min(window.innerHeight * 0.35, 300);
                    canvas.width = w * ratio; canvas.height = h * ratio;
                    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
                    canvas.getContext('2d').scale(ratio, ratio);
                }
                resizeSignatureCanvas();
                window.addEventListener('resize', resizeSignatureCanvas);
                const ctx = canvas.getContext('2d');
                let isDrawing = false;
                const draw = (x, y) => { if (!isDrawing) return; ctx.lineTo(x, y); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.stroke(); };
                canvas.onmousedown = e => { isDrawing = true; ctx.beginPath(); ctx.moveTo(e.offsetX, e.offsetY); };
                canvas.onmousemove = e => draw(e.offsetX, e.offsetY);
                canvas.onmouseup = () => (isDrawing = false);
                canvas.onmouseout = () => (isDrawing = false);
                canvas.addEventListener('touchstart', e => { e.preventDefault(); const rect = canvas.getBoundingClientRect(); const touch = e.touches[0]; isDrawing = true; ctx.beginPath(); ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top); });
                canvas.addEventListener('touchmove', e => { e.preventDefault(); if (!isDrawing) return; const rect = canvas.getBoundingClientRect(); const touch = e.touches[0]; draw(touch.clientX - rect.left, touch.clientY - rect.top); });
                canvas.addEventListener('touchend', () => (isDrawing = false));
                document.getElementById('clear-signature').onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
                document.getElementById('save-signature').onclick = async () => {
                    const token = localStorage.getItem('access_token');
                    const dataUrl = canvas.toDataURL('image/png');
                    const date = new Date().toISOString().split('T')[0];
                    try {
                        const res = await fetch(`${API_BASE_URL}/api/save-section`, {
                            method: 'POST', headers: { 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ section: 'signature', data: { signature: dataUrl }, date })
                        });
                        const text = await res.text();
                        const data = JSON.parse(text);
                        if (!res.ok) return showPopup(data.message || 'Failed to save signature');
                        updateSectionTick('signature');
                        showPopup('Signature saved successfully', 'success');
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        document.getElementById('signature-section').classList.add('hidden');
                        document.getElementById('back-to-dashboard').click();
                    } catch (err) { showPopup('Error: ' + err.message); }
                };
            } else if (section === 'photo') {
                const sectionForm = document.getElementById('section-form');
                if (sectionForm) sectionForm.classList.add('hidden');
                let mapsUrl = "";
                let photoImageData = null; // base image before geotag overlay

                document.getElementById('photo-section').classList.remove('hidden');
                document.getElementById('signature-section').classList.add('hidden');

                const video = document.getElementById('video');
                const canvas = document.getElementById('photo-canvas');
                const ctx = canvas.getContext('2d');
                const takePhotoButton = document.getElementById('take-photo');
                const retakeButton = document.getElementById('retake-photo');
                const saveButton = document.getElementById('save-photo');

                let addLabelButton = document.getElementById('add-label');
                if (!addLabelButton) {
                    addLabelButton = document.createElement('button');
                    addLabelButton.id = 'add-label';
                    addLabelButton.textContent = 'Add Location Label';
                    addLabelButton.className = 'hidden bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600';
                    document.querySelector('#photo-section .flex').appendChild(addLabelButton);
                }
                let mapLinkOverlay = document.getElementById('map-overlay');
                if (!mapLinkOverlay) {
                    mapLinkOverlay = document.createElement('a');
                    mapLinkOverlay.id = 'map-overlay';
                    mapLinkOverlay.target = '_blank';
                    Object.assign(mapLinkOverlay.style, { position: 'absolute', bottom: '45px', left: '10px', width: '380px', height: '20px', opacity: '0', cursor: 'pointer', zIndex: '5' });
                    document.getElementById('photo-section').appendChild(mapLinkOverlay);
                }
                mapLinkOverlay.style.display = 'none';

                // ── Determine if live camera is available ──
                const hasLiveCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

                // ── Hidden file input for HTTP fallback ──
                let fileInput = document.getElementById('photo-file-input');
                if (fileInput) fileInput.remove();
                fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.id = 'photo-file-input';
                fileInput.accept = 'image/*';
                fileInput.capture = 'environment';
                fileInput.style.display = 'none';
                document.body.appendChild(fileInput);

                const resetToInitial = () => {
                    photoImageData = null; mapsUrl = '';
                    mapLinkOverlay.style.display = 'none';
                    takePhotoButton.classList.remove('hidden');
                    retakeButton.classList.add('hidden');
                    addLabelButton.classList.add('hidden');
                    saveButton.classList.add('hidden');
                    addLabelButton.textContent = 'Add Location Label';
                    addLabelButton.disabled = false;
                };

                const showImageOnCanvas = (img) => {
                    const maxW = 640;
                    const scale = img.width > maxW ? maxW / img.width : 1;
                    canvas.width = img.width * scale;
                    canvas.height = img.height * scale;
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    photoImageData = canvas.toDataURL('image/png');
                    takePhotoButton.classList.add('hidden');
                    retakeButton.classList.remove('hidden');
                    addLabelButton.classList.remove('hidden');
                    saveButton.classList.add('hidden');
                    addLabelButton.textContent = 'Add Location Label';
                    addLabelButton.disabled = false;
                    mapLinkOverlay.style.display = 'none';
                };

                if (hasLiveCamera) {
                    // ── LIVE CAMERA MODE ──
                    video.classList.remove('hidden');
                    canvas.classList.add('hidden');
                    takePhotoButton.disabled = true;
                    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } })
                        .then(stream => {
                            video.srcObject = stream;
                            video.onloadedmetadata = () => video.play().then(() => { takePhotoButton.disabled = false; });
                        })
                        .catch(() => {
                            // Camera permission denied — switch to file mode
                            video.classList.add('hidden');
                            canvas.classList.remove('hidden');
                            takePhotoButton.disabled = false;
                        });

                    takePhotoButton.onclick = () => {
                        if (video.videoWidth === 0 || video.videoHeight === 0) {
                            showPopup('Camera not ready yet. Please wait.'); return;
                        }
                        const img = new Image();
                        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        // Stop stream after snapshot
                        if (video.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); video.srcObject = null; }
                        video.classList.add('hidden'); canvas.classList.remove('hidden');
                        photoImageData = canvas.toDataURL('image/png');
                        takePhotoButton.classList.add('hidden');
                        retakeButton.classList.remove('hidden');
                        addLabelButton.classList.remove('hidden');
                        saveButton.classList.add('hidden');
                        addLabelButton.textContent = 'Add Location Label';
                        addLabelButton.disabled = false;
                        mapLinkOverlay.style.display = 'none';
                    };

                    retakeButton.onclick = () => {
                        if (video.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); video.srcObject = null; }
                        resetToInitial();
                        takePhotoButton.disabled = true;
                        video.classList.remove('hidden'); canvas.classList.add('hidden');
                        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } })
                            .then(stream => {
                                video.srcObject = stream;
                                video.onloadedmetadata = () => video.play().then(() => { takePhotoButton.disabled = false; });
                            })
                            .catch(() => { video.classList.add('hidden'); canvas.classList.remove('hidden'); takePhotoButton.disabled = false; });
                    };
                } else {
                    // ── FILE INPUT FALLBACK (HTTP production) ──
                    video.classList.add('hidden');
                    canvas.classList.remove('hidden');
                    canvas.width = 400; canvas.height = 300;
                    ctx.fillStyle = '#1f2937'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.fillStyle = '#9ca3af'; ctx.font = '16px Arial';
                    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText('📷 Tap "Take Photo" to open camera', canvas.width / 2, canvas.height / 2);
                    takePhotoButton.disabled = false;

                    takePhotoButton.onclick = () => { fileInput.value = ''; fileInput.click(); };

                    retakeButton.onclick = () => {
                        resetToInitial();
                        canvas.width = 400; canvas.height = 300;
                        ctx.fillStyle = '#1f2937'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.fillStyle = '#9ca3af'; ctx.font = '16px Arial';
                        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillText('📷 Tap "Take Photo" to open camera', canvas.width / 2, canvas.height / 2);
                    };
                }

                // ── File input handler (shared — used by fallback and retake) ──
                fileInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const img = new Image();
                    img.onload = () => showImageOnCanvas(img);
                    img.src = URL.createObjectURL(file);
                };

                // ── Geo-tagging ──
                addLabelButton.onclick = async () => {
                    addLabelButton.textContent = 'Fetching location...';
                    addLabelButton.disabled = true;

                    const drawGeoTag = (lat, lon, address, mUrl) => {
                        mapsUrl = mUrl;
                        if (!photoImageData) return;
                        const base = new Image();
                        base.onload = () => {
                            ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
                            const timestamp = new Date().toLocaleString();
                            const labelLines = [
                                `📍 ${parseFloat(lat).toFixed(5)}, ${parseFloat(lon).toFixed(5)}`,
                                `🏠 ${address}`,
                                `🌍 ${mUrl || 'Maps URL unavailable'}`,
                                `🕒 ${timestamp}`
                            ];
                            const boxHeight = 110;
                            ctx.fillStyle = 'rgba(0,0,0,0.65)';
                            ctx.fillRect(0, canvas.height - boxHeight, canvas.width, boxHeight);
                            ctx.fillStyle = 'white'; ctx.font = '14px Arial';
                            ctx.textAlign = 'left'; ctx.textBaseline = 'top';
                            const startY = canvas.height - boxHeight + 10;
                            labelLines.forEach((line, i) => {
                                ctx.fillText(line.length > 70 ? line.slice(0, 67) + '...' : line, 10, startY + i * 23);
                            });
                            if (mUrl) { mapLinkOverlay.href = mUrl; mapLinkOverlay.style.display = 'block'; }
                            addLabelButton.textContent = 'Label Added ✅';
                            saveButton.classList.remove('hidden');
                        };
                        base.src = photoImageData;
                    };

                    const fetchAndDrawLocation = async (lat, lon) => {
                        try {
                            const res = await fetch(`${API_BASE_URL}/api/get-location?lat=${lat}&lon=${lon}`, {
                                signal: AbortSignal.timeout(8000)
                            });
                            const data = await res.json();
                            drawGeoTag(lat, lon, data.plus_code || 'Address not found', data.maps_url || '');
                        } catch (err) {
                            console.warn('Location API failed, will attempt IP-based location');
                            drawGeoTag(lat, lon, 'Location unavailable', '');
                        }
                    };

                    const fallbackIpLocation = async () => {
                        // Use backend proxy to avoid CORS issues — this is the KEY FIX
                        try {
                            const res = await fetch(`${API_BASE_URL}/api/get-ip-location`, {
                                signal: AbortSignal.timeout(8000)
                            });

                            if (!res.ok) {
                                throw new Error('Backend IP geolocation failed');
                            }

                            const data = await res.json();

                            if (!data.success || !data.latitude || !data.longitude) {
                                throw new Error('No location data');
                            }

                            await fetchAndDrawLocation(data.latitude, data.longitude);
                            return;
                        } catch (err) {
                            console.log("Fallback IP location failed: " + err);
                            // Still let user save without geotag
                            showPopup('Could not get location. YoWu can still save the photo.', 'warning');
                            addLabelButton.textContent = 'Add Location Label';
                            addLabelButton.disabled = false;
                            saveButton.classList.remove('hidden');
                        }
                    };

                    /// Check if secure context (HTTPS) - required for geolocation API
                    const isSecure = window.isSecureContext;

                    if (isSecure && "geolocation" in navigator) {
                        // Show loading message
                        addLabelButton.textContent = 'Getting GPS location...';
                        addLabelButton.disabled = true;
                        
                        // Try browser geolocation first (most accurate) with high accuracy enabled
                        navigator.geolocation.getCurrentPosition(
                            async pos => {
                                await fetchAndDrawLocation(pos.coords.latitude, pos.coords.longitude);
                            },
                            async (error) => {
                                // Geolocation denied or failed
                                console.warn('Browser geolocation error:', error.message);
                                
                                if (error.code === error.PERMISSION_DENIED) {
                                    showPopup('Location permission denied. Please enable GPS/Location in your browser settings for accurate location.', 'warning');
                                } else if (error.code === error.POSITION_UNAVAILABLE) {
                                    showPopup('GPS position unavailable. Using approximate IP-based location.', 'warning');
                                } else if (error.code === error.TIMEOUT) {
                                    showPopup('GPS timeout. Using approximate IP-based location.', 'warning');
                                }
                                
                                // Use IP-based location as fallback (less accurate)
                                console.warn('Using IP-based location (less accurate)');
                                await fallbackIpLocation();
                            },
                            { 
                                enableHighAccuracy: true,  // Request high accuracy GPS
                                timeout: 10000,            // Wait up to 10 seconds for GPS
                                maximumAge: 0              // Don't use cached position
                            }
                        );
                    } else {
                        // HTTP context or geolocation not available → use backend IP geolocation
                        console.log('Using backend IP geolocation (HTTP context or API unavailable)');
                        showPopup('Using approximate IP-based location. For accurate GPS, enable location permissions.', 'warning');
                        await fallbackIpLocation();
                    }
                };

                // ── Save photo ──
                saveButton.onclick = async () => {
                    const token = localStorage.getItem('access_token');
                    const dataUrl = canvas.toDataURL('image/png');
                    const date = new Date().toISOString().split('T')[0];
                    try {
                        const res = await fetch(`${API_BASE_URL}/api/save-section`, {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ section: 'photo', data: { photo: dataUrl, maps_url: mapsUrl }, date }),
                        });
                        const text = await res.text(); const data = JSON.parse(text);
                        if (!res.ok) return showPopup(data.message || 'Failed to save photo');
                        if (video.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); video.srcObject = null; }
                        resetToInitial();
                        updateSectionTick('photo');
                        showPopup('Photo saved successfully', 'success');
                        document.getElementById('photo-section').classList.add('hidden');
                        document.getElementById('back-to-dashboard').click();
                    } catch (err) { showPopup('Error: ' + err.message); }
                };
            } else {
                form.innerHTML = `<p class="text-gray-600">Placeholder for future questions.</p><button type="button" id="save-section" class="w-full bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700">Save</button>`;
            }

            const saveButton = document.getElementById('save-section');
            if (saveButton) saveButton.onclick = () => saveSection(section);
        } catch (err) { showPopup('Error: ' + err.message); }
    }

    async function saveSection(section) {
        const token = localStorage.getItem('access_token');
        const data = {};
        let validationErrors = [];

        if (section === 'general_report') {
            const fields = ['audit_date', 'delivery_centre', 'time_in', 'time_out', 'working_hours', 'warehouse_address', 'warehouse_name', 'auditor_name', 'warehouse_manager_name', 'warehouse_capacity', 'capacity_utilization'];
            const vals = {};
            fields.forEach(f => { vals[f] = document.getElementById(f)?.value || ''; });
            if (fields.some(f => !vals[f])) validationErrors.push("All fields are mandatory. Please complete all fields before saving.");
            fields.forEach(f => { data[f] = vals[f]; });
            data.warehouse_capacity = parseFloat(vals.warehouse_capacity);
            data.warehouse_capacity_uom = document.getElementById('warehouse_capacity_uom')?.value || 'MT';
            data.capacity_utilization = parseFloat(vals.capacity_utilization);

            // Collect previous audit records
            const prevRows = document.querySelectorAll('.prev-audit-row');
            if (prevRows.length === 0) {
                validationErrors.push("At least one previous audit record is required.");
            } else {
                data.previous_audits = [];
                prevRows.forEach((row, idx) => {
                    const date = row.querySelector('.prev-audit-date')?.value || '';
                    const auditorName = row.querySelector('.prev-auditor-name')?.value.trim() || '';
                    const auditorType = row.querySelector('.prev-auditor-type')?.value || '';
                    const agencyName = row.querySelector('.prev-agency-name')?.value.trim() || '';
                    if (!date) validationErrors.push(`Previous audit record ${idx + 1}: Date is required.`);
                    if (!auditorName) validationErrors.push(`Previous audit record ${idx + 1}: Auditor Name is required.`);
                    if (auditorType === 'External' && !agencyName) validationErrors.push(`Previous audit record ${idx + 1}: Agency Name is required for External auditor type.`);
                    data.previous_audits.push({ date, auditor_name: auditorName, auditor_type: auditorType, agency_name: agencyName });
                });
            }
        } else if (section === 'stock_reconciliation') {
            data.commodities = [];
            const commodityList = document.getElementById('commodity-list');
            if (!commodityList || commodityList.children.length === 0) {
                validationErrors.push("Please add at least one commodity row before saving.");
            } else {
                Array.from(commodityList.children).forEach((card, idx) => {
                    const suf = card.id.split('commodity-card-')[1] || (idx + 1);
                    const commodityName = document.getElementById(`commodity-name-${suf}`)?.value.trim() || '';
                    const commodity = document.getElementById(`commodity-select-${suf}`)?.value.trim() || '';
                    const qtyMcxcclRaw = document.getElementById(`qty-mcxccl-${suf}`)?.value.trim() || '';
                    const qtyRegisteredRaw = document.getElementById(`qty-registered-${suf}`)?.value.trim() || '';
                    const qtyPhysicalRaw = document.getElementById(`qty-physical-${suf}`)?.value.trim() || '';
                    const qtyMcxccl = qtyMcxcclRaw === '' ? null : parseFloat(qtyMcxcclRaw);
                    const qtyRegistered = qtyRegisteredRaw === '' ? null : parseFloat(qtyRegisteredRaw);
                    const qtyPhysical = qtyPhysicalRaw === '' ? null : parseFloat(qtyPhysicalRaw);
                    if (!commodityName) validationErrors.push(`Commodity Name is required for row ${idx + 1}.`);
                    if (!commodity) validationErrors.push(`Stock Type is required for row ${idx + 1}.`);
                    if (qtyMcxcclRaw === '' || isNaN(qtyMcxccl)) validationErrors.push(`Quantity as per MCXCCL is required and must be numeric for row ${idx + 1}.`);
                    if (qtyRegisteredRaw === '' || isNaN(qtyRegistered)) validationErrors.push(`Quantity as per Registered is required and must be numeric for row ${idx + 1}.`);
                    if (qtyPhysicalRaw === '' || isNaN(qtyPhysical)) validationErrors.push(`Quantity as per Physical is required and must be numeric for row ${idx + 1}.`);
                    const difference = (qtyRegistered !== null && qtyPhysical !== null) ? (qtyRegistered - qtyPhysical) : null;
                    data.commodities.push({ commodity_name: commodityName, commodity, qty_mcxccl: qtyMcxccl, qty_registered: qtyRegistered, qty_physical: qtyPhysical, difference, remarks: document.getElementById(`remarks-${suf}`)?.value?.trim() || '' });
                });
            }
        } else {
            data.questions = [];
            const remarksInputs = document.querySelectorAll('[id^="remarks"]');
            let allAnswered = true;
            let unansweredQuestions = [];
            
            remarksInputs.forEach((input, i) => {
                const radios = document.querySelectorAll(`input[name="q${i}"]`);
                const questionDiv = input.closest('.mb-4');
                let answer = ''; let isAnswered = false;
                radios.forEach(r => { if (r.checked) { answer = r.value; isAnswered = true; } });

                // Clear previous error state
                if (questionDiv) {
                    questionDiv.classList.remove('border', 'border-red-500', 'bg-red-50', 'rounded-lg', 'p-2');
                }

                if (!isAnswered) {
                    allAnswered = false;
                    unansweredQuestions.push(i + 1);
                    if (questionDiv) {
                        questionDiv.classList.add('border', 'border-red-500', 'bg-red-50', 'rounded-lg', 'p-2');
                    }
                } else if (answer === 'No' && !input.value.trim()) {
                    validationErrors.push(`Remarks are required for question ${i + 1} answered as 'No'.`);
                    if (questionDiv) {
                        questionDiv.classList.add('border', 'border-red-500', 'bg-red-50', 'rounded-lg', 'p-2');
                    }
                }

                const questionLabel = input.parentElement?.previousElementSibling;
                const questionText = questionLabel?.innerText.replace(/^\d+\.\s/, '').replace(/\s\*$/, '') || '';
                data.questions.push({ question: questionText, answer, remarks: input.value.trim() });
            });
            
            if (!allAnswered) {
                validationErrors.push(`All questions are mandatory. Please answer questions: ${unansweredQuestions.join(', ')}`);
            }
        }

        if (validationErrors.length > 0) {
            showPopup(validationErrors[0]);
            // Scroll to first flagged question
            const firstError = document.querySelector('.border-red-500');
            if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/save-section`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ section, data, date: new Date().toISOString().split('T')[0] })
            });
            const text = await res.text();
            let dataRes;
            try { dataRes = JSON.parse(text); } catch { showPopup('Failed to save section: Invalid server response'); return; }
            if (!res.ok) { showPopup(dataRes.message || `Failed to save ${section}`); return; }
            updateSectionTick(section);
            showPopup("Data Saved Successfully ✅", "success");
            document.getElementById('back-to-dashboard')?.click();
        } catch (err) { showPopup('Error: ' + err.message); }
    }

    document.getElementById('logout').addEventListener('click', () => {
        const overlay = document.createElement('div');
        overlay.className = "fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50";
        const modal = document.createElement('div');
        modal.className = "bg-white p-6 rounded-xl shadow-lg text-center w-80";
        modal.innerHTML = `<h2 class="text-lg font-semibold mb-3 text-gray-800">Do you want to logout?</h2><div class="flex justify-center gap-4 mt-4"><button id="confirm-logout" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">Yes</button><button id="cancel-logout" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">No</button></div>`;
        overlay.appendChild(modal); document.body.appendChild(overlay);
        document.getElementById('cancel-logout').onclick = () => overlay.remove();
        document.getElementById('confirm-logout').onclick = async () => {
            const token = localStorage.getItem('access_token');
            try { await fetch(`${API_BASE_URL}/api/logout`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }); } catch { }
            localStorage.removeItem('access_token'); localStorage.removeItem('completionStatus');
            isNavigatingInternally = true; overlay.remove();
            window.location.href = "/static/login.html";
        };
    });
}

window.addEventListener("beforeunload", function (e) {
    const nextURL = document.activeElement?.href || "";
    const isInternal = nextURL.includes("/static/");
    if (isNavigatingInternally || isInternal) return;
    if (!isExitConfirmed) { e.preventDefault(); e.returnValue = ""; showExitModal(); return ""; }
});

function showExitModal() {
    if (document.getElementById('exit-modal')) return;
    const overlay = document.createElement('div');
    overlay.id = 'exit-modal';
    overlay.className = "fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50";
    const modal = document.createElement('div');
    modal.className = "bg-white p-6 rounded-xl shadow-lg text-center w-80";
    modal.innerHTML = `<h2 class="text-lg font-semibold mb-3 text-gray-800">Do you want to exit the application?</h2><div class="flex justify-center gap-4 mt-4"><button id="confirm-exit" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg">Yes</button><button id="cancel-exit" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">No</button></div>`;
    overlay.appendChild(modal); document.body.appendChild(overlay);
    document.getElementById('cancel-exit').onclick = () => overlay.remove();
    document.getElementById('confirm-exit').onclick = () => { isExitConfirmed = true; overlay.remove(); window.location.href = "about:blank"; };
}

// ─────────────────────────────────────────────────────────────────────────────
//  SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
const menuIcon = document.getElementById('menu-icon');
const menuIconHeader = document.getElementById('menu-icon-header');
const sidebar = document.getElementById('sidebar');
const closeSidebar = document.getElementById('close-sidebar');
if (menuIcon && sidebar) menuIcon.onclick = () => sidebar.classList.remove('-translate-x-full');
if (menuIconHeader && sidebar) menuIconHeader.onclick = () => sidebar.classList.remove('-translate-x-full');
if (closeSidebar && sidebar) closeSidebar.onclick = () => sidebar.classList.add('-translate-x-full');

const navChecklist = document.getElementById('nav-checklist');
if (navChecklist) {
    navChecklist.onclick = () => {
        sidebar?.classList.add('-translate-x-full');
        ['send-email-section', 'stock-count-section', 'upload-data-section', 'section-content'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('checklist-container')?.classList.remove('hidden');
        document.getElementById('photo-section')?.classList.add('hidden');
        document.getElementById('signature-section')?.classList.add('hidden');
    };
}

const navSendEmail = document.getElementById('nav-send-email');
if (navSendEmail) {
    navSendEmail.onclick = () => {
        sidebar?.classList.add('-translate-x-full');
        ['checklist-container', 'stock-count-section', 'upload-data-section', 'section-content'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        document.getElementById('photo-section')?.classList.add('hidden');
        document.getElementById('signature-section')?.classList.add('hidden');
        document.getElementById('send-email-section')?.classList.remove('hidden');
    };
}

const navStockCount = document.getElementById('nav-stock-count');
if (navStockCount) {
    navStockCount.onclick = () => {
        sidebar?.classList.add('-translate-x-full');
        ['checklist-container', 'send-email-section', 'upload-data-section', 'section-content'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        // Also hide photo/signature sections inside section-content
        document.getElementById('photo-section')?.classList.add('hidden');
        document.getElementById('signature-section')?.classList.add('hidden');
        // Stop any active camera stream
        const video = document.getElementById('video');
        if (video && video.srcObject) { video.srcObject.getTracks().forEach(t => t.stop()); video.srcObject = null; }
        document.getElementById('stock-count-section')?.classList.remove('hidden');
    };
}


// ─────────────────────────────────────────────────────────────────────────────
//  SEND EMAIL
// ─────────────────────────────────────────────────────────────────────────────
const sendEmailForm = document.getElementById('send-email-form');
if (sendEmailForm) {
    sendEmailForm.onsubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('access_token');
        if (!token) return showPopup('Please login first.', 'warning');
        const to = document.getElementById('email-to').value.trim();
        const fileInput = document.getElementById('email-file');
        const sendBtn = sendEmailForm.querySelector('button[type="submit"]');
        if (fileInput.files.length === 0) { showPopup('Please upload a PDF file.', 'warning'); return; }
        sendBtn.disabled = true; sendBtn.textContent = "Sending Email...";
        const formData = new FormData();
        formData.append('to_email', to); formData.append('attachment', fileInput.files[0]);
        try {
            const res = await fetch(`${API_BASE_URL}/api/send-email`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
            const text = await res.text(); let data = {}; try { data = JSON.parse(text); } catch { }
            sendBtn.disabled = false; sendBtn.textContent = 'Send Email';
            if (!res.ok) { showPopup(data.message || 'Failed to send email', 'error'); return; }
            document.getElementById('email-to').value = ''; document.getElementById('email-file').value = '';
            showPopup('Email sent successfully ✅', 'success');
        } catch (err) { sendBtn.disabled = false; sendBtn.textContent = 'Send Email'; showPopup('Error sending email: ' + err.message, 'error'); }
    };
}

document.addEventListener("DOMContentLoaded", () => {
    const goRegister = document.getElementById("go-register");
    const goLogin = document.getElementById("go-login");
    if (goRegister) goRegister.addEventListener("click", e => { e.preventDefault(); isNavigatingInternally = true; window.location.href = "/static/register.html"; });
    if (goLogin) goLogin.addEventListener("click", e => { e.preventDefault(); isNavigatingInternally = true; window.location.href = "/static/login.html"; });
    document.addEventListener("DOMContentLoaded", updateButtons);
    document.body.addEventListener("click", e => {
        const id = e.target.id || e.target.closest("button")?.id || "";
        if (["back-to-dashboard", "nav-checklist", "nav-send-email"].includes(id) || id.startsWith("section-")) setTimeout(updateButtons, 400);
    });
    updateButtons();
});

async function clearAllSectionData() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try { await fetch(`${API_BASE_URL}/api/clear-sections`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }); } catch { }
}



// ═════════════════════════════════════════════════════════════════════════════
//  STOCK COUNT  (sheet-aware)
// ═════════════════════════════════════════════════════════════════════════════
let stockItems = [];
let filteredStockItems = [];
let activeSheetFilter = '__all__';

async function loadStockCountItems(searchQuery = '') {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
        const url = searchQuery
            ? `${API_BASE_URL}/api/get-items?search=${encodeURIComponent(searchQuery)}`
            : `${API_BASE_URL}/api/get-items`;
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        const text = await res.text();
        let data = {};
        try { data = JSON.parse(text); } catch { }
        if (!res.ok) { showPopup(data.message || 'Failed to load items', 'error'); return; }
        stockItems = data.data.items;
        filteredStockItems = stockItems;
        buildSheetTabs();
        renderStockItems();
    } catch (err) { showPopup('Error loading items: ' + err.message, 'error'); }
}

/** Build sheet tab bar from unique sheet_name values in stockItems */
function buildSheetTabs() {
    const tabBar = document.getElementById('stock-sheet-tabs');
    if (!tabBar) return;
    const sheets = [...new Set(stockItems.map(i => i.sheet_name).filter(Boolean))];
    if (sheets.length <= 1) { tabBar.classList.add('hidden'); return; }

    tabBar.classList.remove('hidden');
    tabBar.innerHTML = '';
    activeSheetFilter = '__all__';

    const makeTab = (label, value) => {
        const btn = document.createElement('button');
        btn.className = `px-4 py-1.5 rounded-full text-sm font-semibold border transition 
            ${value === activeSheetFilter ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`;
        btn.textContent = label;
        btn.dataset.sheet = value;
        btn.onclick = () => {
            activeSheetFilter = value;
            // re-apply current search
            const query = document.getElementById('stock-search')?.value.toLowerCase().trim() || '';
            applyStockFilter(query);
            // update active state
            tabBar.querySelectorAll('button').forEach(b => {
                const isActive = b.dataset.sheet === value;
                b.className = `px-4 py-1.5 rounded-full text-sm font-semibold border transition 
                    ${isActive ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`;
            });
        };
        return btn;
    };

    tabBar.appendChild(makeTab('All Sheets', '__all__'));
    sheets.forEach(s => tabBar.appendChild(makeTab(s, s)));
}

function applyStockFilter(query) {
    filteredStockItems = stockItems.filter(item => {
        const matchSheet = activeSheetFilter === '__all__' || item.sheet_name === activeSheetFilter;
        const matchSearch = !query ||
            (item.item_code || '').toLowerCase().includes(query) ||
            (item.item_name || '').toLowerCase().includes(query);
        return matchSheet && matchSearch;
    });
    renderStockItems();
}

function renderStockItems() {
    const listContainer = document.getElementById('stock-items-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (filteredStockItems.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No items found. Please ask your manager to upload item data.</p>';
        return;
    }

    // Group by sheet if showing all sheets and there are multiple sheets
    const sheets = [...new Set(filteredStockItems.map(i => i.sheet_name).filter(Boolean))];
    const isGrouped = sheets.length > 1;

    filteredStockItems.forEach((item, index) => {
        const itemCard = document.createElement('div');
        itemCard.className = 'bg-white border rounded-lg shadow-sm';
        itemCard.id = `stock-item-${index}`;
        const hasData = item.physical_amount || item.remarks;
        const sheetBadge = (item.sheet_name && isGrouped)
            ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700 mr-2">${item.sheet_name}</span>`
            : '';

        itemCard.innerHTML = `
            <div class="p-4 flex justify-between items-center cursor-pointer" id="stock-header-${index}">
                <div class="flex-1">
                    <div class="font-semibold text-gray-800">${sheetBadge}${item.item_name}</div>
                    <div class="text-sm text-gray-500">Code: ${item.item_code}${item.qty ? ` · Expected qty: ${item.qty}` : ''}</div>
                    ${hasData ? '<div class="text-xs text-green-600 mt-1"><i class="fas fa-check-circle"></i> Counted</div>' : ''}
                </div>
                <i class="fas fa-chevron-down text-gray-400 transition-transform" id="stock-arrow-${index}"></i>
            </div>
            <div class="hidden p-4 pt-0 border-t" id="stock-body-${index}">
                <div class="space-y-3">
                    ${item.qty ? `<div class="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm text-blue-700"><i class="fas fa-info-circle mr-1"></i> Expected quantity from master: <strong>${item.qty}</strong></div>` : ''}
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Physical Amount</label>
                        <input type="number" id="physical-amount-${index}" value="${item.physical_amount || ''}"
                            class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            placeholder="Enter counted amount" step="any">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                        <input type="text" id="remarks-${index}" value="${item.remarks || ''}"
                            class="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                            placeholder="Optional remarks">
                    </div>
                    <button id="save-stock-item-${index}" class="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700">Save</button>
                </div>
            </div>
        `;
        listContainer.appendChild(itemCard);

        document.getElementById(`stock-header-${index}`).onclick = () => {
            const body = document.getElementById(`stock-body-${index}`);
            const arrow = document.getElementById(`stock-arrow-${index}`);
            const isHidden = body.classList.contains('hidden');
            body.classList.toggle('hidden', !isHidden);
            arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        };

        document.getElementById(`save-stock-item-${index}`).onclick = async () => saveStockItem(item, index);
    });
}

async function saveStockItem(item, index) {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const physicalAmount = document.getElementById(`physical-amount-${index}`).value;
    const remarks = document.getElementById(`remarks-${index}`).value;
    try {
        const res = await fetch(`${API_BASE_URL}/api/save-stock-count-item`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_code: item.item_code, item_name: item.item_name, sheet_name: item.sheet_name || '', physical_amount: physicalAmount, remarks })
        });
        const text = await res.text(); let data = {}; try { data = JSON.parse(text); } catch { }
        if (!res.ok) { showPopup(data.message || 'Failed to save', 'error'); return; }
        showPopup('Item saved successfully ✅', 'success');
        item.physical_amount = physicalAmount; item.remarks = remarks;
        const query = document.getElementById('stock-search')?.value.toLowerCase().trim() || '';
        applyStockFilter(query);
    } catch (err) { showPopup('Error saving: ' + err.message, 'error'); }
}

const stockSearchInput = document.getElementById('stock-search');
if (stockSearchInput) {
    let searchTimeout;
    stockSearchInput.oninput = e => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => applyStockFilter(e.target.value.toLowerCase().trim()), 300);
    };
}

const submitStockCountBtn = document.getElementById('submit-stock-count');
if (submitStockCountBtn) {
    submitStockCountBtn.onclick = () => {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        document.getElementById('confirm-submit-msg').textContent = 'Do you want to submit the Stock Count?';
        const confirmModal = document.getElementById('confirm-submit-modal');
        confirmModal.classList.remove('hidden');

        document.getElementById('btn-submit-no').onclick = () => confirmModal.classList.add('hidden');
        document.getElementById('btn-submit-yes').onclick = async () => {
            confirmModal.classList.add('hidden');
            try {
                const res = await fetch(`${API_BASE_URL}/api/submit-stock-count`, {
                    method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
                });
                const text = await res.text(); let data = {}; try { data = JSON.parse(text); } catch { }
                if (!res.ok) { showPopup(data.message || 'Failed to submit', 'error'); return; }
                showPopup('Stock count submitted successfully ✅', 'success');
                
                // Stay on stock count page and switch to Completed tab
                document.getElementById('sc-tab-completed')?.click();
            } catch (err) { showPopup('Error submitting: ' + err.message, 'error'); }
        };
    };
}

const exportStockCountBtn = document.getElementById('export-stock-count-excel');
if (exportStockCountBtn) {
    exportStockCountBtn.onclick = async () => {
        const token = localStorage.getItem('access_token');
        if (!token) { showPopup('Please login first.', 'warning'); return; }
        exportStockCountBtn.disabled = true;
        exportStockCountBtn.textContent = 'Preparing Excel...';
        try {
            const res = await fetch(`${API_BASE_URL}/api/export-stock-count-excel`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) { let msg = await res.text(); try { msg = JSON.parse(msg).message; } catch { } showPopup(msg || 'Failed to export document.', 'error'); return; }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'Stock_Count_Report.xlsx';
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
            showPopup('Download started successfully.', 'success');
        } catch (err) { showPopup('Error exporting: ' + err.message, 'error'); }
        finally { exportStockCountBtn.disabled = false; exportStockCountBtn.textContent = 'Export to Excel'; }
    };
}

function openEmailModal(type) {
    const modal = document.getElementById('email-modal');
    modal.classList.remove('hidden');
    document.getElementById('btn-email-close').onclick = () => modal.classList.add('hidden');

    document.getElementById('btn-send-modal-email').onclick = async () => {
        const toEmail = document.getElementById('modal-email-to').value.trim();
        const bodyTxt = document.getElementById('modal-email-body').value.trim();
        if (!toEmail) { showPopup('Manager Email is required.', 'warning'); return; }

        const token = localStorage.getItem('access_token');
        const btn = document.getElementById('btn-send-modal-email');
        btn.disabled = true;
        btn.textContent = 'Generating Excel & Sending...';

        try {
            const endpoint = type === 'checklist' ? '/api/export-excel' : '/api/export-stock-count-excel';
            const resExcel = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } });
            if (!resExcel.ok) { throw new Error('Failed to generate excel attachment.'); }
            const blob = await resExcel.blob();
            const filename = type === 'checklist' ? 'Checklist_Audit.xlsx' : 'Stock_Count.xlsx';
            const file = new File([blob], filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            const formData = new FormData();
            formData.append('to_email', toEmail);
            formData.append('attachment', file);
            formData.append('email_type', type === 'checklist' ? 'checklist' : 'stock-count');

            const res = await fetch(`${API_BASE_URL}/api/send-email`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (!res.ok) throw new Error('Failed to send email.');
            showPopup('Email sent to manager successfully!', 'success');
            modal.classList.add('hidden');
        } catch (err) {
            showPopup(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Send Email with Attached Data';
        }
    };
}

document.getElementById('nav-stock-count').addEventListener('click', () => {
    // Always load items for Pending tab when Stock Count section opens
    setTimeout(() => loadStockCountItems(), 100);
});

// ═════════════════════════════════════════════════════════════════════════════
//  CHECKLIST & STOCK COUNT HISTORY
// ═════════════════════════════════════════════════════════════════════════════

async function loadChecklistHistory() {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const container = document.getElementById('checklist-history-list');
    container.innerHTML = '<p class="text-gray-400 text-center py-8">Loading…</p>';

    try {
        const res = await fetch(`${API_BASE_URL}/api/user/checklist-history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            container.innerHTML = '<p class="text-red-500 text-center py-8">Failed to load history.</p>';
            return;
        }

        const history = data.data.history;
        if (!history.length) {
            container.innerHTML = '<p class="text-gray-400 text-center py-8">No history found.</p>';
            return;
        }

        container.innerHTML = history.map((h, idx) => {
            const pct = Math.round((h.sections_completed / h.sections_total) * 100);
            const barColor = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400';
            const sectionNames = {
                general_report: 'General Report', stock_reconciliation: 'Stock Reconciliation',
                observations_on_stacking: 'Observations on Stacking',
                observations_on_warehouse_operations: 'Observations on WH Operations',
                observations_on_warehouse_record_keeping: 'Observations on WH Record Keeping',
                observations_on_wh_infrastructure: 'Observations on WH Infrastructure',
                observations_on_quality_operation: 'Observations on Quality Operation',
                checklist_wrt_exchange_circular_mentha_oil: 'Checklist Mentha Oil',
                checklist_wrt_exchange_circular_metal: 'Checklist Metals',
                checklist_wrt_exchange_circular_cotton_bales: 'Checklist Cotton Bales',
                signature: 'Signature', photo: 'Photo'
            };
            const cs = h.completion_status || {};
            const sectionBadges = Object.entries(sectionNames).map(([key, label]) =>
                `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    cs[key] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }"><i class="fas ${cs[key] ? 'fa-check-circle' : 'fa-circle'} text-xs"></i>${label}</span>`
            ).join('');
            return `
                <div class="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition">
                    <div class="flex items-center justify-between mb-2">
                        <div>
                            <div class="font-semibold text-gray-800">${h.warehouse_name}</div>
                            <div class="text-xs text-gray-500">${h.date} • Submitted: ${new Date(h.submitted_at).toLocaleString()}</div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Submitted</span>
                            <button onclick="downloadHistoryExcel('${h.audit_id}')"
                                class="px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center gap-1">
                                <i class="fas fa-download"></i> Excel
                            </button>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 mb-3">
                        <div class="flex-1 bg-gray-200 rounded-full h-2">
                            <div class="${barColor} h-2 rounded-full transition-all" style="width:${pct}%"></div>
                        </div>
                        <span class="text-xs font-semibold text-gray-600">${h.sections_completed}/${h.sections_total}</span>
                    </div>
                    <button onclick="toggleHistoryDetails('hist-${idx}')" class="text-xs text-indigo-600 hover:underline mb-2 flex items-center gap-1">
                        <i class="fas fa-chevron-down" id="hist-arrow-${idx}"></i> View Sections
                    </button>
                    <div id="hist-${idx}" class="hidden flex flex-wrap gap-1.5 mt-1">${sectionBadges}</div>
                </div>
            `;
        }).join('');
    } catch (err) {
        container.innerHTML = '<p class="text-red-500 text-center py-8">Error loading history.</p>';
    }
}

async function loadStockCountHistory(tab) {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    
    const completedContainer = document.getElementById('sc-completed-list');
    const historyContainer = document.getElementById('sc-history-list');
    
    if (tab === 'completed') completedContainer.innerHTML = '<p class="text-gray-400 text-center py-8">Loading…</p>';
    if (tab === 'history') historyContainer.innerHTML = '<p class="text-gray-400 text-center py-8">Loading…</p>';

    try {
        const res = await fetch(`${API_BASE_URL}/api/user/stock-count-history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            if (tab === 'completed') completedContainer.innerHTML = '<p class="text-red-500 text-center py-8">Failed to load.</p>';
            if (tab === 'history') historyContainer.innerHTML = '<p class="text-red-500 text-center py-8">Failed to load.</p>';
            return;
        }

        if (tab === 'completed') {
            const completed = data.data.completed;
            if (!completed.length) {
                completedContainer.innerHTML = '<p class="text-gray-400 text-center py-8">No completed stock count for today.</p>';
            } else {
                completedContainer.innerHTML = completed.map((c, idx) => `
                    <div class="bg-white rounded-lg shadow-sm border p-4">
                        <div class="flex items-center justify-between mb-2 cursor-pointer" onclick="toggleCompletedDetails('completed-${idx}')">
                            <div class="flex-1">
                                <div class="font-semibold text-gray-800">Stock Count - ${c.date}</div>
                                <div class="text-xs text-gray-500">Submitted: ${new Date(c.submitted_at).toLocaleString()}</div>
                                <div class="text-sm text-gray-600 mt-1">
                                    <span class="font-semibold text-indigo-600">${c.items_count}</span> items counted
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Completed</span>
                                <button onclick="event.stopPropagation(); downloadStockCountExcel('${c.audit_id}')"
                                    class="px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center gap-1">
                                    <i class="fas fa-download"></i> Excel
                                </button>
                                <i class="fas fa-chevron-down transition-transform" id="completed-arrow-${idx}"></i>
                            </div>
                        </div>
                        <div id="completed-${idx}" class="hidden mt-3 border-t pt-3">
                            <div class="text-sm font-semibold text-gray-700 mb-2">Items Counted:</div>
                            <div class="space-y-2 max-h-64 overflow-y-auto">
                                ${c.stock_count_data.map(item => `
                                    <div class="bg-gray-50 p-2 rounded border border-gray-200">
                                        <div class="font-medium text-gray-800">${item.item_name || 'N/A'}</div>
                                        <div class="text-xs text-gray-600">Code: ${item.item_code || 'N/A'} ${item.sheet_name ? '• Sheet: ' + item.sheet_name : ''}</div>
                                        <div class="text-xs text-gray-600">Expected: ${item.qty || 'N/A'} • Counted: ${item.physical_amount || 'N/A'}</div>
                                        ${item.remarks ? `<div class="text-xs text-gray-500 italic mt-1">Remarks: ${item.remarks}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }

        if (tab === 'history') {
            const history = data.data.history;
            if (!history.length) {
                historyContainer.innerHTML = '<p class="text-gray-400 text-center py-8">No history found.</p>';
            } else {
                historyContainer.innerHTML = history.map((h, idx) => `
                    <div class="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition">
                        <div class="flex items-center justify-between mb-2 cursor-pointer" onclick="toggleCompletedDetails('history-${idx}')">
                            <div class="flex-1">
                                <div class="font-semibold text-gray-800">Stock Count - ${h.date}</div>
                                <div class="text-xs text-gray-500">Submitted: ${new Date(h.submitted_at).toLocaleString()}</div>
                                <div class="text-sm text-gray-600 mt-1">
                                    <span class="font-semibold text-indigo-600">${h.items_count}</span> items counted
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Submitted</span>
                                <button onclick="event.stopPropagation(); downloadStockCountExcel('${h.audit_id}')"
                                    class="px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center gap-1">
                                    <i class="fas fa-download"></i> Excel
                                </button>
                                <i class="fas fa-chevron-down transition-transform" id="history-arrow-${idx}"></i>
                            </div>
                        </div>
                        <div id="history-${idx}" class="hidden mt-3 border-t pt-3">
                            <div class="text-sm font-semibold text-gray-700 mb-2">Items Counted:</div>
                            <div class="space-y-2 max-h-64 overflow-y-auto">
                                ${h.stock_count_data.map(item => `
                                    <div class="bg-gray-50 p-2 rounded border border-gray-200">
                                        <div class="font-medium text-gray-800">${item.item_name || 'N/A'}</div>
                                        <div class="text-xs text-gray-600">Code: ${item.item_code || 'N/A'} ${item.sheet_name ? '• Sheet: ' + item.sheet_name : ''}</div>
                                        <div class="text-xs text-gray-600">Expected: ${item.qty || 'N/A'} • Counted: ${item.physical_amount || 'N/A'}</div>
                                        ${item.remarks ? `<div class="text-xs text-gray-500 italic mt-1">Remarks: ${item.remarks}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        if (tab === 'completed') completedContainer.innerHTML = '<p class="text-red-500 text-center py-8">Error loading.</p>';
        if (tab === 'history') historyContainer.innerHTML = '<p class="text-red-500 text-center py-8">Error loading.</p>';
    }
}

function toggleHistoryDetails(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isHidden = el.classList.contains('hidden');
    el.classList.toggle('hidden', !isHidden);
    const idx = id.split('hist-')[1];
    const arrow = document.getElementById(`hist-arrow-${idx}`);
    if (arrow) arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
}

function toggleCompletedDetails(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const isHidden = el.classList.contains('hidden');
    el.classList.toggle('hidden', !isHidden);
    const prefix = id.split('-')[0]; // 'completed' or 'history'
    const idx = id.split('-')[1];
    const arrow = document.getElementById(`${prefix}-arrow-${idx}`);
    if (arrow) arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
}

async function downloadHistoryExcel(audit_id) {
    const token = localStorage.getItem('access_token');
    if (!token) { showPopup('Please login first.', 'warning'); return; }
    try {
        const res = await fetch(`${API_BASE_URL}/api/export-excel-by-id?audit_id=${encodeURIComponent(audit_id)}`, {
            method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            let msg = 'Failed to download.';
            try { msg = (await res.json()).message || msg; } catch {}
            showPopup(msg, 'error'); return;
        }
        const blob = await res.blob();
        const contentDisposition = res.headers.get('Content-Disposition');
        let filename = `Audit_${audit_id}.xlsx`;
        if (contentDisposition) {
            const matches = /filename\*?=(?:UTF-8'')?([^;]+)/.exec(contentDisposition);
            if (matches && matches[1]) {
                filename = decodeURIComponent(matches[1].replace(/['"]/g, ''));
            }
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        window.URL.revokeObjectURL(url);
        showPopup('Download started.', 'success');
    } catch (err) { showPopup('Error: ' + err.message, 'error'); }
}

async function downloadStockCountExcel(audit_id) {
    const token = localStorage.getItem('access_token');
    if (!token) { showPopup('Please login first.', 'warning'); return; }
    try {
        const res = await fetch(`${API_BASE_URL}/api/export-stock-count-excel-by-id?audit_id=${encodeURIComponent(audit_id)}`, {
            method: 'GET', headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) {
            let msg = 'Failed to download.';
            try { msg = (await res.json()).message || msg; } catch {}
            showPopup(msg, 'error'); return;
        }
        const blob = await res.blob();
        const contentDisposition = res.headers.get('Content-Disposition');
        let filename = `StockCount_${audit_id}.xlsx`;
        if (contentDisposition) {
            const matches = /filename\*?=(?:UTF-8'')?([^;]+)/.exec(contentDisposition);
            if (matches && matches[1]) {
                filename = decodeURIComponent(matches[1].replace(/['"]/g, ''));
            }
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        window.URL.revokeObjectURL(url);
        showPopup('Download started.', 'success');
    } catch (err) { showPopup('Error: ' + err.message, 'error'); }
}