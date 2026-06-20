// Google Sheets API JSONP URL
const SHEET_JSONP_URL = "https://docs.google.com/spreadsheets/d/1RARIwar5tLY0p4UozTLuuSKlVRrG5n7Ush1U8hfQIyo/gviz/tq?tqx=responseHandler:handleGoogleSheetResponse";

// IndexedDB Configuration
const DB_NAME = "PramonProcurementDB";
const DB_VERSION = 1;
const STORE_NAME = "documents";
let db = null;

// Application State
let projectsData = [];
let filteredData = [];
let uploadedDocuments = [];
let currentFilters = {
    search: "",
    group: "all",
    status: "all"
};
let docFilters = {
    search: "",
    project: "all"
};
let currentSort = {
    column: "id",
    direction: "asc" // 'asc' or 'desc'
};
let activeModalProjectId = null;

// Chart Instances
let statusChartInstance = null;
let budgetChartInstance = null;

// DOM Elements - General & Loading
const loadingOverlay = document.getElementById("loading-overlay");
const errorContainer = document.getElementById("error-container");
const dashboardContent = document.getElementById("dashboard-content");
const lastUpdatedSpan = document.getElementById("last-updated");
const refreshIcon = document.getElementById("refresh-icon");
const btnRefresh = document.getElementById("btn-refresh");
const btnRetry = document.getElementById("btn-retry");

// DOM Elements - Tabs
const navDashboard = document.getElementById("nav-dashboard");
const navDocuments = document.getElementById("nav-documents");
const tabDashboard = document.getElementById("tab-dashboard");
const tabDocuments = document.getElementById("tab-documents");

// DOM Elements - KPI Summary
const kpiTotalProjects = document.getElementById("kpi-total-projects");
const kpiAllocatedBudget = document.getElementById("kpi-allocated-budget");
const kpiSpentBudget = document.getElementById("kpi-spent-budget");
const kpiRemainingBudget = document.getElementById("kpi-remaining-budget");
const kpiSpentRatio = document.getElementById("kpi-spent-ratio");
const kpiRemainingRatio = document.getElementById("kpi-remaining-ratio");
const kpiAvgProgress = document.getElementById("kpi-avg-progress");
const kpiAvgProgressBar = document.getElementById("kpi-avg-progress-bar");

// DOM Elements - Status Counters
const countNotStarted = document.getElementById("count-not-started");
const countInProgress = document.getElementById("count-in-progress");
const countCompleted = document.getElementById("count-completed");
const countAllProjects = document.getElementById("count-all-projects");
const pillAllFilter = document.getElementById("pill-all-filter");

// DOM Elements - Dashboard Filters
const searchInput = document.getElementById("search-input");
const filterGroup = document.getElementById("filter-group");
const filterStatus = document.getElementById("filter-status");
const btnClearFilters = document.getElementById("btn-clear-filters");

// DOM Elements - Projects Table
const projectsTableBody = document.getElementById("projects-table-body");
const filteredCountBadge = document.getElementById("filtered-count");
const emptyState = document.getElementById("empty-state");
const tableHeaders = document.querySelectorAll("#projects-table th.sortable");

// DOM Elements - Modal View
const projectModal = document.getElementById("project-modal");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalOkBtn = document.getElementById("modal-ok-btn");
const modalProjectName = document.getElementById("modal-project-name");
const modalProjectGroup = document.getElementById("modal-project-group");
const modalProjectId = document.getElementById("modal-project-id");
const modalProjectManager = document.getElementById("modal-project-manager");
const modalProjectStatus = document.getElementById("modal-project-status");
const modalProjectProgressVal = document.getElementById("modal-project-progress-val");
const modalProjectProgressBar = document.getElementById("modal-project-progress-bar");
const modalProjectBudget = document.getElementById("modal-project-budget");
const modalProjectSpent = document.getElementById("modal-project-spent");
const modalProjectRemaining = document.getElementById("modal-project-remaining");

// DOM Elements - Modal Documents Section
const modalProjectDocList = document.getElementById("modal-project-doc-list");
const modalProjectDocEmpty = document.getElementById("modal-project-doc-empty");
const modalBtnTriggerUpload = document.getElementById("modal-btn-trigger-upload");
const modalQuickUploadPanel = document.getElementById("modal-quick-upload-panel");
const modalUploadCategory = document.getElementById("modal-upload-category");
const modalUploadTitle = document.getElementById("modal-upload-title");
const modalUploadFile = document.getElementById("modal-upload-file");
const modalBtnUploadSubmit = document.getElementById("modal-btn-upload-submit");
const modalBtnUploadCancel = document.getElementById("modal-btn-upload-cancel");

