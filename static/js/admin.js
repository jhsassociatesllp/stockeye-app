document.addEventListener("DOMContentLoaded", () => {
    // ---- Auth Check ----
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.href = '/static/login.html';
        return;
    }

    const bearerToken = `Bearer ${token}`;
    
    // Check Admin rights
    fetch('/api/check-admin', { headers: { 'Authorization': bearerToken } })
        .then(r => r.json()).then(res => {
            if (!res.success || !res.data.is_admin) {
                alert("Unauthorized Access!");
                window.location.href = '/';
            } else {
                initAdmin();
            }
        });

    function initAdmin() {
        // ─────────────────────────────────────────────────────────────────────
        //  MOBILE MENU HANDLERS
        // ─────────────────────────────────────────────────────────────────────
        const sidebar = document.getElementById('admin-sidebar');
        const mobileMenuBtn = document.getElementById('mobile-menu-btn');
        const mobileCloseBtn = document.getElementById('mobile-close-btn');
        const mobileOverlay = document.getElementById('mobile-overlay');

        mobileMenuBtn.addEventListener('click', () => {
            sidebar.classList.add('mobile-open');
            mobileOverlay.classList.add('active');
        });

        mobileCloseBtn.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            mobileOverlay.classList.remove('active');
        });

        mobileOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            mobileOverlay.classList.remove('active');
        });

        // Init Views
        const sections = document.querySelectorAll('.view-section');
        document.querySelectorAll('.sidebar-item').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                sections.forEach(s => s.classList.add('hidden'));
                document.getElementById(btn.dataset.target + '-view').classList.remove('hidden');
                
                // Close mobile menu after selection
                sidebar.classList.remove('mobile-open');
                mobileOverlay.classList.remove('active');
            });
        });

        document.getElementById('back-to-app').addEventListener('click', () => {
            const overlay = document.createElement('div');
            overlay.className = "fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50";
            const modal = document.createElement('div');
            modal.className = "bg-white p-6 rounded-xl shadow-lg text-center w-80";
            modal.innerHTML = `<h2 class="text-lg font-semibold mb-3 text-gray-800">Do you want to switch to User Dashboard?</h2><div class="flex justify-center gap-4 mt-4"><button id="confirm-switch-user" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg">Yes</button><button id="cancel-switch-user" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-lg">No</button></div>`;
            overlay.appendChild(modal);
            document.body.appendChild(overlay);
            document.getElementById('cancel-switch-user').onclick = () => overlay.remove();
            document.getElementById('confirm-switch-user').onclick = () => {
                window.location.href = '/static/index.html';
            };
        });

        // Tabs
        const tabChecklist = document.getElementById('tab-btn-checklist');
        const tabStockcount = document.getElementById('tab-btn-stockcount');
        tabChecklist.addEventListener('click', () => switchTab('checklist', tabChecklist, tabStockcount));
        tabStockcount.addEventListener('click', () => switchTab('stockcount', tabStockcount, tabChecklist));

        function switchTab(target, activeBtn, inactiveBtn) {
            activeBtn.classList.add('text-indigo-600', 'border-indigo-600');
            activeBtn.classList.remove('text-gray-500', 'border-transparent');
            inactiveBtn.classList.remove('text-indigo-600', 'border-indigo-600');
            inactiveBtn.classList.add('text-gray-500', 'border-transparent');
            
            document.querySelectorAll('.data-tab-content').forEach(el => el.classList.add('hidden'));
            document.getElementById('tab-' + target).classList.remove('hidden');
        }

        loadHistory();
        loadChecklistsData();
        loadEmployees();
        loadAuditDashboard();
        loadWarehouseMaster();
        loadWarehouseStatus();
        initAnalytics();
        initDataSearch();
        initDetailModal();
    }

    // ─────────────────────────────────────────────────────────────────────
    //  AUDIT COMPLETION DASHBOARD
    // ─────────────────────────────────────────────────────────────────────
    let dashboardRows = [];

    function loadAuditDashboard() {
        fetch('/api/admin/audit-dashboard', { headers: { 'Authorization': bearerToken } })
            .then(r => r.json()).then(res => {
                if (!res.success) return;
                dashboardRows = res.data.rows;
                renderDashboard();
            }).catch(() => {});
    }

    function renderDashboard() {
        const dateFilter   = document.getElementById('dash-filter-date').value;
        const userFilter   = document.getElementById('dash-filter-user').value.toLowerCase().trim();
        const statusFilter = document.getElementById('dash-filter-status').value;

        const filtered = dashboardRows.filter(r => {
            if (dateFilter   && r.date !== dateFilter) return false;
            if (userFilter   && !r.user_id.toLowerCase().includes(userFilter)) return false;
            if (statusFilter && r.status !== statusFilter) return false;
            return true;
        });

        // Summary cards
        document.getElementById('dash-total').textContent       = filtered.length;
        document.getElementById('dash-submitted').textContent   = filtered.filter(r => r.status === 'Submitted').length;
        document.getElementById('dash-inprogress').textContent  = filtered.filter(r => r.status === 'In Progress').length;
        document.getElementById('dash-sc-submitted').textContent = filtered.filter(r => r.stock_count_submitted).length;

        // Checklist table
        const clBody = document.getElementById('dash-checklist-body');
        clBody.innerHTML = '';
        if (!filtered.length) {
            clBody.innerHTML = '<tr><td colspan="6" class="py-6 text-center text-gray-400">No records found.</td></tr>';
        } else {
            filtered.forEach(r => {
                const pct = r.checklist_pct;
                const barColor = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400';
                
                // Status badge based on checklist_status
                let badge = '';
                if (r.checklist_status === 'Submitted') {
                    badge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Submitted</span>';
                } else if (r.checklist_status === 'In Progress') {
                    badge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">In Progress</span>';
                } else {
                    badge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Pending</span>';
                }
                
                clBody.innerHTML += `<tr class="hover:bg-gray-50">
                    <td class="py-2 px-4">${r.date}</td>
                    <td class="py-2 px-4 text-xs">${r.user_id}</td>
                    <td class="py-2 px-4">${r.warehouse_name}</td>
                    <td class="py-2 px-4 min-w-[160px]">
                        <div class="flex items-center gap-2">
                            <div class="flex-1 bg-gray-200 rounded-full h-2">
                                <div class="${barColor} h-2 rounded-full transition-all" style="width:${pct}%"></div>
                            </div>
                            <span class="text-xs font-semibold text-gray-600 w-16">${r.checklist_completed}/${r.checklist_total}</span>
                        </div>
                    </td>
                    <td class="py-2 px-4">${badge}</td>
                    <td class="py-2 px-4 text-xs text-gray-500">${r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}</td>
                </tr>`;
            });
        }

        // Stock Count table
        const scBody = document.getElementById('dash-stockcount-body');
        scBody.innerHTML = '';
        if (!filtered.length) {
            scBody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-gray-400">No records found.</td></tr>';
        } else {
            filtered.forEach(r => {
                const scBadge = r.stock_count_status === 'Submitted'
                    ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Submitted</span>'
                    : '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">In Progress</span>';
                
                const auditBadge = r.checklist_status === 'Submitted'
                    ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Submitted</span>'
                    : r.checklist_status === 'In Progress'
                    ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">In Progress</span>'
                    : '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Pending</span>';
                
                // Progress bar for stock count (assume total items from item_master or show count)
                const itemCount = r.stock_count_items;
                const barColor = r.stock_count_submitted ? 'bg-green-500' : 'bg-yellow-400';
                
                scBody.innerHTML += `<tr class="hover:bg-gray-50">
                    <td class="py-2 px-4">${r.date}</td>
                    <td class="py-2 px-4 text-xs">${r.user_id}</td>
                    <td class="py-2 px-4">${r.warehouse_name}</td>
                    <td class="py-2 px-4 min-w-[140px]">
                        <div class="flex items-center gap-2">
                            <div class="flex-1 bg-gray-200 rounded-full h-2">
                                <div class="${barColor} h-2 rounded-full transition-all" style="width:${itemCount > 0 ? '100' : '0'}%"></div>
                            </div>
                            <span class="text-xs font-semibold text-indigo-600">${itemCount}</span>
                        </div>
                    </td>
                    <td class="py-2 px-4">${scBadge}</td>
                    <td class="py-2 px-4">${auditBadge}</td>
                </tr>`;
            });
        }
    }

    // Dashboard tab switching
    document.getElementById('dash-tab-checklist').addEventListener('click', () => {
        document.getElementById('dash-checklist-tab').classList.remove('hidden');
        document.getElementById('dash-stockcount-tab').classList.add('hidden');
        document.getElementById('dash-tab-checklist').className = 'px-4 py-2 font-semibold text-indigo-600 border-b-2 border-indigo-600 text-sm';
        document.getElementById('dash-tab-stockcount').className = 'px-4 py-2 font-semibold text-gray-500 border-b-2 border-transparent text-sm';
    });
    document.getElementById('dash-tab-stockcount').addEventListener('click', () => {
        document.getElementById('dash-stockcount-tab').classList.remove('hidden');
        document.getElementById('dash-checklist-tab').classList.add('hidden');
        document.getElementById('dash-tab-stockcount').className = 'px-4 py-2 font-semibold text-indigo-600 border-b-2 border-indigo-600 text-sm';
        document.getElementById('dash-tab-checklist').className = 'px-4 py-2 font-semibold text-gray-500 border-b-2 border-transparent text-sm';
    });

    // Dashboard filters
    ['dash-filter-date', 'dash-filter-user', 'dash-filter-status'].forEach(id => {
        document.getElementById(id).addEventListener('input', renderDashboard);
        document.getElementById(id).addEventListener('change', renderDashboard);
    });
    document.getElementById('dash-refresh').addEventListener('click', loadAuditDashboard);

    // ─────────────────────────────────────────────────────────────────────
    //  WAREHOUSE MASTER
    // ─────────────────────────────────────────────────────────────────────
    let whParsedData = [];   // [{warehouse_name, warehouse_address}]
    let whWorkbook = null;

    function loadWarehouseMaster() {
        fetch('/api/admin/warehouse-master', { headers: { 'Authorization': bearerToken } })
            .then(r => r.json()).then(res => {
                if (!res.success) return;
                renderWarehouseTable(res.data.warehouses);
            }).catch(() => {});
    }

    function renderWarehouseTable(warehouses) {
        const tbody = document.getElementById('wh-table-body');
        document.getElementById('wh-count').textContent = `${warehouses.length} warehouse(s)`;
        if (!warehouses.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="py-6 text-center text-gray-400">No warehouses uploaded yet.</td></tr>';
            return;
        }
        tbody.innerHTML = warehouses.map((w, i) => `
            <tr class="hover:bg-gray-50">
                <td class="py-2 px-4 text-gray-400">${i + 1}</td>
                <td class="py-2 px-4 font-medium">${w.warehouse_name}</td>
                <td class="py-2 px-4 text-gray-600 text-xs">${w.warehouse_address || '—'}</td>
            </tr>`).join('');
    }

    // File input
    const whFileInput = document.getElementById('wh-upload-file');
    whFileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        document.getElementById('wh-file-name').textContent = file.name;
        document.getElementById('wh-file-info').classList.remove('hidden');

        const reader = new FileReader();
        reader.onload = ev => {
            whWorkbook = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
            const sheetName = whWorkbook.SheetNames[0];
            const rows = XLSX.utils.sheet_to_json(whWorkbook.Sheets[sheetName], { header: 1, defval: '' });

            // Find header row (first non-empty row)
            let hdrIdx = 0;
            for (let i = 0; i < Math.min(rows.length, 10); i++) {
                if (rows[i].some(c => String(c).trim())) { hdrIdx = i; break; }
            }
            const headers = rows[hdrIdx];
            const dataRows = rows.slice(hdrIdx + 1);

            // Build select options
            const opts = headers.map((h, i) => `<option value="${i}">${h || 'Col ' + (i + 1)}</option>`).join('');
            document.getElementById('wh-map-name').innerHTML = opts;
            document.getElementById('wh-map-address').innerHTML = opts;

            // Auto-detect: name col = has both "name" AND "warehouse"; address col = has "address"
            let nameIdx = -1, addrIdx = -1;
            headers.forEach((h, i) => {
                const hl = String(h).toLowerCase();
                if (hl.includes('name') && hl.includes('warehouse')) nameIdx = i;
                else if (hl.includes('address')) addrIdx = i;
            });
            // Fallback: separate columns
            if (nameIdx === -1) headers.forEach((h, i) => { if (String(h).toLowerCase().includes('name')) nameIdx = i; });
            if (nameIdx === -1) headers.forEach((h, i) => { if (String(h).toLowerCase().includes('warehouse')) nameIdx = i; });

            if (nameIdx >= 0) document.getElementById('wh-map-name').value = nameIdx;
            if (addrIdx >= 0) document.getElementById('wh-map-address').value = addrIdx;

            // Preview first 3 rows
            const preview = dataRows.slice(0, 3).map(r =>
                `<span class="inline-block bg-gray-100 rounded px-2 py-0.5 mr-1 mb-1">${String(r[nameIdx] || '').trim() || '?'}</span>`
            ).join('');
            document.getElementById('wh-preview').innerHTML = preview
                ? `<span class="font-semibold text-gray-600">Preview: </span>${preview}`
                : '';

            // Store parsed rows for upload
            whParsedData = dataRows;
            document.getElementById('wh-col-map').classList.remove('hidden');
            document.getElementById('wh-upload-btn').disabled = false;
        };
        reader.readAsArrayBuffer(file);
    });

    document.getElementById('wh-file-clear').addEventListener('click', () => {
        whFileInput.value = '';
        whWorkbook = null;
        whParsedData = [];
        document.getElementById('wh-file-info').classList.add('hidden');
        document.getElementById('wh-col-map').classList.add('hidden');
        document.getElementById('wh-upload-btn').disabled = true;
    });

    // Re-preview when mapping changes
    ['wh-map-name', 'wh-map-address'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            const ni = parseInt(document.getElementById('wh-map-name').value);
            const preview = whParsedData.slice(0, 3).map(r =>
                `<span class="inline-block bg-gray-100 rounded px-2 py-0.5 mr-1 mb-1">${String(r[ni] || '').trim() || '?'}</span>`
            ).join('');
            document.getElementById('wh-preview').innerHTML = preview
                ? `<span class="font-semibold text-gray-600">Preview: </span>${preview}` : '';
        });
    });

    document.getElementById('wh-upload-btn').addEventListener('click', async () => {
        const ni = parseInt(document.getElementById('wh-map-name').value);
        const ai = parseInt(document.getElementById('wh-map-address').value);
        const warehouses = whParsedData
            .map(r => ({ warehouse_name: String(r[ni] || '').trim(), warehouse_address: String(r[ai] || '').trim() }))
            .filter(w => w.warehouse_name);

        if (!warehouses.length) { alert('No valid warehouse names found. Check column mapping.'); return; }

        const btn = document.getElementById('wh-upload-btn');
        btn.disabled = true; btn.textContent = 'Uploading…';

        try {
            const res = await fetch('/api/admin/warehouse-master', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': bearerToken },
                body: JSON.stringify({ warehouses })
            });
            const data = await res.json();
            if (data.success) {
                alert(`✅ ${data.message}`);
                document.getElementById('wh-file-clear').click();
                loadWarehouseMaster();
            } else {
                alert('Upload failed: ' + data.message);
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            btn.disabled = false; btn.textContent = '⬆ Upload Warehouses';
        }
    });

    // ─────────────────────────────────────────────────────────────────────
    //  WAREHOUSE AUDIT STATUS
    // ─────────────────────────────────────────────────────────────────────
    let warehouseStatusData = [];

    function loadWarehouseStatus() {
        const dateFilter = document.getElementById('wh-status-date').value || '';
        
        fetch(`/api/admin/warehouse-status?date=${dateFilter}`, { headers: { 'Authorization': bearerToken } })
            .then(r => r.json())
            .then(res => {
                if (!res.success) return;
                warehouseStatusData = res.data.warehouses;
                renderWarehouseStatus();
            })
            .catch(err => console.error('Warehouse status error:', err));
    }

    function renderWarehouseStatus() {
        const statusFilter = document.getElementById('wh-status-filter').value;
        
        let filtered = warehouseStatusData;
        if (statusFilter) {
            filtered = warehouseStatusData.filter(wh => wh.status === statusFilter);
        }

        // Update summary cards
        document.getElementById('wh-status-total').textContent = warehouseStatusData.length;
        document.getElementById('wh-status-completed').textContent = warehouseStatusData.filter(w => w.status === 'Completed').length;
        document.getElementById('wh-status-inprogress').textContent = warehouseStatusData.filter(w => w.status === 'In Progress').length;
        document.getElementById('wh-status-notstarted').textContent = warehouseStatusData.filter(w => w.status === 'Not Started').length;

        // Render table
        const tbody = document.getElementById('wh-status-table-body');
        tbody.innerHTML = '';

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-gray-400">No warehouses found</td></tr>';
            return;
        }

        filtered.forEach(wh => {
            // Status badge
            let statusBadge = '';
            if (wh.status === 'Completed') {
                statusBadge = '<span class="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"><i class="fas fa-check-circle mr-1"></i>Completed</span>';
            } else if (wh.status === 'In Progress') {
                statusBadge = '<span class="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700"><i class="fas fa-clock mr-1"></i>In Progress</span>';
            } else {
                statusBadge = '<span class="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700"><i class="fas fa-exclamation-circle mr-1"></i>Not Started</span>';
            }

            // Progress bar
            const progressPct = wh.progress_percentage || 0;
            const barColor = progressPct === 100 ? 'bg-green-500' : progressPct >= 50 ? 'bg-yellow-400' : 'bg-red-400';

            // Assigned users
            const assignedUsers = wh.assigned_users && wh.assigned_users.length > 0
                ? wh.assigned_users.map(u => `<span class="inline-block bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full mr-1 mb-1">${u.split('@')[0]}</span>`).join('')
                : '<span class="text-gray-400 text-xs">Not assigned</span>';

            tbody.innerHTML += `<tr class="hover:bg-gray-50">
                <td class="py-3 px-4 font-medium">${wh.warehouse_name}</td>
                <td class="py-3 px-4 text-xs text-gray-600">${wh.warehouse_address || '—'}</td>
                <td class="py-3 px-4">${statusBadge}</td>
                <td class="py-3 px-4">${assignedUsers}</td>
                <td class="py-3 px-4 min-w-[180px]">
                    <div class="flex items-center gap-2">
                        <div class="flex-1 bg-gray-200 rounded-full h-2">
                            <div class="${barColor} h-2 rounded-full transition-all" style="width:${progressPct}%"></div>
                        </div>
                        <span class="text-xs font-semibold text-gray-600 w-12">${progressPct}%</span>
                    </div>
                </td>
                <td class="py-3 px-4 text-xs text-gray-500">${wh.last_updated || '—'}</td>
                <td class="py-3 px-4">
                    ${wh.audit_id ? `<button class="text-indigo-600 hover:underline text-xs" onclick="window.viewWarehouseAuditDetail('${wh.audit_id}')">
                        <i class="fas fa-eye mr-1"></i>View Details
                    </button>` : '<span class="text-gray-400 text-xs">No audit</span>'}
                </td>
            </tr>`;
        });
    }

    // Warehouse status filters
    document.getElementById('wh-status-date').addEventListener('change', loadWarehouseStatus);
    document.getElementById('wh-status-filter').addEventListener('change', renderWarehouseStatus);
    document.getElementById('wh-status-refresh').addEventListener('click', loadWarehouseStatus);

    window.viewWarehouseAuditDetail = function(auditId) {
        // Find the audit in globalAuditData
        const auditIdx = globalAuditData.findIndex(a => a._id === auditId || a.audit_id === auditId);
        if (auditIdx >= 0) {
            window.viewAuditDetail(auditIdx, 'checklist');
        } else {
            alert('Audit details not found. Please refresh the data.');
        }
    };

    // --- Loading Data APIs ---
    let globalAuditData = [];

    function loadHistory() {
        fetch('/api/admin/uploaded-history', { headers: { 'Authorization': bearerToken } })
            .then(r => r.json()).then(res => {
                if (res.success) {
                    const cont = document.getElementById('upload-history-container');
                    cont.innerHTML = '';
                    if(!res.data.history.length) {
                        cont.innerHTML = '<p class="text-sm text-gray-500">No previous uploads found.</p>';
                        return;
                    }
                    const tbl = document.createElement('table');
                    tbl.className = 'w-full text-sm text-left border-collapse';
                    tbl.innerHTML = `<thead><tr class="border-b bg-gray-50"><th class="py-2 px-3">Date</th><th class="py-2 px-3">By</th><th class="py-2 px-3">Items Uploaded</th></tr></thead><tbody></tbody>`;
                    res.data.history.forEach(h => {
                        tbl.querySelector('tbody').innerHTML += `<tr class="border-b">
                            <td class="py-2 px-3">${new Date(h.uploaded_at).toLocaleString()}</td>
                            <td class="py-2 px-3">${h.uploaded_by}</td>
                            <td class="py-2 px-3 font-semibold text-indigo-600">${h.total_items}</td>
                        </tr>`;
                    });
                    cont.appendChild(tbl);
                }
            });
    }

    function loadChecklistsData() {
        fetch('/api/admin/checklist-data', { headers: { 'Authorization': bearerToken } })
            .then(r => r.json()).then(res => {
                if (res.success) {
                    globalAuditData = res.data.checklists;
                    renderDataTables(globalAuditData);
                }
            });
    }

    function renderDataTables(data) {
        const cTbody = document.getElementById('checklist-table-body');
        const sTbody = document.getElementById('stockcount-table-body');
        cTbody.innerHTML = ''; sTbody.innerHTML = '';

        if (!data.length) {
            cTbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-400">No data found</td></tr>';
            sTbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-400">No data found</td></tr>';
            return;
        }

        data.forEach((audit, idx) => {
            const dateStr = audit.submitted_at || audit.date;
            const warehouse = audit.warehouse_name || audit.general_report?.warehouse_name || '—';
            
            // Checklist Row
            let acts = Object.values(audit.completion_status || {}).filter(Boolean).length;
            cTbody.innerHTML += `<tr class="hover:bg-gray-50">
                <td class="py-2 px-4">${dateStr}</td>
                <td class="py-2 px-4 text-xs">${audit.user_id}</td>
                <td class="py-2 px-4">${warehouse}</td>
                <td class="py-2 px-4">${acts} sections</td>
                <td class="py-2 px-4">
                    <button class="text-indigo-600 hover:underline text-xs mr-2" onclick="window.viewAuditDetail(${idx}, 'checklist')">
                        <i class="fas fa-eye mr-1"></i>View
                    </button>
                    <button class="text-green-600 hover:underline text-xs" onclick="window.exportSingleAudit(${idx}, 'checklist')">
                        <i class="fas fa-download mr-1"></i>Export
                    </button>
                </td>
            </tr>`;
            
            // Stock count row
            let sc = (audit.stock_count_data || []).length;
            sTbody.innerHTML += `<tr class="hover:bg-gray-50">
                <td class="py-2 px-4">${dateStr}</td>
                <td class="py-2 px-4 text-xs">${audit.user_id}</td>
                <td class="py-2 px-4">${warehouse}</td>
                <td class="py-2 px-4">${sc} items</td>
                <td class="py-2 px-4">
                    <button class="text-indigo-600 hover:underline text-xs mr-2" onclick="window.viewAuditDetail(${idx}, 'stockcount')">
                        <i class="fas fa-eye mr-1"></i>View
                    </button>
                    <button class="text-green-600 hover:underline text-xs" onclick="window.exportSingleAudit(${idx}, 'stockcount')">
                        <i class="fas fa-download mr-1"></i>Export
                    </button>
                </td>
            </tr>`;
        });
    }

    let allEmployees = [];

    function loadEmployees() {
        fetch('/api/admin/employees-stats', { headers: { 'Authorization': bearerToken } })
            .then(r => r.json()).then(res => {
                if(res.success && res.data.users) {
                    allEmployees = res.data.users;
                    renderEmployees(allEmployees);
                }
            });
    }

    function renderEmployees(employees) {
        const b = document.getElementById('employees-table-body');
        b.innerHTML = '';
        if (!employees.length) {
            b.innerHTML = '<tr><td colspan="2" class="py-4 text-center text-gray-400">No employees found</td></tr>';
            return;
        }
        employees.forEach(u => {
            b.innerHTML += `<tr class="hover:bg-gray-50">
                <td class="py-2 px-4">${u.email}</td>
                <td class="py-2 px-4">${u.name}</td>
            </tr>`;
        });
    }

    // Employee search
    document.getElementById('employee-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            renderEmployees(allEmployees);
            return;
        }
        const filtered = allEmployees.filter(emp => 
            emp.email.toLowerCase().includes(query) || 
            emp.name.toLowerCase().includes(query)
        );
        renderEmployees(filtered);
    });

    document.getElementById('export-checklist-all').addEventListener('click', () => exportToCSV(globalAuditData, 'checklist'));
    document.getElementById('export-stockcount-all').addEventListener('click', () => exportToCSV(globalAuditData, 'stockcount'));

    function exportToCSV(data, mode) {
        if(!data || !data.length) { alert("No data"); return; }
        const wb = XLSX.utils.book_new();
        // Super simple flatten logic for admin export
        let rows = [];
        data.forEach(d => {
            if(mode === 'stockcount' && d.stock_count_data) {
                d.stock_count_data.forEach(sc => {
                    rows.push({ Date: d.date, User: d.user_id, ItemCode: sc.item_code, ItemName: sc.item_name, ExpectedQty: sc.qty, PhysicalQty: sc.physical_amount, Remarks: sc.remarks, Sheet: sc.sheet_name });
                });
            } else if (mode === 'checklist') {
                rows.push({ Date: d.date, User: d.user_id, Submitted: d.submitted_at || '' });
            }
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "Data");
        XLSX.writeFile(wb, `Admin_${mode}_Export.xlsx`);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  DATA SEARCH & FILTER
    // ─────────────────────────────────────────────────────────────────────
    function initDataSearch() {
        document.getElementById('data-search-btn').addEventListener('click', () => {
            const userQuery = document.getElementById('data-search-user').value.toLowerCase().trim();
            const dateQuery = document.getElementById('data-search-date').value;
            const warehouseQuery = document.getElementById('data-search-warehouse').value.toLowerCase().trim();

            const filtered = globalAuditData.filter(audit => {
                if (userQuery && !audit.user_id.toLowerCase().includes(userQuery)) return false;
                if (dateQuery && audit.date !== dateQuery) return false;
                const warehouse = (audit.warehouse_name || audit.general_report?.warehouse_name || '').toLowerCase();
                if (warehouseQuery && !warehouse.includes(warehouseQuery)) return false;
                return true;
            });

            renderDataTables(filtered);
        });

        document.getElementById('data-clear-btn').addEventListener('click', () => {
            document.getElementById('data-search-user').value = '';
            document.getElementById('data-search-date').value = '';
            document.getElementById('data-search-warehouse').value = '';
            renderDataTables(globalAuditData);
        });
    }

    // ─────────────────────────────────────────────────────────────────────
    //  DETAIL MODAL
    // ─────────────────────────────────────────────────────────────────────
    function initDetailModal() {
        document.getElementById('close-detail-modal').addEventListener('click', () => {
            document.getElementById('detail-modal').classList.add('hidden');
        });
    }

    window.viewAuditDetail = function(idx, type) {
        const audit = globalAuditData[idx];
        if (!audit) return;

        const modal = document.getElementById('detail-modal');
        const content = document.getElementById('detail-modal-content');
        
        let html = `<div class="space-y-4">`;
        html += `<div class="grid grid-cols-2 gap-4 text-sm">
            <div><span class="font-semibold text-gray-600">User:</span> ${audit.user_id}</div>
            <div><span class="font-semibold text-gray-600">Date:</span> ${audit.date}</div>
            <div><span class="font-semibold text-gray-600">Warehouse:</span> ${audit.warehouse_name || audit.general_report?.warehouse_name || '—'}</div>
            <div><span class="font-semibold text-gray-600">Submitted:</span> ${audit.submitted_at || 'Not yet'}</div>
        </div>`;

        if (type === 'checklist') {
            html += `<h4 class="font-bold text-lg mt-4 mb-2 text-indigo-600">Checklist Sections</h4>`;
            const sections = audit.completion_status || {};
            Object.keys(sections).forEach(key => {
                const status = sections[key] ? '✅ Complete' : '❌ Incomplete';
                html += `<div class="flex items-center justify-between py-2 px-3 bg-gray-50 rounded mb-2">
                    <span class="font-medium">${key.replace(/_/g, ' ').toUpperCase()}</span>
                    <span class="${sections[key] ? 'text-green-600' : 'text-red-500'}">${status}</span>
                </div>`;
            });
        } else if (type === 'stockcount') {
            html += `<h4 class="font-bold text-lg mt-4 mb-2 text-indigo-600">Stock Count Items (${(audit.stock_count_data || []).length})</h4>`;
            html += `<div class="overflow-x-auto"><table class="min-w-full text-xs border">
                <thead class="bg-gray-100"><tr>
                    <th class="py-2 px-3 text-left">Item Code</th>
                    <th class="py-2 px-3 text-left">Item Name</th>
                    <th class="py-2 px-3 text-left">Expected</th>
                    <th class="py-2 px-3 text-left">Physical</th>
                    <th class="py-2 px-3 text-left">Remarks</th>
                </tr></thead><tbody>`;
            (audit.stock_count_data || []).forEach(item => {
                html += `<tr class="border-b hover:bg-gray-50">
                    <td class="py-2 px-3">${item.item_code}</td>
                    <td class="py-2 px-3">${item.item_name}</td>
                    <td class="py-2 px-3">${item.qty}</td>
                    <td class="py-2 px-3 font-semibold">${item.physical_amount || '—'}</td>
                    <td class="py-2 px-3 text-gray-600">${item.remarks || '—'}</td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        }

        html += `</div>`;
        content.innerHTML = html;
        modal.classList.remove('hidden');
    };

    window.exportSingleAudit = function(idx, type) {
        const audit = globalAuditData[idx];
        if (!audit) return;
        exportToCSV([audit], type);
    };

    // ─────────────────────────────────────────────────────────────────────
    //  ANALYTICS & CHARTS
    // ─────────────────────────────────────────────────────────────────────
    let analyticsCharts = {};

    function initAnalytics() {
        // Set default date range (last 30 days)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        document.getElementById('analytics-end-date').valueAsDate = endDate;
        document.getElementById('analytics-start-date').valueAsDate = startDate;

        document.getElementById('analytics-refresh').addEventListener('click', loadAnalytics);
        
        // Initialize charts
        initCharts();
        loadAnalytics();
    }

    function initCharts() {
        // Audits Timeline Chart
        analyticsCharts.timeline = new Chart(document.getElementById('chart-audits-timeline'), {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Audits', data: [], borderColor: '#6366f1', backgroundColor: 'rgba(99, 102, 241, 0.1)', tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
        });

        // User Completion Chart
        analyticsCharts.userCompletion = new Chart(document.getElementById('chart-user-completion'), {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Completed', data: [], backgroundColor: '#10b981' }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
        });

        // Warehouse Distribution Chart
        analyticsCharts.warehouseDist = new Chart(document.getElementById('chart-warehouse-dist'), {
            type: 'pie',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'] }] },
            options: { responsive: true, maintainAspectRatio: true }
        });

        // Section Breakdown Chart
        analyticsCharts.sectionBreakdown = new Chart(document.getElementById('chart-section-breakdown'), {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#10b981', '#f59e0b', '#ef4444'] }] },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }

    function loadAnalytics() {
        const startDate = document.getElementById('analytics-start-date').value;
        const endDate = document.getElementById('analytics-end-date').value;

        fetch(`/api/admin/analytics?start_date=${startDate}&end_date=${endDate}`, { 
            headers: { 'Authorization': bearerToken } 
        })
        .then(r => r.json())
        .then(res => {
            if (!res.success) return;
            const data = res.data;

            // Update summary cards
            document.getElementById('analytics-total-audits').textContent = data.total_audits;
            document.getElementById('analytics-completion-rate').textContent = data.completion_rate + '%';
            document.getElementById('analytics-avg-sections').textContent = data.avg_sections.toFixed(1);
            document.getElementById('analytics-total-items').textContent = data.total_stock_items;

            // Update Timeline Chart
            analyticsCharts.timeline.data.labels = data.audits_by_date.map(d => d.date);
            analyticsCharts.timeline.data.datasets[0].data = data.audits_by_date.map(d => d.count);
            analyticsCharts.timeline.update();

            // Update User Completion Chart
            analyticsCharts.userCompletion.data.labels = data.completion_by_user.map(u => u.user.split('@')[0]);
            analyticsCharts.userCompletion.data.datasets[0].data = data.completion_by_user.map(u => u.completed);
            analyticsCharts.userCompletion.update();

            // Update Warehouse Distribution Chart
            analyticsCharts.warehouseDist.data.labels = data.warehouse_distribution.map(w => w.warehouse);
            analyticsCharts.warehouseDist.data.datasets[0].data = data.warehouse_distribution.map(w => w.count);
            analyticsCharts.warehouseDist.update();

            // Update Section Breakdown Chart
            analyticsCharts.sectionBreakdown.data.labels = ['Completed', 'In Progress', 'Pending'];
            analyticsCharts.sectionBreakdown.data.datasets[0].data = [
                data.section_breakdown.completed,
                data.section_breakdown.in_progress,
                data.section_breakdown.pending
            ];
            analyticsCharts.sectionBreakdown.update();
        })
        .catch(err => console.error('Analytics error:', err));
    }

    // --- UPLOAD WIZARD LOGIC ---
    let parsedWorkbook = null;
    let selectedSheetsData = [];
    const step1Next = document.getElementById('step1-next');
    const uploadInput = document.getElementById('upload-file');

    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        document.getElementById('file-selected-info').classList.remove('hidden');
        document.getElementById('file-selected-name').textContent = file.name;
        step1Next.disabled = false;
        
        const reader = new FileReader();
        reader.onload = function(e){
            const data = new Uint8Array(e.target.result);
            parsedWorkbook = XLSX.read(data, {type: 'array'});
        };
        reader.readAsArrayBuffer(file);
    });

    document.getElementById('file-clear').addEventListener('click', () => {
        uploadInput.value = '';
        parsedWorkbook = null;
        document.getElementById('file-selected-info').classList.add('hidden');
        step1Next.disabled = true;
    });

    function setWizStep(s) {
        document.querySelectorAll('.upload-step').forEach(c => c.classList.remove('active'));
        document.getElementById('wizard-step-'+s).classList.add('active');
        document.querySelectorAll('.step-indicator .step').forEach(el => {
            let n = parseInt(el.dataset.step);
            el.classList.remove('active');
            if(n === s) el.classList.add('active');
        });
        document.getElementById('wizard-progress').style.width = (s*33) + "%";
    }

    step1Next.addEventListener('click', () => {
        if(!parsedWorkbook) return;
        setWizStep(2);
        const slist = document.getElementById('sheet-list');
        slist.innerHTML = '';
        parsedWorkbook.SheetNames.forEach(name => {
            const ws = parsedWorkbook.Sheets[name];
            let html = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
            // Detect header (find row with 'qty' or non empty)
            let headerIdx = -1;
            for(let r=0; r<Math.min(html.length, 30); r++) {
                if(html[r].some(cell => String(cell).toLowerCase().includes('qty'))) {
                    headerIdx = r; break;
                }
            }
            if(headerIdx===-1) headerIdx = 0; // fallback
            
            slist.innerHTML += `<label class="sheet-checkbox-label">
                <input type="checkbox" value="${name}" data-idx="${headerIdx}">
                <span>${name} <small class="text-gray-400">(${html.length} rows, HDR row ${headerIdx+1})</small></span>
            </label>`;
        });
        document.querySelectorAll('.sheet-checkbox-label input').forEach(c => c.addEventListener('change', () => {
            document.getElementById('step2-next').disabled = document.querySelectorAll('.sheet-checkbox-label input:checked').length === 0;
        }));
    });

    document.getElementById('step2-back').addEventListener('click', () => setWizStep(1));
    
    document.getElementById('step2-next').addEventListener('click', () => {
        setWizStep(3);
        const checks = document.querySelectorAll('.sheet-checkbox-label input:checked');
        selectedSheetsData = [];
        const clist = document.getElementById('column-map-list');
        clist.innerHTML = '';
        
        checks.forEach(chk => {
            const name = chk.value;
            const hdrIdx = parseInt(chk.dataset.idx);
            let rawData = XLSX.utils.sheet_to_json(parsedWorkbook.Sheets[name], {header:1, defval:""});
            let cols = rawData[hdrIdx] || [];
            selectedSheetsData.push({name, hdrIdx, cols, rows: rawData.slice(hdrIdx+1)});
            
            let opts = `<option value="">-- Ignore --</option>` + cols.map((c,i) => `<option value="${i}">${c || 'Col '+(i+1)}</option>`).join('');
            
            // Auto-detect indices
            let defCode="", defName="", defQty="";
            cols.forEach((c,i) => {
                let sl = String(c).toLowerCase();
                if(sl.includes('code')) defCode=i;
                else if(sl.includes('name')) defName=i;
                else if(sl.includes('qty') || sl.includes('quantity')) defQty=i;
            });

            clist.innerHTML += `
            <div class="col-map-card" data-sheet="${name}">
                <h4>${name}</h4>
                <div class="grid grid-cols-2 gap-3 mt-2 text-sm">
                    <div>
                        <label class="block text-gray-600 mb-1 font-semibold">Item Code *</label>
                        <select class="map-code w-full border rounded p-1" required>${opts.replace(`value="${defCode}"`, `value="${defCode}" selected`)}</select>
                    </div>
                    <div>
                        <label class="block text-gray-600 mb-1 font-semibold">Item Name *</label>
                        <select class="map-name w-full border rounded p-1" required>${opts.replace(`value="${defName}"`, `value="${defName}" selected`)}</select>
                    </div>
                    <div>
                        <label class="block text-gray-600 mb-1 font-semibold">Quantity *</label>
                        <select class="map-qty w-full border rounded p-1" required>${opts.replace(`value="${defQty}"`, `value="${defQty}" selected`)}</select>
                    </div>
                    <div>
                        <label class="block text-gray-600 mb-1 font-semibold text-purple-600">Optional 4th Col</label>
                        <select class="map-extra w-full border rounded p-1 border-purple-200">${opts}</select>
                    </div>
                </div>
            </div>`;
        });
    });

    document.getElementById('step3-back').addEventListener('click', () => setWizStep(2));
    
    document.getElementById('step3-upload').addEventListener('click', async () => {
        let payload = { sheets: [] };
        let isValid = true;

        document.querySelectorAll('.col-map-card').forEach(card => {
            const sName = card.dataset.sheet;
            const idxCode = card.querySelector('.map-code').value;
            const idxName = card.querySelector('.map-name').value;
            const idxQty = card.querySelector('.map-qty').value;
            const idxExt = card.querySelector('.map-extra').value;

            if(!idxCode || !idxName || !idxQty) {
                alert(`Please map Code, Name and Quantity for sheet: ${sName}`);
                isValid = false; return;
            }

            let sheetData = selectedSheetsData.find(s => s.name === sName);
            let items = [];
            sheetData.rows.forEach(r => {
                items.push({
                    item_code: String(r[idxCode]||'').trim(),
                    item_name: String(r[idxName]||'').trim(),
                    qty: String(r[idxQty]||'').trim(),
                    extra_col: idxExt !== "" ? String(r[idxExt]||'').trim() : ""
                });
            });
            payload.sheets.push({ sheet_name: sName, items });
        });

        if(!isValid) return;

        const prgWrap = document.getElementById('upload-progress-wrap');
        const prgBar = document.getElementById('upload-progress-bar');
        const btnUpload = document.getElementById('step3-upload');
        prgWrap.classList.add('show');
        prgBar.style.width = '50%';
        btnUpload.disabled = true;

        fetch('/api/upload-items-json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': bearerToken },
            body: JSON.stringify(payload)
        }).then(r => r.json()).then(res => {
            prgBar.style.width = '100%';
            if(res.success) {
                alert(`Upload Successful! ${res.data.total_count} items uploaded.`);
                loadHistory(); // reload
                setWizStep(1); 
                document.getElementById('file-clear').click(); // reset step 1
                prgWrap.classList.remove('show');
            } else {
                alert("Upload failed: " + res.message);
            }
            btnUpload.disabled = false;
        }).catch(err => {
            alert("Error: "+err);
            btnUpload.disabled = false;
        });
    });

});
