// Global variables for dashboard
let dashboardRows = [];
let checklistCurrentPage = 1;
let stockcountCurrentPage = 1;

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

        function loadSectionData(target) {
            if (target === 'upload-data') {
                loadHistory();
                loadWarehouseMaster();
            } else if (target === 'dashboard') {
                loadAuditDashboard();
            } else if (target === 'warehouse') {
                loadWarehouseMaster();
            } else if (target === 'warehouse-status') {
                loadWarehouseStatus(1);
            } else if (target === 'employees') {
                loadEmployees(1);
            } else if (target === 'data') {
                loadChecklistsData(1);
            } else if (target === 'reconciliation') {
                // Don't auto-load reconciliation - user clicks "Load Report"
            }
        }

        // Init Views with LAZY LOADING - load data when section is clicked
        const sections = document.querySelectorAll('.view-section');
        document.querySelectorAll('.sidebar-item').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                sections.forEach(s => s.classList.add('hidden'));
                document.getElementById(btn.dataset.target + '-view').classList.remove('hidden');

                // LAZY LOAD: Only load data for the section being viewed
                const target = btn.dataset.target;
                loadSectionData(target);

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

        // EMERGENCY PERFORMANCE FIX: Only load essential data on page open
        // Other data loads when user clicks on specific sections

        // Essential setup only
        initDataSearch();
        initDetailModal();
        initReconciliation();
        initTaskAssignment();
        initAnalytics();

        // Inside initAdmin(), after other setups:
        document.getElementById('dash-refresh').addEventListener('click', loadAuditDashboard);

        const activeSection = document.querySelector('.sidebar-item.active')?.dataset.target;
        if (activeSection) {
            loadSectionData(activeSection);
        }

        // Show message that admin panel is ready
        console.log('Admin panel initialized - click sections to load data');
    }

    // ─────────────────────────────────────────────────────────────────────
    //  GENERIC PAGINATION SYSTEM
    // ─────────────────────────────────────────────────────────────────────
    function createPagination(data, currentPage = 1, itemsPerPage = 10) {
        const totalItems = data.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedData = data.slice(startIndex, endIndex);

        return {
            data: paginatedData,
            pagination: {
                currentPage,
                totalPages,
                totalItems,
                itemsPerPage,
                hasNext: currentPage < totalPages,
                hasPrev: currentPage > 1,
                showPagination: totalItems > itemsPerPage
            }
        };
    }

    function renderPaginationControls(containerId, pagination, onPageChange) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!pagination.showPagination) {
            container.innerHTML = '';
            return;
        }

        const { currentPage, totalPages, totalItems, itemsPerPage } = pagination;
        const startItem = ((currentPage - 1) * itemsPerPage) + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);

        container.innerHTML = `
            <div class="flex items-center justify-between mt-4 p-3 bg-gray-50 rounded-lg">
                <div class="text-sm text-gray-600">
                    Showing ${startItem} to ${endItem} of ${totalItems} items
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="${onPageChange}(${currentPage - 1})" 
                            ${!pagination.hasPrev ? 'disabled' : ''} 
                            class="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                        <i class="fas fa-chevron-left"></i> Previous
                    </button>
                    <span class="text-sm text-gray-600 px-2">Page ${currentPage} of ${totalPages}</span>
                    <button onclick="${onPageChange}(${currentPage + 1})" 
                            ${!pagination.hasNext ? 'disabled' : ''} 
                            class="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
                        Next <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // ─────────────────────────────────────────────────────────────────────
    //  AUDIT COMPLETION DASHBOARD (with client-side pagination)
    // ─────────────────────────────────────────────────────────────────────
    let dashboardRows = [];
    let dashboardTotalStockCountItems = 0;
    let dashboardCurrentPage = 1;

    function loadAuditDashboard() {
        fetch('/api/admin/audit-dashboard', {
            headers: { 'Authorization': bearerToken }
        })
            .then(r => r.json())
            .then(res => {
                if (res.success) {
                    dashboardRows = res.data.rows || [];
                    dashboardTotalStockCountItems = res.data.total_stock_count_items || 0;
                    checklistCurrentPage = 1;
                    stockcountCurrentPage = 1;
                    renderDashboard();
                } else {
                    console.error('Dashboard data error:', res.message);
                    showDashboardError();
                }
            })
            .catch(err => {
                console.error('Failed to load dashboard:', err);
                showDashboardError();
            });
    }

    window.changeDashboardPage = function (page) {
        dashboardCurrentPage = page;
        renderDashboard();
    };

    window.changeChecklistPage = function (page) {
        checklistCurrentPage = page;
        renderDashboard();
    };

    window.changeStockcountPage = function (page) {
        stockcountCurrentPage = page;
        renderDashboard();
    };

    function showDashboardError() {
        const clBody = document.getElementById('dash-checklist-body');
        if (clBody) clBody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-red-500">Failed to load data. Please refresh.</td></tr>`;
    }

    function renderDashboard() {
        const dateFilter = document.getElementById('dash-filter-date')?.value || '';
        const userFilter = document.getElementById('dash-filter-user')?.value.toLowerCase().trim() || '';
        const statusFilter = document.getElementById('dash-filter-status')?.value || '';

        // Filter data
        const filtered = dashboardRows.filter(r => {
            if (dateFilter && r.date !== dateFilter) return false;
            if (userFilter && !(r.user_name || r.user_id || '').toLowerCase().includes(userFilter)) return false;
            if (statusFilter && r.status !== statusFilter) return false;
            return true;
        });

        const checklistRows = filtered.filter(hasChecklistRecord);
        const stockCountRows = filtered.filter(hasStockCountRecord);

        // KPI Cards
        const checklistTotal = checklistRows.length;
        const checklistSubmitted = checklistRows.filter(r => r.checklist_status === 'Submitted').length;
        const checklistInProgress = checklistRows.filter(r => r.checklist_status === 'In Progress').length;
        const checklistCompletedSum = checklistRows.reduce((sum, r) => sum + (r.checklist_completed || 0), 0);
        const checklistTotalSteps = checklistRows.reduce((sum, r) => sum + (r.checklist_total || 0), 0);
        const checklistPct = checklistTotalSteps ? Math.round((checklistCompletedSum / checklistTotalSteps) * 100) : 0;

        document.getElementById('dash-cl-total').textContent = checklistTotal;
        document.getElementById('dash-cl-submitted').textContent = checklistSubmitted;
        document.getElementById('dash-cl-inprogress').textContent = checklistInProgress;
        document.getElementById('dash-cl-pct').textContent = checklistPct + '%';

        // Stock Count KPIs
        document.getElementById('dash-sc-total').textContent = stockCountRows.length;
        document.getElementById('dash-sc-submitted').textContent = stockCountRows
            .filter(r => r.stock_count_status === 'Submitted')
            .reduce((sum, r) => sum + Number(r.stock_count_items || 0), 0);
        document.getElementById('dash-sc-inprogress').textContent = stockCountRows.filter(r => r.stock_count_status === 'In Progress').length;
        document.getElementById('dash-sc-items').textContent = dashboardTotalStockCountItems;

        // Render Checklist Tab
        renderChecklistTab(checklistRows);

        // Render Stock Count Tab
        renderStockcountTab(stockCountRows);
    }

    function hasStockCountRecord(row) {
        return row?.stock_count_status === 'Submitted'
            || row?.stock_count_status === 'In Progress'
            || Number(row?.stock_count_items || 0) > 0;
    }

    function hasChecklistRecord(row) {
        return row?.checklist_status === 'Submitted'
            || row?.checklist_status === 'In Progress'
            || Number(row?.checklist_completed || 0) > 0;
    }

    function renderChecklistTab(filtered) {
        const pageSize = 10;
        const totalPages = Math.ceil(filtered.length / pageSize);
        const page = Math.min(checklistCurrentPage, totalPages || 1);
        const start = (page - 1) * pageSize;
        const pageData = filtered.slice(start, start + pageSize);

        const tbody = document.getElementById('dash-checklist-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (pageData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-gray-400">No records found.</td></tr>`;
        } else {
            pageData.forEach(r => {
                const pct = r.checklist_pct || 0;
                const barColor = pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-400';

                let badge = '';
                if (r.checklist_status === 'Submitted') {
                    badge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Submitted</span>';
                } else if (r.checklist_status === 'In Progress') {
                    badge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">In Progress</span>';
                } else {
                    badge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Pending</span>';
                }

                tbody.innerHTML += `
                    <tr class="hover:bg-gray-50">
                        <td class="py-3 px-4">${r.date || '—'}</td>
                        <td class="py-3 px-4 text-xs">${r.user_name || r.user_id || '—'}</td>
                        <td class="py-3 px-4">${r.warehouse_name || '—'}</td>
                        <td class="py-3 px-4">
                            <div class="flex items-center gap-2">
                                <div class="flex-1 bg-gray-200 rounded-full h-2">
                                    <div class="${barColor} h-2 rounded-full" style="width: ${pct}%"></div>
                                </div>
                                <span class="text-xs font-medium text-gray-600">${r.checklist_completed || 0}/${r.checklist_total || 0}</span>
                            </div>
                        </td>
                        <td class="py-3 px-4">${badge}</td>
                        <td class="py-3 px-4 text-xs text-gray-500">${r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}</td>
                        <td class="py-3 px-4">
                            <button onclick="viewDashboardAudit('${r.user_id}', '${r.date}', 'checklist')" 
                                class="text-indigo-600 hover:underline text-sm">View</button>
                        </td>
                    </tr>`;
            });
        }

        renderPagination('checklist-pagination', page, totalPages, 'changeChecklistPage');
    }

    function renderStockcountTab(filtered) {
        const pageSize = 10;
        const totalPages = Math.ceil(filtered.length / pageSize);
        const page = Math.min(stockcountCurrentPage, totalPages || 1);
        const start = (page - 1) * pageSize;
        const pageData = filtered.slice(start, start + pageSize);

        const tbody = document.getElementById('dash-stockcount-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (pageData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-gray-400">No records found.</td></tr>`;
        } else {
            pageData.forEach(r => {
                const scBadge = r.stock_count_status === 'Submitted'
                    ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Submitted</span>'
                    : r.stock_count_status === 'In Progress'
                        ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">In Progress</span>'
                        : '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Pending</span>';

                tbody.innerHTML += `
                    <tr class="hover:bg-gray-50">
                        <td class="py-3 px-4">${r.date || '—'}</td>
                        <td class="py-3 px-4 text-xs">${r.user_name || r.user_id || '—'}</td>
                        <td class="py-3 px-4 text-center font-semibold text-indigo-600">${r.stock_count_items || 0}</td>
                        <td class="py-3 px-4">${scBadge}</td>
                        <td class="py-3 px-4">
                            <button onclick="viewDashboardAudit('${r.user_id}', '${r.date}', 'stockcount')" 
                                class="text-indigo-600 hover:underline text-sm">View</button>
                        </td>
                    </tr>`;
            });
        }

        renderPagination('stockcount-pagination', page, totalPages, 'changeStockcountPage');
    }

    function renderPagination(containerId, currentPage, totalPages, changeFn) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (totalPages <= 1) {
            container.classList.add('hidden');
            return;
        }

        container.classList.remove('hidden');
        // Simple pagination HTML (you can enhance this)
        container.innerHTML = `
            <div class="flex justify-between items-center mt-4 text-sm">
                <button onclick="${changeFn}(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''} 
                    class="px-4 py-2 border rounded hover:bg-gray-100">Previous</button>
                <span>Page ${currentPage} of ${totalPages}</span>
                <button onclick="${changeFn}(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''} 
                    class="px-4 py-2 border rounded hover:bg-gray-100">Next</button>
            </div>
        `;
    }

    // Page change handlers
    window.changeChecklistPage = function (page) {
        if (page < 1) return;
        checklistCurrentPage = page;
        renderDashboard();
    };

    window.changeStockcountPage = function (page) {
        if (page < 1) return;
        stockcountCurrentPage = page;
        renderDashboard();
    };

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

    // Dashboard action functions
    window.viewDashboardAudit = function (userId, date, type) {
        // Find the audit record - need to get full data
        fetch(`/api/admin/audit-detail/${encodeURIComponent(userId)}/${date}`, {
            headers: { 'Authorization': bearerToken }
        })
            .then(r => r.json())
            .then(res => {
                if (!res.success) {
                    alert('Failed to load audit details: ' + (res.message || 'Unknown error'));
                    return;
                }

                const audit = res.data;
                showDetailedAuditModal(audit, type);
            })
            .catch(err => {
                console.error('View audit error:', err);
                alert('Failed to load audit details');
            });
    };

    // function showDetailedAuditModal(audit, type) {
    //     const modal = document.getElementById('detail-modal');
    //     const content = document.getElementById('detail-modal-content');

    //     let html = `<div class="space-y-4">`;
    //     html += `<div class="grid grid-cols-2 gap-4 text-sm">
    //         <div><span class="font-semibold text-gray-600">User:</span> ${audit.user_name || audit.user_id}</div>
    //         <div><span class="font-semibold text-gray-600">Date:</span> ${audit.date}</div>
    //         <div><span class="font-semibold text-gray-600">Warehouse:</span> ${audit.warehouse_name || audit.sections?.general_report?.warehouse_name || 'Unknown'}</div>
    //         <div><span class="font-semibold text-gray-600">Submitted:</span> ${audit.submitted_at ? new Date(audit.submitted_at).toLocaleString() : 'In Progress'}</div>
    //     </div>`;

    //     if (type === 'checklist') {
    //         html += `<h4 class="font-bold text-lg mt-4 mb-2 text-indigo-600">Checklist Sections</h4>`;

    //         const sections = audit.sections || {};
    //         const completionStatus = audit.completion_status || {};

    //         // Show section completion status
    //         html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">`;
    //         const sectionNames = {
    //             'general_report': 'General Report',
    //             'stock_reconciliation': 'Stock Reconciliation',
    //             'observations_on_stacking': 'Stacking Observations',
    //             'observations_on_warehouse_operations': 'Warehouse Operations',
    //             'observations_on_warehouse_record_keeping': 'Record Keeping',
    //             'observations_on_wh_infrastructure': 'Infrastructure',
    //             'observations_on_quality_operation': 'Quality Operations',
    //             'checklist_wrt_exchange_circular_mentha_oil': 'Mentha Oil Checklist',
    //             'checklist_wrt_exchange_circular_metal': 'Metal Checklist',
    //             'checklist_wrt_exchange_circular_cotton_bales': 'Cotton Bales Checklist',
    //             'signature': 'Signature',
    //             'photo': 'Photos'
    //         };

    //         Object.entries(sectionNames).forEach(([key, name]) => {
    //             const isComplete = completionStatus[key] || false;
    //             const statusIcon = isComplete ? '<i class="fas fa-check-circle text-green-600"></i>' : '<i class="fas fa-times-circle text-red-500"></i>';
    //             const statusText = isComplete ? 'Complete' : 'Pending';
    //             const statusColor = isComplete ? 'text-green-700' : 'text-red-600';

    //             html += `<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
    //                 <span class="font-medium text-gray-700">${name}</span>
    //                 <span class="${statusColor} text-sm font-semibold">${statusIcon} ${statusText}</span>
    //             </div>`;
    //         });
    //         html += `</div>`;

    //         // Show general report details if available
    //         if (sections.general_report) {
    //             const gr = sections.general_report;
    //             html += `<div class="bg-blue-50 p-4 rounded-lg">
    //                 <h5 class="font-semibold text-blue-800 mb-2">General Report Details</h5>
    //                 <div class="grid grid-cols-2 gap-2 text-sm">
    //                     <div><strong>Warehouse:</strong> ${gr.warehouse_name || 'Not specified'}</div>
    //                     <div><strong>Address:</strong> ${gr.warehouse_address || 'Not specified'}</div>
    //                     <div><strong>Audit Type:</strong> ${gr.audit_type || 'Not specified'}</div>
    //                     <div><strong>Auditor:</strong> ${gr.auditor_name || 'Not specified'}</div>
    //                 </div>
    //             </div>`;
    //         }

    //     } else if (type === 'stockcount') {
    //         html += `<h4 class="font-bold text-lg mt-4 mb-2 text-indigo-600">Stock Count Details</h4>`;

    //         const stockCountData = audit.stock_count_data || [];

    //         if (stockCountData.length > 0) {
    //             html += `<div class="bg-gray-50 p-4 rounded-lg mb-4">
    //                 <div class="grid grid-cols-3 gap-4 text-center">
    //                     <div>
    //                         <div class="text-2xl font-bold text-indigo-600">${stockCountData.length}</div>
    //                         <div class="text-sm text-gray-600">Total Items</div>
    //                     </div>
    //                     <div>
    //                         <div class="text-2xl font-bold text-green-600">${stockCountData.filter(item => item.physical_amount && parseInt(item.physical_amount) > 0).length}</div>
    //                         <div class="text-sm text-gray-600">Items Counted</div>
    //                     </div>
    //                     <div>
    //                         <div class="text-2xl font-bold text-blue-600">${[...new Set(stockCountData.map(item => item.sheet_name))].length}</div>
    //                         <div class="text-sm text-gray-600">Sheets</div>
    //                     </div>
    //                 </div>
    //             </div>`;

    //             // Show sample items
    //             html += `<div class="overflow-x-auto">
    //                 <table class="min-w-full text-xs border border-gray-200">
    //                     <thead class="bg-gray-100">
    //                         <tr>
    //                             <th class="py-2 px-3 text-left border-b">Item Code</th>
    //                             <th class="py-2 px-3 text-left border-b">Item Name</th>
    //                             <th class="py-2 px-3 text-left border-b">Expected</th>
    //                             <th class="py-2 px-3 text-left border-b">Physical</th>
    //                             <th class="py-2 px-3 text-left border-b">Sheet</th>
    //                         </tr>
    //                     </thead>
    //                     <tbody>`;

    //             stockCountData.slice(0, 10).forEach(item => {
    //                 html += `<tr class="border-b hover:bg-gray-50">
    //                     <td class="py-2 px-3 font-mono">${item.item_code || '—'}</td>
    //                     <td class="py-2 px-3">${item.item_name || '—'}</td>
    //                     <td class="py-2 px-3 text-center">${item.qty || '—'}</td>
    //                     <td class="py-2 px-3 text-center font-semibold">${item.physical_amount || '—'}</td>
    //                     <td class="py-2 px-3 text-xs text-gray-600">${item.sheet_name || '—'}</td>
    //                 </tr>`;
    //             });

    //             if (stockCountData.length > 10) {
    //                 html += `<tr><td colspan="5" class="py-2 px-3 text-center text-gray-500">... and ${stockCountData.length - 10} more items</td></tr>`;
    //             }

    //             html += `</tbody></table></div>`;
    //         } else {
    //             html += `<div class="text-center py-8 text-gray-500">No stock count data available</div>`;
    //         }
    //     }

    //     html += `<div class="mt-6 flex gap-3">
    //         <button onclick="exportDashboardAudit('${audit.user_id}', '${audit.date}', '${type}')" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-semibold">
    //             <i class="fas fa-download mr-2"></i>Download ${type === 'checklist' ? 'Checklist' : 'Stock Count'} Report
    //         </button>
    //     </div>`;

    //     html += `</div>`;
    //     content.innerHTML = html;
    //     modal.classList.remove('hidden');
    // }
    function showDetailedAuditModal(audit, type) {
        let modal = document.getElementById('detail-modal');
        if (!modal) {
            createDetailModal();
            modal = document.getElementById('detail-modal');
        }

        const content = document.getElementById('detail-modal-content');
        wireDetailModalScroll(modal, content);

        let html = `
        <div class="space-y-6">
            <!-- Header Info -->
            <div class="flex justify-between items-start pb-4 border-b">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">${audit.user_name || audit.user_id || 'Unknown User'}</h2>
                    <p class="text-gray-500">${audit.date || '—'} • ${audit.warehouse_name || '—'}</p>
                </div>
                <div class="flex items-center gap-3">
                    <button onclick="exportDashboardAudit('${audit.user_id}', '${audit.date}', '${type}')" 
                            class="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
                        <i class="fas fa-download"></i> Download Excel
                    </button>
                    <button onclick="closeDetailModal()" 
                            class="text-3xl leading-none text-gray-400 hover:text-gray-600">×</button>
                </div>
            </div>
    `;

        if (type === 'checklist') {
            html += `<h3 class="font-semibold text-xl mt-6 mb-4 text-indigo-700">Checklist Audit Details</h3>`;

            const sections = audit.sections || {};
            const status = audit.completion_status || {};

            const sectionList = [
                { key: "general_report", label: "General Report" },
                { key: "stock_reconciliation", label: "Stock Reconciliation" },
                { key: "observations_on_stacking", label: "Observations on Stacking" },
                { key: "observations_on_warehouse_operations", label: "Warehouse Operations" },
                { key: "observations_on_warehouse_record_keeping", label: "Record Keeping" },
                { key: "observations_on_wh_infrastructure", label: "Infrastructure" },
                { key: "observations_on_quality_operation", label: "Quality Operation" },
                { key: "checklist_wrt_exchange_circular_mentha_oil", label: "Mentha Oil" },
                { key: "checklist_wrt_exchange_circular_metal", label: "Metals" },
                { key: "checklist_wrt_exchange_circular_cotton_bales", label: "Cotton Bales" },
                { key: "signature", label: "Signature" },
                { key: "photo", label: "Photos" }
            ];

            sectionList.forEach(({ key, label }) => {
                const data = sections[key];
                const completed = status[key] === true || !!data;

                html += `
            <div class="mb-6 border rounded-2xl overflow-hidden">
                <div class="bg-gray-50 px-6 py-4 flex justify-between items-center border-b">
                    <h4 class="font-semibold text-lg">${label}</h4>
                    <span class="text-2xl">${completed ? '✅' : '○'}</span>
                </div>`;

                if (data) {
                    html += `<div class="p-6 bg-white">`;

                    if (key === 'signature') {
                        html += renderSignatureData(data);
                    }
                    else if (key === 'photo') {
                        html += renderPhotoData(data);
                    }
                    else if (key === 'general_report') {
                        html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">`;
                        Object.entries(data).forEach(([k, v]) => {
                            html += `<div><strong>${k.replace(/_/g, ' ')}:</strong> ${v || '—'}</div>`;
                        });
                        html += `</div>`;
                    }
                    else if (data.questions && Array.isArray(data.questions)) {
                        html += `<div class="space-y-4">`;
                        data.questions.forEach(q => {
                            html += `
                        <div class="border-l-4 border-indigo-500 pl-4 py-3 bg-gray-50 rounded-r-xl">
                            <div class="font-medium">${q.question}</div>
                            <div class="flex gap-6 mt-2 text-sm">
                                <div><strong>Answer:</strong> ${q.answer || '—'}</div>
                                <div><strong>Remarks:</strong> ${q.remarks || '—'}</div>
                            </div>
                        </div>`;
                        });
                        html += `</div>`;
                    }
                    else {
                        html += `<div class="grid grid-cols-1 gap-3 text-sm">`;
                        Object.entries(data).forEach(([k, v]) => {
                            html += `<div><strong>${k.replace(/_/g, ' ')}:</strong> ${typeof v === 'object' ? JSON.stringify(v) : v || '—'}</div>`;
                        });
                        html += `</div>`;
                    }
                    html += `</div>`;
                } else {
                    html += `<div class="p-8 text-center text-gray-400 italic">No data filled in this section</div>`;
                }
                html += `</div>`;
            });

        } else if (type === 'stockcount') {
            const items = audit.stock_count_data || [];
            html += `<h3 class="font-semibold text-xl mt-6 mb-4">Stock Count Details (${items.length} items)</h3>`;

            if (items.length === 0) {
                html += `<p class="text-gray-500 py-12 text-center">No stock count data available</p>`;
            } else {
                html += `<div class="overflow-x-auto border rounded-2xl">`;
                html += `<table class="min-w-full text-sm">`;
                html += `<thead class="bg-gray-100"><tr>
                <th class="px-4 py-3 text-left">Item Code</th>
                <th class="px-4 py-3 text-left">Item Name</th>
                <th class="px-4 py-3 text-center">Expected</th>
                <th class="px-4 py-3 text-center">Physical</th>
                <th class="px-4 py-3 text-left">Remarks</th>
            </tr></thead><tbody class="divide-y">`;

                items.forEach(item => {
                    html += `<tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 font-mono">${item.item_code || '—'}</td>
                    <td class="px-4 py-3">${item.item_name || '—'}</td>
                    <td class="px-4 py-3 text-center">${item.qty || '—'}</td>
                    <td class="px-4 py-3 text-center font-semibold">${item.physical_amount || '—'}</td>
                    <td class="px-4 py-3 text-gray-600">${item.remarks || '—'}</td>
                </tr>`;
                });

                html += `</tbody></table></div>`;
            }
        }

        html += `</div>`;
        modal.classList.remove('hidden');
        content.innerHTML = html;
        requestAnimationFrame(() => {
            content.scrollTop = 0;
        });
    }

    function createDetailModal() {
        const existing = document.getElementById('detail-modal');
        if (existing) return;

        const modalHTML = `
            <div id="detail-modal" class="hidden fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4 overflow-hidden">
                <div class="detail-modal-panel bg-white rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden">
                    <!-- Header -->
                    <div class="flex items-center justify-between p-6 border-b flex-shrink-0">
                        <h3 class="text-xl font-bold text-gray-800" id="modal-title">
                            <i class="fas fa-info-circle text-indigo-600 mr-2"></i>Audit Details
                        </h3>
                        <button onclick="closeDetailModal()" class="text-3xl leading-none text-gray-400 hover:text-gray-600">×</button>
                    </div>
                    <!-- Scrollable Content -->
                    <div id="detail-modal-content" class="p-6">
                        <!-- JS will populate here -->
                    </div>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    function wireDetailModalScroll(modal, content) {
        if (!modal || !content || modal.dataset.scrollWired === 'true') return;

        modal.addEventListener('wheel', (event) => {
            if (modal.classList.contains('hidden')) return;
            content.scrollTop += event.deltaY;
            event.preventDefault();
        }, { passive: false });

        modal.dataset.scrollWired = 'true';
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function isImageDataUrl(value) {
        return typeof value === 'string' && value.startsWith('data:image/');
    }

    function renderSignatureData(data) {
        const signature = typeof data === 'string' ? data : data?.signature;

        if (!isImageDataUrl(signature)) {
            return `<div class="text-gray-500 italic">No signature image available</div>`;
        }

        return `
            <div class="border rounded-xl bg-gray-50 p-4 inline-block max-w-full">
                <img src="${signature}" alt="Audit signature" class="max-h-48 max-w-full object-contain bg-white border rounded-lg p-2">
            </div>`;
    }

    function normalizePhotoItems(data) {
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.photos)) return data.photos;
        if (Array.isArray(data?.photo)) return data.photo;
        if (typeof data?.photos === 'string') {
            try {
                const parsedPhotos = JSON.parse(data.photos);
                if (Array.isArray(parsedPhotos)) return parsedPhotos;
            } catch (error) {
                return [];
            }
        }
        if (isImageDataUrl(data?.photo)) return [data];
        if (isImageDataUrl(data)) return [{ photo: data }];
        return [];
    }

    function renderPhotoData(data) {
        const photos = normalizePhotoItems(data);

        if (!photos.length) {
            return `<div class="text-gray-500 italic">No photos available</div>`;
        }

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${photos.map((item, index) => {
                    const src = typeof item === 'string' ? item : item?.photo;
                    if (!isImageDataUrl(src)) return '';

                    const timestamp = item?.timestamp ? escapeHtml(item.timestamp) : '';
                    const location = item?.location_text ? escapeHtml(item.location_text) : '';

                    return `
                        <figure class="border rounded-xl overflow-hidden bg-white">
                            <img src="${src}" alt="Audit photo ${index + 1}" class="w-full max-h-80 object-contain bg-gray-50">
                            ${(timestamp || location) ? `
                                <figcaption class="p-3 text-xs text-gray-600 border-t space-y-1">
                                    ${timestamp ? `<div><strong>Time:</strong> ${timestamp}</div>` : ''}
                                    ${location ? `<div><strong>Location:</strong> ${location}</div>` : ''}
                                </figcaption>` : ''}
                        </figure>`;
                }).join('')}
            </div>`;
    }

    window.closeDetailModal = function () {
        const modal = document.getElementById('detail-modal');
        if (modal) modal.classList.add('hidden');
    };

    window.exportDashboardAudit = function (userId, date, type) {
        const audit = dashboardRows.find(r => r.user_id === userId && r.date === date);
        if (!audit) {
            alert('Audit record not found');
            return;
        }

        // Create download URL with proper authentication
        const downloadUrl = `/api/admin/export-audit/${encodeURIComponent(userId)}/${date}?type=${type}`;

        // Use fetch with authorization header for proper download
        fetch(downloadUrl, {
            headers: { 'Authorization': bearerToken },
            method: 'GET'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${type}_${userId}_${date}.xlsx`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            })
            .catch(err => {
                console.error('Export error:', err);
                alert(`Export failed: ${err.message}`);
            });
    };

    // Dashboard filters
    ['dash-filter-date', 'dash-filter-user', 'dash-filter-status'].forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('input', renderDashboard);
            element.addEventListener('change', renderDashboard);
        }
    });
    const dashRefreshBtn = document.getElementById('dash-refresh');
    if (dashRefreshBtn) {
        dashRefreshBtn.addEventListener('click', () => loadAuditDashboard());
    }

    // ─────────────────────────────────────────────────────────────────────
    //  WAREHOUSE MASTER (with pagination)
    // ─────────────────────────────────────────────────────────────────────
    let whParsedData = [];   // [{warehouse_name, warehouse_address}]
    let whWorkbook = null;
    let warehouseMasterPagination = { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 10 };

    function loadWarehouseMaster(page = 1) {
        fetch(`/api/admin/warehouse-master?page=${page}&limit=${warehouseMasterPagination.itemsPerPage}`, { headers: { 'Authorization': bearerToken } })
            .then(r => r.json()).then(res => {
                if (!res.success) return;
                const warehouses = res.data.warehouses || [];
                warehouseMasterPagination = {
                    currentPage: res.data.pagination?.current_page || 1,
                    totalPages: res.data.pagination?.total_pages || 1,
                    totalItems: res.data.pagination?.total_items || 0,
                    itemsPerPage: res.data.pagination?.items_per_page || 10
                };
                renderWarehouseTable(warehouses);
            }).catch(err => {
                console.error('Warehouse master error:', err);
                // Fallback for non-paginated API
                fetch('/api/admin/warehouse-master', { headers: { 'Authorization': bearerToken } })
                    .then(r => r.json()).then(res => {
                        if (res.success) {
                            const warehouses = res.data.warehouses || [];
                            renderWarehouseTable(warehouses.slice(0, 10)); // Show first 10 items
                        }
                    }).catch(() => { });
            });
    }

    function renderWarehouseTable(warehouses) {
        const tbody = document.getElementById('wh-table-body');
        const countEl = document.getElementById('wh-count');

        if (countEl) countEl.textContent = `${warehouses.length} warehouse(s) on this page`;

        if (!tbody) return;

        if (!warehouses.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="py-6 text-center text-gray-400">No warehouses uploaded yet.</td></tr>';
            renderWarehouseMasterPagination();
            return;
        }
        tbody.innerHTML = warehouses.map((w, i) => `
            <tr class="hover:bg-gray-50">
                <td class="py-2 px-4 text-gray-400">${((warehouseMasterPagination.currentPage - 1) * warehouseMasterPagination.itemsPerPage) + i + 1}</td>
                <td class="py-2 px-4 font-medium">${w.warehouse_name}</td>
                <td class="py-2 px-4 text-gray-600 text-xs">${w.warehouse_address || '—'}</td>
            </tr>`).join('');

        renderWarehouseMasterPagination();
    }

    function renderWarehouseMasterPagination() {
        const container = document.getElementById('warehouse-master-pagination');
        if (!container) return;

        const { currentPage, totalPages, totalItems, itemsPerPage } = warehouseMasterPagination;

        if (totalPages <= 1) {
            container.innerHTML = totalItems > 0 ?
                `<div class="text-sm text-gray-600 mt-4">Showing all ${totalItems} warehouses</div>` : '';
            return;
        }

        let html = `
            <div class="flex items-center justify-between mt-4">
                <div class="text-sm text-gray-600">
                    Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems} warehouses
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="loadWarehouseMaster(${currentPage - 1})" 
                            ${currentPage <= 1 ? 'disabled' : ''} 
                            class="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        <i class="fas fa-chevron-left"></i> Previous
                    </button>
                    <span class="text-sm text-gray-600">Page ${currentPage} of ${totalPages}</span>
                    <button onclick="loadWarehouseMaster(${currentPage + 1})" 
                            ${currentPage >= totalPages ? 'disabled' : ''} 
                            class="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        Next <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
        container.innerHTML = html;
    }
    window.loadWarehouseMaster = loadWarehouseMaster;

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
    //  WAREHOUSE AUDIT STATUS (with pagination)
    // ─────────────────────────────────────────────────────────────────────
    let warehouseStatusData = [];
    let warehouseStatusSummary = { total: 0, completed: 0, in_progress: 0, not_started: 0, overdue: 0 };
    let warehouseStatusPagination = { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 10 };

    function loadWarehouseStatus(page = 1) {
        const dateFilter = document.getElementById('wh-status-date') ? document.getElementById('wh-status-date').value : '';

        fetch(`/api/admin/warehouse-status?date=${dateFilter}&page=${page}&limit=${warehouseStatusPagination.itemsPerPage}`, { headers: { 'Authorization': bearerToken } })
            .then(r => r.json())
            .then(res => {
                if (!res.success) return;
                warehouseStatusData = res.data.warehouses || [];
                warehouseStatusSummary = res.data.summary || warehouseStatusSummary;
                warehouseStatusPagination = {
                    currentPage: res.data.pagination?.current_page || 1,
                    totalPages: res.data.pagination?.total_pages || 1,
                    totalItems: res.data.pagination?.total_items || 0,
                    itemsPerPage: res.data.pagination?.items_per_page || 15,
                    hasPrev: (res.data.pagination?.current_page || 1) > 1,
                    hasNext: (res.data.pagination?.current_page || 1) < (res.data.pagination?.total_pages || 1),
                    showPagination: (res.data.pagination?.total_pages || 1) > 1
                };
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
        document.getElementById('wh-status-total').textContent = warehouseStatusSummary.total || 0;
        document.getElementById('wh-status-completed').textContent = warehouseStatusSummary.completed || 0;
        document.getElementById('wh-status-inprogress').textContent = warehouseStatusSummary.in_progress || 0;
        document.getElementById('wh-status-notstarted').textContent = warehouseStatusSummary.not_started || 0;
        document.getElementById('wh-status-overdue').textContent = warehouseStatusSummary.overdue || 0;

        // Render table
        const tbody = document.getElementById('wh-status-table-body');
        tbody.innerHTML = '';

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="py-6 text-center text-gray-400">No warehouses found</td></tr>';
            renderPaginationControls('warehouse-status-pagination', warehouseStatusPagination, 'loadWarehouseStatus');
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
            const assignedNames = wh.assigned_user_names || wh.assigned_users || [];
            const assignedUsers = assignedNames.length > 0
                ? assignedNames.map(u => `<span class="inline-block bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full mr-1 mb-1">${escapeHtml(u)}</span>`).join('')
                : '<span class="text-gray-400 text-xs">Not assigned</span>';
            const overdueBadge = wh.is_overdue
                ? `<div class="mt-1 text-xs font-semibold text-red-600"><i class="fas fa-exclamation-triangle mr-1"></i>${wh.overdue_tasks.length} overdue task${wh.overdue_tasks.length === 1 ? '' : 's'}</div>`
                : '';
            const dueDateCell = (wh.due_dates || []).length
                ? (wh.due_dates || []).map(date => {
                    const isOverdue = (wh.overdue_due_dates || []).includes(date);
                    return `<span class="inline-block text-xs px-2 py-0.5 rounded-full mr-1 mb-1 ${isOverdue ? 'bg-red-100 text-red-700 font-semibold' : 'bg-gray-100 text-gray-700'}">${date}</span>`;
                }).join('')
                : '<span class="text-gray-400 text-xs">—</span>';

            tbody.innerHTML += `<tr class="hover:bg-gray-50">
                <td class="py-3 px-4 font-medium">${wh.warehouse_name}</td>
                <td class="py-3 px-4 text-xs text-gray-600">${wh.warehouse_address || '—'}</td>
                <td class="py-3 px-4">${statusBadge}${overdueBadge}</td>
                <td class="py-3 px-4">${assignedUsers}</td>
                <td class="py-3 px-4">${dueDateCell}</td>
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
                    ${wh.audit_user_id && wh.audit_date ? `<button class="text-indigo-600 hover:underline text-xs" onclick="window.viewWarehouseAuditDetail('${wh.audit_user_id}', '${wh.audit_date}')">
                        <i class="fas fa-eye mr-1"></i>View Details
                    </button>` : '<span class="text-gray-400 text-xs">No audit</span>'}
                </td>
            </tr>`;
        });
        renderPaginationControls('warehouse-status-pagination', warehouseStatusPagination, 'loadWarehouseStatus');
    }
    window.loadWarehouseStatus = loadWarehouseStatus;

    // Warehouse status filters
    const whStatusDateEl = document.getElementById('wh-status-date');
    const whStatusFilterEl = document.getElementById('wh-status-filter');
    const whStatusRefreshEl = document.getElementById('wh-status-refresh');

    if (whStatusDateEl) whStatusDateEl.addEventListener('change', () => loadWarehouseStatus(1));
    if (whStatusFilterEl) whStatusFilterEl.addEventListener('change', renderWarehouseStatus);
    if (whStatusRefreshEl) whStatusRefreshEl.addEventListener('click', () => loadWarehouseStatus(1));

    window.viewWarehouseAuditDetail = function (userId, date) {
        fetch(`/api/admin/audit-detail/${encodeURIComponent(userId)}/${encodeURIComponent(date)}`, {
            headers: { 'Authorization': bearerToken }
        })
            .then(r => r.json())
            .then(res => {
                if (!res.success) {
                    alert('Failed to load audit details: ' + (res.message || 'Unknown error'));
                    return;
                }
                showDetailedAuditModal(res.data, 'checklist');
            })
            .catch(err => {
                console.error('Warehouse audit detail error:', err);
                alert('Failed to load audit details');
            });
    };

    let globalAuditData = [];
    let allUploadHistory = [];
    let uploadHistoryCurrentPage = 1;
    let dataPagination = { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 10 };
    let dataCurrentPage = 1;

    function loadHistory() {
        const container = document.getElementById('upload-history-container');
        if (!container) return;

        container.innerHTML = '<p class="text-gray-500">Loading history...</p>';

        fetch('/api/admin/uploaded-history', { headers: { 'Authorization': bearerToken } })
            .then(r => {
                if (!r.ok) {
                    throw new Error(`HTTP ${r.status}: ${r.statusText}`);
                }
                return r.json();
            })
            .then(res => {
                if (res.success) {
                    allUploadHistory = res.data?.history || [];
                    uploadHistoryCurrentPage = 1; // Reset to first page
                    renderUploadHistory();
                } else {
                    container.innerHTML = `<p class="text-red-500">Error: ${res.message || 'Failed to load history'}</p>`;
                }
            })
            .catch(err => {
                console.error('History loading error:', err);
                container.innerHTML = `<p class="text-red-500">Error loading upload history: ${err.message}</p>`;
            });
    }

    window.changeUploadHistoryPage = function (page) {
        uploadHistoryCurrentPage = page;
        renderUploadHistory();
    };

    function renderUploadHistory() {
        const container = document.getElementById('upload-history-container');
        if (!container) return;

        const result = createPagination(allUploadHistory, uploadHistoryCurrentPage, 10);

        container.innerHTML = '';
        if (!result.data.length) {
            container.innerHTML = '<p class="text-sm text-gray-500">No previous uploads found.</p>';
            return;
        }

        const tbl = document.createElement('table');
        tbl.className = 'w-full text-sm text-left border-collapse';
        tbl.innerHTML = `<thead><tr class="border-b bg-gray-50"><th class="py-2 px-3">Date</th><th class="py-2 px-3">By</th><th class="py-2 px-3">Items Uploaded</th></tr></thead><tbody></tbody>`;

        result.data.forEach(h => {
            tbl.querySelector('tbody').innerHTML += `<tr class="border-b">
                <td class="py-2 px-3">${new Date(h.uploaded_at).toLocaleString()}</td>
                <td class="py-2 px-3">${h.uploaded_by}</td>
                <td class="py-2 px-3 font-semibold text-indigo-600">${h.total_items}</td>
            </tr>`;
        });

        container.appendChild(tbl);

        // Render pagination controls
        renderPaginationControls('upload-history-pagination', result.pagination, 'changeUploadHistoryPage');
    }

    function loadChecklistsData(page = 1) {
        dataCurrentPage = page;
        // Fetch all data once; do client-side pagination
        if (globalAuditData.length === 0 || page === 1) {
            fetch('/api/admin/checklist-data', { headers: { 'Authorization': bearerToken } })
                .then(r => {
                    if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
                    return r.json();
                })
                .then(res => {
                    if (res.success) {
                        globalAuditData = res.data.checklists || [];
                        dataPagination = {
                            currentPage: 1,
                            totalPages: Math.ceil(globalAuditData.length / 10) || 1,
                            totalItems: globalAuditData.length,
                            itemsPerPage: 10
                        };
                    }
                    renderDataTables(globalAuditData);
                })
                .catch(err => {
                    console.error('Checklist data fetch error:', err);
                });
        } else {
            renderDataTables(globalAuditData);
        }
    }

    function renderDataTables(allData) {
        // Client-side pagination
        const itemsPerPage = dataPagination.itemsPerPage || 10;
        const totalItems = allData.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
        const currentPage = Math.min(dataCurrentPage, totalPages);
        const start = (currentPage - 1) * itemsPerPage;
        const data = allData.slice(start, start + itemsPerPage);

        dataPagination = { currentPage, totalPages, totalItems, itemsPerPage };

        const cTbody = document.getElementById('checklist-table-body');
        const sTbody = document.getElementById('stockcount-table-body');
        if (cTbody) cTbody.innerHTML = '';
        if (sTbody) sTbody.innerHTML = '';

        if (!data.length) {
            if (cTbody) cTbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-400">No data found</td></tr>';
            if (sTbody) sTbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-400">No data found</td></tr>';
            renderDataPagination();
            return;
        }

        data.forEach((audit, idx) => {
            // idx is page-relative; global index for action buttons
            const globalIdx = start + idx;
            const dateStr = audit.submitted_at || audit.date;
            const warehouse = audit.warehouse_name || (audit.sections?.general_report?.warehouse_name) || 'Unknown Warehouse';

            // Checklist Row
            let acts = Object.values(audit.completion_status || {}).filter(Boolean).length;
            if (cTbody) {
                cTbody.innerHTML += `<tr class="hover:bg-gray-50">
                    <td class="py-2 px-4">${dateStr}</td>
                    <td class="py-2 px-4 text-xs">${audit.user_id}</td>
                    <td class="py-2 px-4">${warehouse}</td>
                    <td class="py-2 px-4">${acts} sections</td>
                    <td class="py-2 px-4">
                        <button class="text-indigo-600 hover:underline text-xs mr-2" onclick="window.viewAuditDetail(${globalIdx}, 'checklist')">
                            <i class="fas fa-eye mr-1"></i>View
                        </button>
                        <button class="text-green-600 hover:underline text-xs" onclick="window.exportSingleAudit(${globalIdx}, 'checklist')">
                            <i class="fas fa-download mr-1"></i>Export
                        </button>
                    </td>
                </tr>`;
            }

            // Stock count row
            let sc = (audit.stock_count_data || []).length;
            if (sTbody && sc > 0) {
                sTbody.innerHTML += `<tr class="hover:bg-gray-50">
                    <td class="py-2 px-4">${dateStr}</td>
                    <td class="py-2 px-4 text-xs">${audit.user_id}</td>
                    <td class="py-2 px-4">${warehouse}</td>
                    <td class="py-2 px-4">${sc} items</td>
                    <td class="py-2 px-4">
                        <button class="text-indigo-600 hover:underline text-xs mr-2" onclick="window.viewAuditDetail(${globalIdx}, 'stockcount')">
                            <i class="fas fa-eye mr-1"></i>View
                        </button>
                        <button class="text-green-600 hover:underline text-xs" onclick="window.exportSingleAudit(${globalIdx}, 'stockcount')">
                            <i class="fas fa-download mr-1"></i>Export
                        </button>
                    </td>
                </tr>`;
            }
        });

        if (sTbody && !sTbody.innerHTML.trim()) {
            sTbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-400">No stock count records found</td></tr>';
        }

        renderDataPagination();
    }

    function renderDataPagination() {
        // Write into the DATA TAB specific pagination containers (not dashboard ones)
        const clPag = document.getElementById('data-checklist-pagination');
        const scPag = document.getElementById('data-stockcount-pagination');

        const { currentPage, totalPages, totalItems, itemsPerPage } = dataPagination;

        if (totalPages <= 1) {
            const text = totalItems > 0
                ? `<div class="text-sm text-gray-600 mt-2">Showing all ${totalItems} records</div>`
                : '';
            if (clPag) clPag.innerHTML = text;
            if (scPag) scPag.innerHTML = text;
            return;
        }

        const html = `
            <div class="flex items-center justify-between mt-3 pt-3 border-t">
                <div class="text-sm text-gray-600">
                    Showing ${((currentPage - 1) * itemsPerPage) + 1}–${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems} records
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="changePage(${currentPage - 1})" 
                            ${currentPage <= 1 ? 'disabled' : ''} 
                            class="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed font-semibold">
                        <i class="fas fa-chevron-left"></i> Prev
                    </button>
                    <span class="text-sm font-semibold text-gray-700">Page ${currentPage} / ${totalPages}</span>
                    <button onclick="changePage(${currentPage + 1})" 
                            ${currentPage >= totalPages ? 'disabled' : ''} 
                            class="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed font-semibold">
                        Next <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;

        if (clPag) clPag.innerHTML = html;
        if (scPag) scPag.innerHTML = html;
    }

    window.changePage = function (page) {
        dataCurrentPage = page;
        renderDataTables(globalAuditData);
    };

    let allEmployees = [];
    let employeesPagination = { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 10 };

    function loadEmployees(page = 1) {
        fetch(`/api/admin/employees-stats?page=${page}&limit=${employeesPagination.itemsPerPage}`, { headers: { 'Authorization': bearerToken } })
            .then(r => {
                if (!r.ok) {
                    throw new Error(`HTTP ${r.status}: ${r.statusText}`);
                }
                return r.json();
            })
            .then(res => {
                if (res.success && res.data.users) {
                    allEmployees = res.data.users || [];
                    employeesPagination = {
                        currentPage: res.data.pagination?.current_page || 1,
                        totalPages: res.data.pagination?.total_pages || 1,
                        totalItems: res.data.pagination?.total_items || 0,
                        itemsPerPage: res.data.pagination?.items_per_page || 10
                    };
                    renderEmployees(allEmployees);
                } else {
                    console.error('Employees error:', res.message);
                    // Fallback to non-paginated API
                    fetch('/api/admin/employees-stats', { headers: { 'Authorization': bearerToken } })
                        .then(r => r.json()).then(res => {
                            if (res.success && res.data.users) {
                                allEmployees = res.data.users.slice(0, 10) || [];
                                renderEmployees(allEmployees);
                            }
                        }).catch(() => { });
                }
            })
            .catch(err => {
                console.error('Employees fetch error:', err);
                // Fallback to non-paginated API
                fetch('/api/admin/employees-stats', { headers: { 'Authorization': bearerToken } })
                    .then(r => r.json()).then(res => {
                        if (res.success && res.data.users) {
                            allEmployees = res.data.users.slice(0, 10) || [];
                            renderEmployees(allEmployees);
                        }
                    }).catch(() => { });
            });
    }

    function renderEmployees(employees) {
        const b = document.getElementById('employees-table-body');
        if (!b) return;

        b.innerHTML = '';
        if (!employees.length) {
            b.innerHTML = '<tr><td colspan="2" class="py-4 text-center text-gray-400">No employees found</td></tr>';
            renderEmployeesPagination();
            return;
        }
        employees.forEach(u => {
            b.innerHTML += `<tr class="hover:bg-gray-50">
                <td class="py-2 px-4">${u.email}</td>
                <td class="py-2 px-4">${u.name}</td>
            </tr>`;
        });

        renderEmployeesPagination();
    }

    function renderEmployeesPagination() {
        const container = document.getElementById('employees-pagination');
        if (!container) return;

        const { currentPage, totalPages, totalItems, itemsPerPage } = employeesPagination;

        if (totalPages <= 1) {
            container.innerHTML = totalItems > 0 ?
                `<div class="text-sm text-gray-600 mt-4">Showing all ${totalItems} employees</div>` : '';
            return;
        }

        let html = `
            <div class="flex items-center justify-between mt-4">
                <div class="text-sm text-gray-600">
                    Showing ${((currentPage - 1) * itemsPerPage) + 1} to ${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems} employees
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="loadEmployees(${currentPage - 1})" 
                            ${currentPage <= 1 ? 'disabled' : ''} 
                            class="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        <i class="fas fa-chevron-left"></i> Previous
                    </button>
                    <span class="text-sm text-gray-600">Page ${currentPage} of ${totalPages}</span>
                    <button onclick="loadEmployees(${currentPage + 1})" 
                            ${currentPage >= totalPages ? 'disabled' : ''} 
                            class="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        Next <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
        container.innerHTML = html;
    }

    // Employee search
    const employeeSearchEl = document.getElementById('employee-search');
    if (employeeSearchEl) {
        employeeSearchEl.addEventListener('input', (e) => {
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
    }

    document.getElementById('export-checklist-all').addEventListener('click', () => exportToCSV(globalAuditData, 'checklist'));
    document.getElementById('export-stockcount-all').addEventListener('click', () => exportToCSV(globalAuditData, 'stockcount'));

    function exportToCSV(data, mode) {
        if (!data || !data.length) { alert("No data"); return; }
        const wb = XLSX.utils.book_new();
        // Super simple flatten logic for admin export
        let rows = [];
        data.forEach(d => {
            if (mode === 'stockcount' && d.stock_count_data) {
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
    //  DATA SEARCH & FILTER (with pagination)
    // ─────────────────────────────────────────────────────────────────────
    function initDataSearch() {
        const searchBtn = document.getElementById('data-search-btn');
        const clearBtn = document.getElementById('data-clear-btn');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const userQuery = document.getElementById('data-search-user')?.value.toLowerCase().trim() || '';
                const dateQuery = document.getElementById('data-search-date')?.value || '';
                const warehouseQuery = document.getElementById('data-search-warehouse')?.value.toLowerCase().trim() || '';

                const filtered = globalAuditData.filter(audit => {
                    if (userQuery && !audit.user_id.toLowerCase().includes(userQuery)) return false;
                    if (dateQuery && audit.date !== dateQuery) return false;
                    const warehouse = (audit.warehouse_name || audit.general_report?.warehouse_name || '').toLowerCase();
                    if (warehouseQuery && !warehouse.includes(warehouseQuery)) return false;
                    return true;
                });

                renderDataTables(filtered);
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const userEl = document.getElementById('data-search-user');
                const dateEl = document.getElementById('data-search-date');
                const warehouseEl = document.getElementById('data-search-warehouse');

                if (userEl) userEl.value = '';
                if (dateEl) dateEl.value = '';
                if (warehouseEl) warehouseEl.value = '';

                renderDataTables(globalAuditData);
            });
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    //  DETAIL MODAL
    // ─────────────────────────────────────────────────────────────────────
    function initDetailModal() {
        document.getElementById('close-detail-modal').addEventListener('click', () => {
            document.getElementById('detail-modal').classList.add('hidden');
        });
    }

    window.viewAuditDetail = function (idx, type) {
        const audit = globalAuditData[idx];
        if (!audit) return;

        const modal = document.getElementById('detail-modal');
        const content = document.getElementById('detail-modal-content');
        wireDetailModalScroll(modal, content);

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
        modal.classList.remove('hidden');
        content.innerHTML = html;
        requestAnimationFrame(() => {
            content.scrollTop = 0;
        });
    };

    window.exportSingleAudit = function (idx, type) {
        const audit = globalAuditData[idx];
        if (!audit) {
            alert('Audit record not found');
            return;
        }

        if (!audit.user_id || !audit.date) {
            alert('Missing audit information for export');
            return;
        }

        // Create download URL with proper authentication
        const url = `/api/admin/export-audit/${encodeURIComponent(audit.user_id)}/${encodeURIComponent(audit.date)}?type=${type}`;

        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.style.display = 'none';

        // Add authorization header by creating a fetch request
        fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': bearerToken
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                // Create download link from blob
                const downloadUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = downloadUrl;

                // Get filename from response headers or create default
                const filename = `${type}_${audit.user_id}_${audit.date}.xlsx`;
                link.download = filename;

                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Clean up the URL object
                window.URL.revokeObjectURL(downloadUrl);
            })
            .catch(error => {
                console.error('Export error:', error);
                alert(`Export failed: ${error.message}`);
            });
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
                analyticsCharts.userCompletion.data.labels = data.completion_by_user.map(u => u.user_name || u.user);
                analyticsCharts.userCompletion.data.datasets[0].data = data.completion_by_user.map(u => u.completed);
                analyticsCharts.userCompletion.update();

                // Update Warehouse Distribution Chart
                analyticsCharts.warehouseDist.data.labels = data.warehouse_distribution.map(w => w.warehouse);
                analyticsCharts.warehouseDist.data.datasets[0].data = data.warehouse_distribution.map(w => w.count);
                analyticsCharts.warehouseDist.update();

                // Update Section Breakdown Chart
                analyticsCharts.sectionBreakdown.data.labels = ['Completed Sections', 'Pending Sections'];
                analyticsCharts.sectionBreakdown.data.datasets[0].data = [
                    data.section_breakdown.completed,
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
        if (!file) return;
        document.getElementById('file-selected-info').classList.remove('hidden');
        document.getElementById('file-selected-name').textContent = file.name;
        step1Next.disabled = false;

        const reader = new FileReader();
        reader.onload = function (e) {
            const data = new Uint8Array(e.target.result);
            parsedWorkbook = XLSX.read(data, { type: 'array' });
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
        document.getElementById('wizard-step-' + s).classList.add('active');
        document.querySelectorAll('.step-indicator .step').forEach(el => {
            let n = parseInt(el.dataset.step);
            el.classList.remove('active');
            if (n === s) el.classList.add('active');
        });
        document.getElementById('wizard-progress').style.width = (s * 33) + "%";
    }

    step1Next.addEventListener('click', () => {
        if (!parsedWorkbook) return;
        setWizStep(2);
        const slist = document.getElementById('sheet-list');
        slist.innerHTML = '';
        parsedWorkbook.SheetNames.forEach(name => {
            const ws = parsedWorkbook.Sheets[name];
            let html = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
            // Detect header (find row with 'qty' or non empty)
            let headerIdx = -1;
            for (let r = 0; r < Math.min(html.length, 30); r++) {
                if (html[r].some(cell => String(cell).toLowerCase().includes('qty'))) {
                    headerIdx = r; break;
                }
            }
            if (headerIdx === -1) headerIdx = 0; // fallback

            slist.innerHTML += `<label class="sheet-checkbox-label">
                <input type="checkbox" value="${name}" data-idx="${headerIdx}">
                <span>${name} <small class="text-gray-400">(${html.length} rows, HDR row ${headerIdx + 1})</small></span>
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
            let rawData = XLSX.utils.sheet_to_json(parsedWorkbook.Sheets[name], { header: 1, defval: "" });
            let cols = rawData[hdrIdx] || [];
            selectedSheetsData.push({ name, hdrIdx, cols, rows: rawData.slice(hdrIdx + 1) });

            let opts = `<option value="">-- Ignore --</option>` + cols.map((c, i) => `<option value="${i}">${c || 'Col ' + (i + 1)}</option>`).join('');

            // Auto-detect indices
            let defCode = "", defName = "", defQty = "";
            cols.forEach((c, i) => {
                let sl = String(c).toLowerCase();
                if (sl.includes('code')) defCode = i;
                else if (sl.includes('name')) defName = i;
                else if (sl.includes('qty') || sl.includes('quantity')) defQty = i;
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

            if (!idxCode || !idxName || !idxQty) {
                alert(`Please map Code, Name and Quantity for sheet: ${sName}`);
                isValid = false; return;
            }

            let sheetData = selectedSheetsData.find(s => s.name === sName);
            let items = [];
            sheetData.rows.forEach(r => {
                items.push({
                    item_code: String(r[idxCode] || '').trim(),
                    item_name: String(r[idxName] || '').trim(),
                    qty: String(r[idxQty] || '').trim(),
                    extra_col: idxExt !== "" ? String(r[idxExt] || '').trim() : ""
                });
            });
            payload.sheets.push({ sheet_name: sName, items });
        });

        if (!isValid) return;

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
            if (res.success) {
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
            alert("Error: " + err);
            btnUpload.disabled = false;
        });
    });

    // ─────────────────────────────────────────────────────────────────────
    //  STOCK RECONCILIATION (with pagination)
    // ─────────────────────────────────────────────────────────────────────
    let reconciliationData = [];
    let reconciliationPagination = { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 10 };

    function getFilteredReconciliation() {
        const searchEl = document.getElementById('recon-search');
        const query = searchEl ? searchEl.value.toLowerCase().trim() : '';
        if (!query) return reconciliationData;

        return reconciliationData.filter(item => {
            return [
                item.item_code,
                item.item_name,
                item.user_id,
                item.variance_status,
                item.audit_status,
                item.date,
                item.warehouse_name,
                item.system_quantity,
                item.physical_quantity
            ].some(value => String(value || '').toLowerCase().includes(query));
        });
    }

    function loadReconciliation(page = 1) {
        const fromDateEl = document.getElementById('recon-from-date');
        const toDateEl = document.getElementById('recon-to-date');
        const refreshEl = document.getElementById('recon-refresh');

        const fromDate = fromDateEl ? fromDateEl.value : '';
        const toDate = toDateEl ? toDateEl.value : '';

        if (!fromDate || !toDate) {
            alert('Please select both from and to dates');
            return;
        }

        let url = `/api/admin/stock-reconciliation?from_date=${fromDate}&to_date=${toDate}&page=${page}&limit=${reconciliationPagination.itemsPerPage}`;

        if (refreshEl) {
            refreshEl.disabled = true;
            refreshEl.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Loading...';
        }

        fetch(url, { headers: { 'Authorization': bearerToken } })
            .then(r => r.json())
            .then(res => {
                if (!res.success) {
                    alert('Failed to load reconciliation: ' + res.message);
                    return;
                }
                reconciliationData = res.data.reconciliation || [];
                reconciliationPagination = {
                    currentPage: res.data.pagination?.current_page || 1,
                    totalPages: res.data.pagination?.total_pages || 1,
                    totalItems: res.data.pagination?.total_items || 0,
                    itemsPerPage: res.data.pagination?.items_per_page || 10
                };
                renderReconciliation();
            })
            .catch(err => {
                console.error('Reconciliation error:', err);
                alert('Error loading reconciliation data');
            })
            .finally(() => {
                if (refreshEl) {
                    refreshEl.disabled = false;
                    refreshEl.innerHTML = '<i class="fas fa-sync-alt mr-1"></i> Load Report';
                }
            });
    }

    function initReconciliation() {
        // Set default date range (last 7 days)
        const today = new Date();
        const weekAgo = new Date();
        weekAgo.setDate(today.getDate() - 7);

        const fromDateEl = document.getElementById('recon-from-date');
        const toDateEl = document.getElementById('recon-to-date');
        const refreshEl = document.getElementById('recon-refresh');
        const exportEl = document.getElementById('recon-export');
        const searchEl = document.getElementById('recon-search');

        if (fromDateEl) fromDateEl.value = weekAgo.toISOString().split('T')[0];
        if (toDateEl) toDateEl.value = today.toISOString().split('T')[0];

        // Add event listeners (with null checks)
        if (refreshEl) refreshEl.addEventListener('click', () => loadReconciliation(1));
        if (exportEl) exportEl.addEventListener('click', exportReconciliation);
        if (searchEl) searchEl.addEventListener('input', renderReconciliation);

        // DON'T auto-load - let user click "Load Report" button
        // This prevents slow query on page open
    }

    let reconCurrentPage = 1;
    const RECON_PAGE_SIZE = 10;

    function renderReconciliation() {
        const filtered = getFilteredReconciliation();
        const summary = {
            total_items: filtered.length,
            matched: filtered.filter(r => r.variance_status === 'Match').length,
            excess: filtered.filter(r => r.variance_status === 'Excess').length,
            shortage: filtered.filter(r => r.variance_status === 'Shortage').length,
            match_rate: filtered.length ? Math.round(filtered.filter(r => r.variance_status === 'Match').length / filtered.length * 100) : 0
        };

        const totalEl = document.getElementById('recon-total');
        const matchedEl = document.getElementById('recon-matched');
        const excessEl = document.getElementById('recon-excess');
        const shortageEl = document.getElementById('recon-shortage');
        const matchRateEl = document.getElementById('recon-match-rate');

        if (totalEl) totalEl.textContent = summary.total_items;
        if (matchedEl) matchedEl.textContent = summary.matched;
        if (excessEl) excessEl.textContent = summary.excess;
        if (shortageEl) shortageEl.textContent = summary.shortage;
        if (matchRateEl) matchRateEl.textContent = summary.match_rate + '%';

        // Client-side pagination
        const totalPages = Math.max(1, Math.ceil(filtered.length / RECON_PAGE_SIZE));
        reconCurrentPage = Math.min(reconCurrentPage, totalPages);
        const start = (reconCurrentPage - 1) * RECON_PAGE_SIZE;
        const pageData = filtered.slice(start, start + RECON_PAGE_SIZE);

        const tbody = document.getElementById('recon-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="9" class="py-6 text-center text-gray-400">No reconciliation data found. Click "Load Report" to fetch data.</td></tr>';
            renderReconciliationPagination(0, 1, 1);
            return;
        }

        pageData.forEach(item => {
            let statusBadge = '';
            if (item.variance_status === 'Match') {
                statusBadge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Match</span>';
            } else if (item.variance_status === 'Excess') {
                statusBadge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Excess</span>';
            } else {
                statusBadge = '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Shortage</span>';
            }

            const varianceText = item.variance >= 0 ? `+${item.variance}` : item.variance;
            const varianceColor = item.variance === 0 ? 'text-gray-600' : item.variance > 0 ? 'text-blue-600' : 'text-red-600';

            tbody.innerHTML += `<tr class="hover:bg-gray-50">
                <td class="py-2 px-4 font-mono text-xs">${item.item_code}</td>
                <td class="py-2 px-4 text-xs">${item.item_name}</td>
                <td class="py-2 px-4 text-xs">${item.sheet_name || '—'}</td>
                <td class="py-2 px-4 text-center">${item.system_quantity}</td>
                <td class="py-2 px-4 text-center">${item.physical_quantity}</td>
                <td class="py-2 px-4 text-center font-semibold ${varianceColor}">${varianceText} (${item.variance_percentage}%)</td>
                <td class="py-2 px-4">${statusBadge}</td>
                <td class="py-2 px-4 text-xs">${item.remarks || '—'}</td>
                <td class="py-2 px-4 text-xs">${item.auditor_name || item.user_id}</td>
            </tr>`;
        });

        renderReconciliationPagination(filtered.length, totalPages, reconCurrentPage);
    }

    function renderReconciliationPagination(totalItems, totalPages, currentPage) {
        const container = document.getElementById('recon-pagination');
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = totalItems > 0
                ? `<div class="text-sm text-gray-600 mt-2">Showing all ${totalItems} items</div>`
                : '';
            container.classList.remove('hidden');
            return;
        }

        const from = (currentPage - 1) * RECON_PAGE_SIZE + 1;
        const to = Math.min(currentPage * RECON_PAGE_SIZE, totalItems);

        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="flex items-center justify-between mt-3 pt-3 border-t">
                <div class="text-sm text-gray-600">Showing ${from}–${to} of ${totalItems} items</div>
                <div class="flex items-center gap-2">
                    <button onclick="changeReconPage(${currentPage - 1})" 
                            ${currentPage <= 1 ? 'disabled' : ''} 
                            class="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed font-semibold">
                        <i class="fas fa-chevron-left"></i> Prev
                    </button>
                    <span class="text-sm font-semibold text-gray-700">Page ${currentPage} / ${totalPages}</span>
                    <button onclick="changeReconPage(${currentPage + 1})" 
                            ${currentPage >= totalPages ? 'disabled' : ''} 
                            class="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed font-semibold">
                        Next <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    window.changeReconPage = function (page) {
        reconCurrentPage = page;
        renderReconciliation();
    };

    function exportReconciliation() {
        const filtered = getFilteredReconciliation();
        if (!filtered.length) {
            alert('No data to export. Please load reconciliation data first.');
            return;
        }

        const headers = ['Item Code', 'Item Name', 'Sheet', 'System Qty', 'Physical Qty', 'Variance', 'Variance %', 'Status', 'Remarks', 'Auditor'];
        const rows = filtered.map(item => [
            item.item_code, item.item_name, item.sheet_name || '',
            item.system_quantity, item.physical_quantity,
            item.variance, item.variance_percentage,
            item.variance_status, item.remarks || '',
            item.auditor_name || item.user_id
        ]);

        let csv = headers.join(',') + '\n';
        csv += rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Use date range from the filter inputs
        const fromDate = document.getElementById('recon-from-date')?.value || 'report';
        const toDate = document.getElementById('recon-to-date')?.value || '';
        a.download = `reconciliation_${fromDate}${toDate ? '_to_' + toDate : ''}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  TASK ASSIGNMENT
    // ─────────────────────────────────────────────────────────────────────
    let allWarehouses = [];
    let allUsers = [];

    function initTaskAssignment() {
        document.getElementById('open-assign-task-modal').addEventListener('click', openAssignTaskModal);
        document.getElementById('close-assign-task-modal').addEventListener('click', closeAssignTaskModal);
        document.getElementById('cancel-assign-task').addEventListener('click', closeAssignTaskModal);
        document.getElementById('submit-assign-task').addEventListener('click', submitTaskAssignment);
        document.getElementById('task-refresh').addEventListener('click', loadTaskAssignments);

        loadTaskAssignments();
    }

    function openAssignTaskModal() {
        // Load warehouses and users
        Promise.all([
            fetch('/api/admin/warehouse-master', { headers: { 'Authorization': bearerToken } }).then(r => r.json()),
            fetch('/api/admin/employees-stats', { headers: { 'Authorization': bearerToken } }).then(r => r.json())
        ]).then(([whRes, usersRes]) => {
            if (whRes.success) {
                allWarehouses = whRes.data.warehouses;
                const whSelect = document.getElementById('task-warehouse');
                whSelect.innerHTML = '<option value="">Select warehouse...</option>';
                allWarehouses.forEach(wh => {
                    whSelect.innerHTML += `<option value="${wh.warehouse_name}">${wh.warehouse_name}</option>`;
                });
            }

            if (usersRes.success) {
                allUsers = usersRes.data.users;
                const userSelect = document.getElementById('task-users');
                userSelect.innerHTML = '';
                allUsers.forEach(user => {
                    userSelect.innerHTML += `<option value="${user.email}">${user.email} (${user.name || 'N/A'})</option>`;
                });
            }

            document.getElementById('assign-task-modal').classList.remove('hidden');
        });
    }

    function closeAssignTaskModal() {
        document.getElementById('assign-task-modal').classList.add('hidden');

        // Reset form
        document.getElementById('task-warehouse').value = '';
        document.getElementById('task-type').value = 'checklist';
        document.getElementById('task-due-date').value = '';
        document.getElementById('task-notes').value = '';

        // Clear user selection
        const userSelect = document.getElementById('task-users');
        Array.from(userSelect.options).forEach(option => option.selected = false);
    }

    function submitTaskAssignment(e) {
        if (e && e.preventDefault) {
            e.preventDefault();
        }

        // Validate form
        const warehouse = document.getElementById('task-warehouse').value;
        const taskType = document.getElementById('task-type').value;
        const dueDate = document.getElementById('task-due-date').value;
        const notes = document.getElementById('task-notes').value;

        if (!warehouse) {
            alert('Please select a warehouse');
            return;
        }

        if (!dueDate) {
            alert('Please select a due date');
            return;
        }

        const userSelect = document.getElementById('task-users');
        const assignedTo = Array.from(userSelect.selectedOptions).map(opt => opt.value);

        if (!assignedTo.length) {
            alert('Please select at least one user');
            return;
        }

        const payload = {
            warehouse_name: warehouse,
            assigned_to: assignedTo,
            task_type: taskType,
            due_date: dueDate,
            notes: notes
        };

        // Disable submit button
        const submitBtn = document.getElementById('submit-assign-task');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>Assigning...';

        fetch('/api/admin/assign-task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': bearerToken
            },
            body: JSON.stringify(payload)
        })
            .then(r => r.json())
            .then(res => {
                if (res.success) {
                    alert('✅ ' + res.message);
                    closeAssignTaskModal();
                    loadTaskAssignments();
                } else {
                    alert('Failed to assign task: ' + res.message);
                }
            })
            .catch(err => {
                console.error('Task assignment error:', err);
                alert('Error assigning task');
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-check mr-1"></i>Assign Task';
            });
    }

    function loadTaskAssignments() {
        const date = document.getElementById('task-filter-date').value;
        const warehouse = document.getElementById('task-filter-warehouse').value;

        let url = '/api/admin/task-assignments?';
        if (date) url += `date=${date}&`;
        if (warehouse) url += `warehouse=${encodeURIComponent(warehouse)}&`;

        fetch(url, { headers: { 'Authorization': bearerToken } })
            .then(r => r.json())
            .then(res => {
                if (!res.success) {
                    alert('Failed to load tasks: ' + res.message);
                    return;
                }
                renderTaskAssignments(res.data.tasks);
            })
            .catch(err => {
                console.error('Load tasks error:', err);
                alert('Error loading tasks');
            });
    }

    function renderTaskAssignments(tasks) {
        const tbody = document.getElementById('task-table-body');
        tbody.innerHTML = '';

        if (!tasks.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="py-6 text-center text-gray-400">No tasks assigned yet</td></tr>';
            return;
        }

        tasks.forEach(task => {
            const taskTypeBadge = task.task_type === 'checklist'
                ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">Checklist</span>'
                : '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">Stock Count</span>';

            const effectiveStatus = task.effective_status || task.status;
            const statusBadge = effectiveStatus === 'Completed'
                ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Completed</span>'
                : effectiveStatus === 'Overdue'
                    ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700"><i class="fas fa-exclamation-triangle mr-1"></i>Overdue</span>'
                    : '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Assigned</span>';

            const assignedUsers = (task.assigned_to_names || task.assigned_to || []).map(u =>
                `<span class="inline-block bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full mr-1 mb-1">${escapeHtml(u)}</span>`
            ).join('');
            const dueDateCell = task.is_overdue
                ? `<span class="font-semibold text-red-600">${task.due_date}</span>`
                : task.due_date;

            tbody.innerHTML += `<tr class="hover:bg-gray-50">
                <td class="py-2 px-4 font-medium">${task.warehouse_name}</td>
                <td class="py-2 px-4">${taskTypeBadge}</td>
                <td class="py-2 px-4">${assignedUsers}</td>
                <td class="py-2 px-4 text-xs">${dueDateCell}</td>
                <td class="py-2 px-4">${statusBadge}</td>
                <td class="py-2 px-4 text-xs text-gray-600">${task.notes || '—'}</td>
                <td class="py-2 px-4">
                    <button class="text-red-600 hover:underline text-xs" onclick="window.deleteTask('${task._id}')">
                        <i class="fas fa-trash mr-1"></i>Delete
                    </button>
                </td>
            </tr>`;
        });
    }

    window.deleteTask = function (taskId) {
        if (!confirm('Are you sure you want to delete this task?')) return;

        fetch(`/api/admin/task-assignments/${taskId}`, {
            method: 'DELETE',
            headers: { 'Authorization': bearerToken }
        })
            .then(r => r.json())
            .then(res => {
                if (res.success) {
                    alert('✅ Task deleted');
                    loadTaskAssignments();
                } else {
                    alert('Failed to delete task: ' + res.message);
                }
            })
            .catch(err => {
                console.error('Delete task error:', err);
                alert('Error deleting task');
            });
    };

});