// DOM Elements - Procurement Tab
const uploadDocumentForm = document.getElementById("upload-document-form");
const docProjectIdSelect = document.getElementById("doc-project-id");
const docCategorySelect = document.getElementById("doc-category");
const docTitleInput = document.getElementById("doc-title");
const docFileInput = document.getElementById("doc-file-input");
const fileDropZone = document.getElementById("file-drop-zone");
const filePreviewArea = document.getElementById("file-preview-area");
const previewFileName = document.getElementById("preview-file-name");
const previewFileSize = document.getElementById("preview-file-size");
const btnRemovePreview = document.getElementById("btn-remove-preview");

const searchDocInput = document.getElementById("search-doc-input");
const filterDocProject = document.getElementById("filter-doc-project");
const documentsTableBody = document.getElementById("documents-table-body");
const docTotalBadge = document.getElementById("doc-total-badge");
const docEmptyState = document.getElementById("doc-empty-state");

// --- 1. Database Operations (IndexedDB) ---

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (e) => {
            console.error("IndexedDB failed to open:", e);
            reject("ไม่สามารถเชื่อมต่อฐานข้อมูลได้");
        };

        request.onsuccess = (e) => {
            db = e.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (e) => {
            const dbInstance = e.target.result;
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                const store = dbInstance.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
                store.createIndex("projectId", "projectId", { unique: false });
                store.createIndex("uploadedAt", "uploadedAt", { unique: false });
            }
        };
    });
}

function saveDocToDB(docObj) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not initialized");

        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(docObj);

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
}

function getDocsFromDB() {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not initialized");

        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

function deleteDocFromDB(id) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not initialized");

        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- 2. Initial Setup & Event Wire-Up ---

document.addEventListener("DOMContentLoaded", async () => {
    // Initialize Database
    try {
        await initDB();
        await refreshDocList();
    } catch (err) {
        console.error(err);
    }

    // Fetch Sheets Data
    fetchData();

    // Event Listeners - Refresh & Retry
    btnRefresh.addEventListener("click", fetchData);
    btnRetry.addEventListener("click", fetchData);
    
    // Tab switching
    navDashboard.addEventListener("click", () => switchTab("tab-dashboard"));
    navDocuments.addEventListener("click", () => switchTab("tab-documents"));

    // Event Listeners - Dashboard Filters
    searchInput.addEventListener("input", handleSearch);
    filterGroup.addEventListener("change", handleGroupFilter);
    filterStatus.addEventListener("change", handleStatusFilter);
    btnClearFilters.addEventListener("click", clearAllFilters);

    // Event Listeners - Sorting Headers
    tableHeaders.forEach(th => {
        th.addEventListener("click", () => {
            const column = th.dataset.sort;
            handleSort(column);
        });
    });

    // Event Listeners - Modal
    modalCloseBtn.addEventListener("click", closeModal);
    modalOkBtn.addEventListener("click", closeModal);
    projectModal.addEventListener("click", (e) => {
        if (e.target === projectModal) closeModal();
    });
    
    // Esc key to close modal
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
    });

    // Modal Document Quick Upload Listeners
    modalBtnTriggerUpload.addEventListener("click", toggleModalQuickUpload);
    modalBtnUploadCancel.addEventListener("click", hideModalQuickUpload);
    modalBtnUploadSubmit.addEventListener("click", handleModalQuickUploadSubmit);

    // Event Listeners - Procurement Document Form
    docFileInput.addEventListener("change", handleFileSelect);
    btnRemovePreview.addEventListener("click", resetFileDropZone);
    uploadDocumentForm.addEventListener("submit", handleDocumentFormSubmit);

    // Drag and Drop Zone handlers
    fileDropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        fileDropZone.classList.add("drag-over");
    });

    fileDropZone.addEventListener("dragleave", () => {
        fileDropZone.classList.remove("drag-over");
    });

    fileDropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        fileDropZone.classList.remove("drag-over");
        if (e.dataTransfer.files.length > 0) {
            docFileInput.files = e.dataTransfer.files;
            handleFileSelect();
        }
    });

    // Event Listeners - Procurement Table Search & Filters
    searchDocInput.addEventListener("input", handleDocSearch);
    filterDocProject.addEventListener("change", handleDocProjectFilter);
});

// --- 3. Tab Navigation Controller ---

function switchTab(tabId) {
    // Toggle tab content visibility
    if (tabId === "tab-dashboard") {
        tabDashboard.classList.remove("hidden");
        tabDocuments.classList.add("hidden");
        navDashboard.classList.add("active");
        navDocuments.classList.remove("active");
        
        // Re-render dashboard elements to ensure charts size matches container
        setTimeout(() => {
            if (filteredData.length > 0) renderCharts();
        }, 50);
    } else {
        tabDashboard.classList.add("hidden");
        tabDocuments.classList.remove("hidden");
        navDashboard.classList.remove("active");
        navDocuments.classList.add("active");
    }
}

