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
        // Init Views
        const sections = document.querySelectorAll('.view-section');
        document.querySelectorAll('.sidebar-item').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                sections.forEach(s => s.classList.add('hidden'));
                document.getElementById(btn.dataset.target + '-view').classList.remove('hidden');
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
    }

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
                    const cTbody = document.getElementById('checklist-table-body');
                    const sTbody = document.getElementById('stockcount-table-body');
                    cTbody.innerHTML = ''; sTbody.innerHTML = '';

                    globalAuditData.forEach(audit => {
                        const dateStr = audit.submitted_at || audit.date;
                        // Checklist Row
                        let acts = Object.values(audit.completion_status || {}).filter(Boolean).length;
                        cTbody.innerHTML += `<tr>
                            <td class="py-2 px-4">${dateStr}</td>
                            <td class="py-2 px-4">${audit.user_id}</td>
                            <td class="py-2 px-4">${acts} sections</td>
                            <td class="py-2 px-4"><button class="text-indigo-600 hover:underline text-xs" onclick="alert('Export individual not implemented directly yet. Export all.')">Export</button></td>
                        </tr>`;
                        
                        // Stock count row
                        let sc = (audit.stock_count_data || []).length;
                        sTbody.innerHTML += `<tr>
                            <td class="py-2 px-4">${dateStr}</td>
                            <td class="py-2 px-4">${audit.user_id}</td>
                            <td class="py-2 px-4">${sc} items</td>
                            <td class="py-2 px-4"><button class="text-indigo-600 hover:underline text-xs" onclick="alert('Use Export all.')">Export</button></td>
                        </tr>`;
                    });
                }
            });
    }

    function loadEmployees() {
        fetch('/api/admin/employees-stats', { headers: { 'Authorization': bearerToken } })
            .then(r => r.json()).then(res => {
                const b = document.getElementById('employees-table-body');
                b.innerHTML = '';
                if(res.success && res.data.users) {
                    res.data.users.forEach(u => {
                        b.innerHTML += `<tr>
                            <td class="py-2 px-4">${u.email}</td>
                            <td class="py-2 px-4">${u.name}</td>
                        </tr>`;
                    });
                }
            });
    }

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