// --- 4. Google Sheets Fetch & CSV Parsing ---

function parseCSV(csvText) {
    const lines = [];
    let currentLine = [];
    let currentVal = "";
    let insideQuote = false;

    csvText = csvText.trim();

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"') {
            if (insideQuote && nextChar === '"') {
                currentVal += '"';
                i++;
            } else {
                insideQuote = !insideQuote;
            }
        } else if (char === ',' && !insideQuote) {
            currentLine.push(currentVal.trim());
            currentVal = "";
        } else if ((char === '\r' || char === '\n') && !insideQuote) {
            currentLine.push(currentVal.trim());
            lines.push(currentLine);
            currentLine = [];
            currentVal = "";
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
        } else {
            currentVal += char;
        }
    }
    
    if (currentVal || currentLine.length > 0) {
        currentLine.push(currentVal.trim());
        lines.push(currentLine);
    }
    
    return lines;
}

let fetchTimeout = null;

function fetchData() {
    showLoading();
    hideError();
    
    // Clear any existing timeout
    if (fetchTimeout) clearTimeout(fetchTimeout);
    
    // Set a timeout of 10 seconds for fetch failure
    fetchTimeout = setTimeout(() => {
        console.error("Fetch Google Sheet data timed out");
        handleFetchError();
    }, 10000);
    
    // Remove old script tag if exists
    const oldScript = document.getElementById("sheet-jsonp-script");
    if (oldScript) {
        oldScript.remove();
    }
    
    // Create new script tag for JSONP call
    const script = document.createElement("script");
    script.id = "sheet-jsonp-script";
    script.src = `${SHEET_JSONP_URL}&t=${new Date().getTime()}`;
    script.onerror = () => {
        console.error("Error loading JSONP script");
        handleFetchError();
    };
    
    document.body.appendChild(script);
}

function handleFetchError() {
    if (fetchTimeout) clearTimeout(fetchTimeout);
    const script = document.getElementById("sheet-jsonp-script");
    if (script) script.remove();
    
    showError();
    hideLoading();
}

// Global Callback for Google Sheets JSONP Response
window.handleGoogleSheetResponse = function(response) {
    if (fetchTimeout) clearTimeout(fetchTimeout);
    
    // Remove script tag after successful load to keep DOM clean
    const script = document.getElementById("sheet-jsonp-script");
    if (script) script.remove();
    
    try {
        if (!response || response.status !== "ok" || !response.table || !response.table.rows) {
            throw new Error("Invalid response status or empty table data from Google Sheets");
        }
        
        const rows = response.table.rows;
        
        projectsData = rows.map(row => {
            const cells = row.c;
            
            const getVal = (cell, defaultValue = "") => {
                if (!cell || cell.v === null || cell.v === undefined) return defaultValue;
                return cell.v;
            };
            
            const parseNum = (val) => {
                if (val === null || val === undefined) return 0;
                if (typeof val === 'number') return val;
                const cleanVal = String(val).replace(/[^0-9.-]/g, '');
                return parseFloat(cleanVal) || 0;
            };
            
            const budget = parseNum(getVal(cells[4], 0));
            const spent = parseNum(getVal(cells[5], 0));
            const remaining = cells[6] ? parseNum(getVal(cells[6], 0)) : (budget - spent);
            const progress = parseNum(getVal(cells[7], 0));
            
            return {
                id: parseInt(getVal(cells[0], 99)) || 99,
                name: String(getVal(cells[1], "ไม่มีชื่อโครงการ")),
                manager: String(getVal(cells[2], "ไม่ระบุผู้รับผิดชอบ")),
                group: String(getVal(cells[3], "ทั่วไป")),
                budget: budget,
                spent: spent,
                remaining: remaining,
                progress: progress,
                status: String(getVal(cells[8], "ยังไม่ดำเนินการ")).trim(),
                externalDocUrl: cells[9] ? String(getVal(cells[9], "")).trim() : null
            };
        });

        projectsData.sort((a, b) => a.id - b.id);
        
        updateTimestamp();
        populateGroupDropdown();
        populateProjectDropdowns();
        applyFiltersAndRender();
        hideLoading();
        
    } catch (error) {
        console.error("Error processing Google Sheets JSON response:", error);
        showError();
        hideLoading();
    }
};

function showLoading() {
    loadingOverlay.classList.remove("hidden");
    refreshIcon.classList.add("spin");
}

function hideLoading() {
    loadingOverlay.classList.add("hidden");
    refreshIcon.classList.remove("spin");
}

function showError() {
    errorContainer.classList.remove("hidden");
    tabDashboard.classList.add("hidden");
    tabDocuments.classList.add("hidden");
}

function hideError() {
    errorContainer.classList.add("hidden");
    // Only show active tab
    if (navDashboard.classList.contains("active")) {
        tabDashboard.classList.remove("hidden");
    } else {
        tabDocuments.classList.remove("hidden");
    }
}

function updateTimestamp() {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const formattedTime = now.toLocaleTimeString('th-TH');
    lastUpdatedSpan.textContent = `อัปเดตล่าสุด: ${formattedDate} เวลา ${formattedTime} น.`;
}

// --- 5. Populating Dynamic Dropdowns ---

function populateGroupDropdown() {
    const groups = [...new Set(projectsData.map(p => p.group))].sort();
    const currentVal = filterGroup.value;
    
    filterGroup.innerHTML = '<option value="all">ทั้งหมดทุกกลุ่มงาน</option>';
    
    groups.forEach(group => {
        const option = document.createElement("option");
        option.value = group;
        option.textContent = group;
        filterGroup.appendChild(option);
    });
    
    if (groups.includes(currentVal)) {
        filterGroup.value = currentVal;
    } else {
        filterGroup.value = "all";
    }
}

function populateProjectDropdowns() {
    // 1. Dropdown in Upload Form
    const currentUploadProj = docProjectIdSelect.value;
    docProjectIdSelect.innerHTML = '<option value="" disabled selected>-- เลือกโครงการ --</option>';
    
    // 2. Dropdown in Document Table Filter
    const currentFilterProj = filterDocProject.value;
    filterDocProject.innerHTML = '<option value="all">กรองทุกโครงการ</option>';

    projectsData.forEach(p => {
        const optionText = `[รหัส ${p.id}] ${p.name}`;
        
        // Option for Form Select
        const optForm = document.createElement("option");
        optForm.value = p.id;
        optForm.textContent = optionText;
        docProjectIdSelect.appendChild(optForm);
        
        // Option for Table Filter Select
        const optFilter = document.createElement("option");
        optFilter.value = p.id;
        optFilter.textContent = optionText;
        filterDocProject.appendChild(optFilter);
    });

    if (currentUploadProj) docProjectIdSelect.value = currentUploadProj;
    if (currentFilterProj) filterDocProject.value = currentFilterProj;
}

// --- 6. KPIs & Chart.js Visualizations ---

function calculateKPIs(data) {
    const totalProjects = data.length;
    let totalBudget = 0;
    let totalSpent = 0;
    let totalProgressSum = 0;
    
    data.forEach(p => {
        totalBudget += p.budget;
        totalSpent += p.spent;
        totalProgressSum += p.progress;
    });
    
    const totalRemaining = totalBudget - totalSpent;
    const avgProgress = totalProjects > 0 ? (totalProgressSum / totalProjects) : 0;
    
    const spentPercent = totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : "0.0";
    const remainingPercent = totalBudget > 0 ? ((totalRemaining / totalBudget) * 100).toFixed(1) : "0.0";

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
    };

    kpiTotalProjects.textContent = totalProjects;
    kpiAllocatedBudget.textContent = formatCurrency(totalBudget);
    kpiSpentBudget.textContent = formatCurrency(totalSpent);
    kpiRemainingBudget.textContent = formatCurrency(totalRemaining);
    
    kpiSpentRatio.textContent = `${spentPercent}% ของงบทั้งหมด`;
    kpiRemainingRatio.textContent = `${remainingPercent}% คงเหลือ`;
    kpiAvgProgress.textContent = `${avgProgress.toFixed(1)}%`;
    kpiAvgProgressBar.style.width = `${avgProgress}%`;
    
    // Status Pills Counters (using complete unfiltered dataset)
    const counts = {
        "ยังไม่ดำเนินการ": 0,
        "อยู่ระหว่างดำเนินการ": 0,
        "ดำเนินการแล้ว": 0
    };
    
    projectsData.forEach(p => {
        if (counts[p.status] !== undefined) {
            counts[p.status]++;
        }
    });
    
    countNotStarted.textContent = counts["ยังไม่ดำเนินการ"];
    countInProgress.textContent = counts["อยู่ระหว่างดำเนินการ"];
    countCompleted.textContent = counts["ดำเนินการแล้ว"];
    countAllProjects.textContent = projectsData.length;
}

function renderCharts() {
    const statusCtx = document.getElementById("chart-status").getContext("2d");
    
    const statusCounts = {
        "ยังไม่ดำเนินการ": 0,
        "อยู่ระหว่างดำเนินการ": 0,
        "ดำเนินการแล้ว": 0
    };
    
    filteredData.forEach(p => {
        if (statusCounts[p.status] !== undefined) {
            statusCounts[p.status]++;
        }
    });

    if (statusChartInstance) {
        statusChartInstance.destroy();
    }
    
    statusChartInstance = new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                data: Object.values(statusCounts),
                backgroundColor: ['#64748b', '#1d4ed8', '#10b981'],
                borderColor: '#0a0f1d',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', font: { family: 'Sarabun', size: 11 } }
                }
            },
            cutout: '65%'
        }
    });

    // Budget Chart
    const budgetCtx = document.getElementById("chart-budget-group").getContext("2d");
    const groupMap = {};
    filteredData.forEach(p => {
        if (!groupMap[p.group]) {
            groupMap[p.group] = { budget: 0, spent: 0 };
        }
        groupMap[p.group].budget += p.budget;
        groupMap[p.group].spent += p.spent;
    });
    
    const groupLabels = Object.keys(groupMap).sort();
    const groupBudgets = groupLabels.map(label => groupMap[label].budget);
    const groupSpents = groupLabels.map(label => groupMap[label].spent);

    if (budgetChartInstance) {
        budgetChartInstance.destroy();
    }
    
    budgetChartInstance = new Chart(budgetCtx, {
        type: 'bar',
        data: {
            labels: groupLabels,
            datasets: [
                {
                    label: 'งบประมาณจัดสรร',
                    data: groupBudgets,
                    backgroundColor: '#1d4ed8',
                    borderColor: 'rgba(29, 78, 216, 0.8)',
                    borderRadius: 4
                },
                {
                    label: 'งบประมาณใช้จริง',
                    data: groupSpents,
                    backgroundColor: '#b91c1c',
                    borderColor: 'rgba(185, 28, 28, 0.8)',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#94a3b8', font: { family: 'Sarabun', size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#94a3b8', font: { family: 'Sarabun', size: 11 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#94a3b8',
                        font: { family: 'Sarabun', size: 10 },
                        callback: function(value) {
                            if (value >= 1e6) {
                                return (value / 1e6).toFixed(1) + ' ล้านบาท';
                            }
                            return new Intl.NumberFormat('th-TH').format(value);
                        }
                    }
                }
            }
        }
    });
}

// --- 7. Search & Filter Handling (Dashboard Tab) ---

function handleSearch(e) {
    currentFilters.search = e.target.value.trim().toLowerCase();
    applyFiltersAndRender();
}

function handleGroupFilter(e) {
    currentFilters.group = e.target.value;
    applyFiltersAndRender();
}

function handleStatusFilter(e) {
    currentFilters.status = e.target.value;
    updateQuickFilterPillUI(e.target.value);
    applyFiltersAndRender();
}

window.filterByQuickStatus = function(status) {
    if (status === "ทั้งหมด") {
        currentFilters.status = "all";
        filterStatus.value = "all";
    } else {
        currentFilters.status = status;
        filterStatus.value = status;
    }
    updateQuickFilterPillUI(currentFilters.status);
    applyFiltersAndRender();
};

function updateQuickFilterPillUI(status) {
    document.querySelectorAll(".status-pill").forEach(pill => {
        pill.classList.remove("active");
    });
    
    if (status === "all" || status === "ทั้งหมด") {
        pillAllFilter.classList.add("active");
    } else if (status === "ยังไม่ดำเนินการ") {
        document.querySelector(".pill-gray").classList.add("active");
    } else if (status === "อยู่ระหว่างดำเนินการ") {
        document.querySelector(".pill-blue").classList.add("active");
    } else if (status === "ดำเนินการแล้ว") {
        document.querySelector(".pill-green").classList.add("active");
    }
}

function clearAllFilters() {
    searchInput.value = "";
    filterGroup.value = "all";
    filterStatus.value = "all";
    currentFilters = {
        search: "",
        group: "all",
        status: "all"
    };
    updateQuickFilterPillUI("all");
    applyFiltersAndRender();
}

function applyFiltersAndRender() {
    filteredData = projectsData.filter(project => {
        const matchesSearch = 
            project.name.toLowerCase().includes(currentFilters.search) ||
            project.manager.toLowerCase().includes(currentFilters.search) ||
            project.group.toLowerCase().includes(currentFilters.search);
            
        const matchesGroup = currentFilters.group === "all" || project.group === currentFilters.group;
        const matchesStatus = currentFilters.status === "all" || project.status === currentFilters.status;
        
        return matchesSearch && matchesGroup && matchesStatus;
    });
    
    sortFilteredData();
    calculateKPIs(filteredData);
    renderTable();
    renderCharts();
    
    filteredCountBadge.textContent = `แสดง ${filteredData.length} จาก ${projectsData.length} โครงการ`;
}

// --- 8. Table Sorting Logic ---

function handleSort(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === "asc" ? "desc" : "asc";
    } else {
        currentSort.column = column;
        currentSort.direction = "asc";
    }
    
    tableHeaders.forEach(th => {
        const sortIcon = th.querySelector("i");
        if (th.dataset.sort === currentSort.column) {
            sortIcon.className = currentSort.direction === "asc" ? "fa-solid fa-sort-up text-gold" : "fa-solid fa-sort-down text-gold";
        } else {
            sortIcon.className = "fa-solid fa-sort";
        }
    });
    
    applyFiltersAndRender();
}

function sortFilteredData() {
    const col = currentSort.column;
    const dirMultiplier = currentSort.direction === "asc" ? 1 : -1;
    
    filteredData.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];
        
        if (typeof valA === 'string' && typeof valB === 'string') {
            return valA.localeCompare(valB, 'th') * dirMultiplier;
        }
        
        if (valA < valB) return -1 * dirMultiplier;
        if (valA > valB) return 1 * dirMultiplier;
        return 0;
    });
}

function renderTable() {
    projectsTableBody.innerHTML = "";
    
    if (filteredData.length === 0) {
        emptyState.classList.remove("hidden");
        return;
    }
    
    emptyState.classList.add("hidden");
    
    filteredData.forEach(p => {
        const tr = document.createElement("tr");
        tr.dataset.id = p.id;
        
        let statusBadgeClass = "status-notstarted";
        if (p.status === "อยู่ระหว่างดำเนินการ") statusBadgeClass = "status-pending";
        if (p.status === "ดำเนินการแล้ว") statusBadgeClass = "status-completed";
        
        const statusBadge = `<span class="status-badge ${statusBadgeClass}">${p.status}</span>`;
        
        const isFull = p.progress >= 100 ? "full" : "";
        const progressBar = `
            <div class="cell-progress-container">
                <div class="cell-progress-bg">
                    <div class="cell-progress-fill ${isFull}" style="width: ${p.progress}%"></div>
                </div>
                <span class="progress-value-cell">${p.progress.toFixed(1)}%</span>
            </div>
        `;
        
        const formatNum = (num) => new Intl.NumberFormat('th-TH').format(num);
        
        tr.innerHTML = `
            <td>${p.id}</td>
            <td class="text-bold">${p.name}</td>
            <td>${p.manager}</td>
            <td>${p.group}</td>
            <td class="text-right text-gold text-bold">฿${formatNum(p.budget)}</td>
            <td class="text-right">฿${formatNum(p.spent)}</td>
            <td class="text-right text-cyan">฿${formatNum(p.remaining)}</td>
            <td>${progressBar}</td>
            <td>${statusBadge}</td>
        `;
        
        tr.addEventListener("click", () => showProjectModal(p.id));
        projectsTableBody.appendChild(tr);
    });
}

// --- 9. Modal View & Operations ---

function showProjectModal(id) {
    const p = projectsData.find(project => project.id === id);
    if (!p) return;
    
    activeModalProjectId = id;
    
    // Fill Modal Text Fields
    modalProjectName.textContent = p.name;
    modalProjectGroup.textContent = p.group;
    modalProjectId.textContent = p.id;
    modalProjectManager.textContent = p.manager;
    modalProjectStatus.textContent = p.status;
    
    modalProjectStatus.className = "info-value text-bold";
    if (p.status === "ดำเนินการแล้ว") modalProjectStatus.classList.add("text-green");
    if (p.status === "อยู่ระหว่างดำเนินการ") modalProjectStatus.classList.add("text-cyan");
    if (p.status === "ยังไม่ดำเนินการ") modalProjectStatus.classList.add("text-secondary");

    modalProjectProgressVal.textContent = `${p.progress.toFixed(2)}%`;
    modalProjectProgressBar.style.width = `${p.progress}%`;
    
    if (p.progress >= 100) {
        modalProjectProgressBar.style.background = "linear-gradient(90deg, #10b981 0%, #34d399 100%)";
    } else {
        modalProjectProgressBar.style.background = "linear-gradient(90deg, var(--primary-blue) 0%, #60a5fa 100%)";
    }

    const formatCurrencyFull = (val) => {
        return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 2 }).format(val);
    };

    modalProjectBudget.textContent = formatCurrencyFull(p.budget);
    modalProjectSpent.textContent = formatCurrencyFull(p.spent);
    modalProjectRemaining.textContent = formatCurrencyFull(p.remaining);
    
    // Render Modal Specific Attachment files
    renderModalDocuments(id, p.externalDocUrl);
    hideModalQuickUpload();
    
    projectModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeModal() {
    projectModal.classList.add("hidden");
    document.body.style.overflow = "";
    activeModalProjectId = null;
}

// Modal Quick File Attachments logic
function renderModalDocuments(projectId, externalUrl) {
    modalProjectDocList.innerHTML = "";
    
    // Filter local IndexedDB documents for this project
    const projectDocs = uploadedDocuments.filter(d => d.projectId === projectId);
    
    if (projectDocs.length === 0 && !externalUrl) {
        modalProjectDocEmpty.classList.remove("hidden");
        return;
    }
    
    modalProjectDocEmpty.classList.add("hidden");

    // A. Render Google Sheets External Link if exists
    if (externalUrl) {
        const li = document.createElement("li");
        li.className = "modal-doc-item";
        
        li.innerHTML = `
            <div class="modal-doc-info">
                <i class="fa-solid fa-cloud-arrow-down file-icon-default"></i>
                <span class="text-bold" title="${externalUrl}">เอกสารหลักโครงการ (ลิงก์จัดเก็บภายนอก)</span>
            </div>
            <a href="${externalUrl}" target="_blank" class="btn btn-secondary btn-xs">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> เปิดลิงก์
            </a>
        `;
        modalProjectDocList.appendChild(li);
    }
    
    // B. Render Local uploaded files
    projectDocs.forEach(doc => {
        const li = document.createElement("li");
        li.className = "modal-doc-item";
        
        const fileIconClass = getFileIconClass(doc.fileName);
        
        li.innerHTML = `
            <div class="modal-doc-info">
                <i class="${fileIconClass}"></i>
                <span>${doc.docTitle}</span>
                <span class="modal-doc-category-badge">${doc.docCategory}</span>
            </div>
            <div class="doc-action-btns">
                <button class="btn btn-primary btn-xs" onclick="downloadDocument(${doc.id})" title="ดาวน์โหลด">
                    <i class="fa-solid fa-download"></i>
                </button>
                <button class="btn btn-danger btn-xs" onclick="deleteDocument(${doc.id}, true)" title="ลบ">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        modalProjectDocList.appendChild(li);
    });
}

function toggleModalQuickUpload() {
    modalQuickUploadPanel.classList.toggle("hidden");
}

function hideModalQuickUpload() {
    modalQuickUploadPanel.classList.add("hidden");
    // Clear inputs
    modalUploadTitle.value = "";
    modalUploadFile.value = "";
}

async function handleModalQuickUploadSubmit() {
    const category = modalUploadCategory.value;
    const title = modalUploadTitle.value.trim();
    const fileInput = modalUploadFile.files[0];
    
    if (!activeModalProjectId) return;
    if (!title || !fileInput) {
        alert("กรุณากรอกข้อมูลชื่อเอกสารและเลือกไฟล์แนบ");
        return;
    }

    if (fileInput.size > 15 * 1024 * 1024) {
        alert("ขนาดไฟล์ใหญ่เกินกว่า 15MB");
        return;
    }

    const docObj = {
        projectId: activeModalProjectId,
        docCategory: category,
        docTitle: title,
        fileName: fileInput.name,
        fileSize: fileInput.size,
        fileData: fileInput, // File object can be stored directly as Blob in IndexedDB
        uploadedAt: new Date().toISOString()
    };

    try {
        await saveDocToDB(docObj);
        await refreshDocList();
        
        // Re-render modal files list
        const p = projectsData.find(project => project.id === activeModalProjectId);
        renderModalDocuments(activeModalProjectId, p ? p.externalDocUrl : null);
        
        hideModalQuickUpload();
    } catch (err) {
        console.error("Failed to quick upload:", err);
        alert("การอัปโหลดไฟล์ล้มเหลว: " + err);
    }
}

// --- 10. Procurement Tab File Selection & Upload ---

function handleFileSelect() {
    const file = docFileInput.files[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
        alert("ขนาดไฟล์ใหญ่เกินขอบเขตที่กำหนด (ไม่เกิน 15MB)");
        resetFileDropZone();
        return;
    }

    // Display preview details
    previewFileName.textContent = file.name;
    previewFileSize.textContent = `(${formatBytes(file.size)})`;
    filePreviewArea.classList.remove("hidden");
    
    // Auto-fill Title Input if empty
    if (!docTitleInput.value.trim()) {
        const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        docTitleInput.value = cleanName;
    }
}

function resetFileDropZone() {
    docFileInput.value = "";
    filePreviewArea.classList.add("hidden");
    docTitleInput.value = "";
}

async function handleDocumentFormSubmit(e) {
    e.preventDefault();
    
    const projectId = parseInt(docProjectIdSelect.value);
    const category = docCategorySelect.value;
    const title = docTitleInput.value.trim();
    const file = docFileInput.files[0];

    if (!projectId || !category || !title || !file) {
        alert("กรุณากรอกข้อมูลในฟอร์มให้ครบถ้วนก่อนทำการบันทึก");
        return;
    }

    const docObj = {
        projectId: projectId,
        docCategory: category,
        docTitle: title,
        fileName: file.name,
        fileSize: file.size,
        fileData: file,
        uploadedAt: new Date().toISOString()
    };

    try {
        showLoading();
        await saveDocToDB(docObj);
        await refreshDocList();
        
        // Reset Form
        uploadDocumentForm.reset();
        resetFileDropZone();
        
        alert("อัปโหลดเอกสารจัดซื้อจัดจ้างเรียบร้อยแล้ว");
        hideLoading();
    } catch (err) {
        console.error("Form upload failed:", err);
        alert("การบันทึกเอกสารล้มเหลว: " + err);
        hideLoading();
    }
}

// --- 11. Procurement Document Table Rendering ---

async function refreshDocList() {
    try {
        uploadedDocuments = await getDocsFromDB();
        renderDocumentsTable();
    } catch (err) {
        console.error("Failed to load documents:", err);
    }
}

function handleDocSearch(e) {
    docFilters.search = e.target.value.trim().toLowerCase();
    renderDocumentsTable();
}

function handleDocProjectFilter(e) {
    docFilters.project = e.target.value;
    renderDocumentsTable();
}

function renderDocumentsTable() {
    documentsTableBody.innerHTML = "";
    
    // Sort uploaded documents by date (Newest First)
    let filteredDocs = uploadedDocuments.filter(doc => {
        const p = projectsData.find(project => project.id === doc.projectId);
        const projectName = p ? p.name : "";
        
        const matchesSearch = 
            doc.docTitle.toLowerCase().includes(docFilters.search) ||
            doc.fileName.toLowerCase().includes(docFilters.search) ||
            projectName.toLowerCase().includes(docFilters.search);
            
        const matchesProject = 
            docFilters.project === "all" || 
            doc.projectId === parseInt(docFilters.project);
            
        return matchesSearch && matchesProject;
    });

    filteredDocs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    docTotalBadge.textContent = `ทั้งหมด ${filteredDocs.length} รายการ`;

    if (filteredDocs.length === 0) {
        docEmptyState.classList.remove("hidden");
        return;
    }

    docEmptyState.classList.add("hidden");

    filteredDocs.forEach(doc => {
        const tr = document.createElement("tr");
        
        const p = projectsData.find(project => project.id === doc.projectId);
        const projectName = p ? `[รหัส ${p.id}] ${p.name}` : `รหัสโครงการ: ${doc.projectId}`;
        
        const fileIconClass = getFileIconClass(doc.fileName);
        const uploadDate = new Date(doc.uploadedAt).toLocaleDateString('th-TH', {
            year: '2-digit',
            month: 'short',
            day: 'numeric'
        });

        tr.innerHTML = `
            <td class="text-bold" title="${projectName}">${projectName}</td>
            <td><span class="modal-doc-category-badge">${doc.docCategory}</span></td>
            <td class="text-bold">${doc.docTitle}</td>
            <td>
                <div class="file-cell-wrap">
                    <i class="${fileIconClass}"></i>
                    <div class="doc-name-cell">
                        <span class="file-name-txt" title="${doc.fileName}">${doc.fileName}</span>
                        <span class="doc-sub-text">${formatBytes(doc.fileSize)}</span>
                    </div>
                </div>
            </td>
            <td>${uploadDate}</td>
            <td>
                <div class="doc-action-btns">
                    <button class="btn btn-primary btn-sm" onclick="downloadDocument(${doc.id})" title="ดาวน์โหลด">
                        <i class="fa-solid fa-download"></i> ดาวน์โหลด
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteDocument(${doc.id}, false)" title="ลบ">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </td>
        `;
        
        documentsTableBody.appendChild(tr);
    });
}

// Global action helpers for documents (attached to window for inline onclick execution)
window.downloadDocument = function(id) {
    const doc = uploadedDocuments.find(d => d.id === id);
    if (!doc) return;
    
    // Create File Blob url
    const blobUrl = URL.createObjectURL(doc.fileData);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = doc.fileName;
    
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
};

window.deleteDocument = async function(id, isFromModal = false) {
    if (!confirm("คุณแน่ใจว่าต้องการลบเอกสารจัดซื้อจัดจ้างนี้ออกจากระบบหรือไม่?")) return;
    
    try {
        await deleteDocFromDB(id);
        await refreshDocList();
        
        // If triggered inside modal, re-render the list immediately
        if (isFromModal && activeModalProjectId) {
            const p = projectsData.find(project => project.id === activeModalProjectId);
            renderModalDocuments(activeModalProjectId, p ? p.externalDocUrl : null);
        }
    } catch (err) {
        console.error("Failed to delete doc:", err);
        alert("ไม่สามารถลบเอกสารได้: " + err);
    }
};

// --- 12. Helper Utility Functions ---

function getFileIconClass(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
        return "fa-solid fa-file-pdf file-icon-pdf";
    } else if (['doc', 'docx', 'rtf'].includes(ext)) {
        return "fa-solid fa-file-word file-icon-word";
    } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
        return "fa-solid fa-file-excel file-icon-excel";
    } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
        return "fa-solid fa-file-image file-icon-default";
    } else {
        return "fa-solid fa-file-invoice file-icon-default";
    }
}

function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
