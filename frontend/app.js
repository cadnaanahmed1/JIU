/**
 * Jubba International University - Portal Engine
 * File: frontend/app.js
 */

const API_BASE_URL = "https://jiu-2.onrender.com/api";
const JIU_LOGO = "https://z-cdn-media.chatglm.cn/files/28654fbc-c7d2-4fc4-97e8-acd903af6b4a.png?auth_key=1879268441-b74f70a21fb848dcbf31df2a382b6932-0-40b9ad4fb5c63b6af961916dadf5040e";

let currentAuthRole = "student";
let sessionStorageToken = localStorage.getItem("jiu_portal_token") || null;
let sessionUserRecord = JSON.parse(localStorage.getItem("jiu_portal_user")) || null;
let currentViewingStudentId = null;
let pendingDeleteId = null;

// ==========================================================================
// INITIALIZATION
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    evaluateSessionPersistenceOnMount();

    window.addEventListener("resize", () => {
        if (window.innerWidth > 991) {
            closeSidebar();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeStudentFormModal();
            closeScoreFormModal();
            closeDeleteConfirmModal();
            closeSidebar();
        }
    });

    // Wire up delete confirm button
    const confirmBtn = document.getElementById("btn-confirm-delete-action");
    if (confirmBtn) {
        confirmBtn.addEventListener("click", async () => {
            if (!pendingDeleteId) return;
            const idToDelete = pendingDeleteId;
            closeDeleteConfirmModal();

            try {
                toggleLoadingSpinner(true);
                const response = await fetch(`${API_BASE_URL}/students/${idToDelete}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${sessionStorageToken}` }
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Delete failed.");

                displaySystemAlertNotification("Student record deleted.");
                fetchAdministrativeStudentDataList();

            } catch (err) {
                displaySystemAlertNotification(err.message, "error");
            } finally {
                toggleLoadingSpinner(false);
            }
        });
    }
});

// ==========================================================================
// TOAST NOTIFICATIONS
// ==========================================================================

function displaySystemAlertNotification(message, statusType = "success") {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const el = document.createElement("div");
    el.className = `toast-msg ${statusType}`;

    const iconClass = statusType === "success" ? "fa-circle-check" : "fa-circle-exclamation";
    el.innerHTML = `<i class="fas ${iconClass}"></i><span>${message}</span>`;
    container.appendChild(el);

    setTimeout(() => {
        el.style.animation = "toastSlideIn 0.3s ease reverse forwards";
        setTimeout(() => el.remove(), 300);
    }, 4000);
}

// ==========================================================================
// LOADING SPINNER
// ==========================================================================

function toggleLoadingSpinner(visible) {
    const loader = document.getElementById("loading-overlay");
    if (!loader) return;
    if (visible) loader.classList.remove("hidden");
    else loader.classList.add("hidden");
}

// ==========================================================================
// SIDEBAR
// ==========================================================================

function toggleSidebarViewMenu() {
    const sidebar = document.getElementById("sidebar-panel");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (!sidebar) return;

    const isOpen = sidebar.classList.contains("open");
    if (isOpen) {
        closeSidebar();
    } else {
        sidebar.classList.add("open");
        if (backdrop) backdrop.classList.remove("hidden");
    }
}

function closeSidebar() {
    const sidebar = document.getElementById("sidebar-panel");
    const backdrop = document.getElementById("sidebar-backdrop");
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.add("hidden");
}

// ==========================================================================
// LOGIN
// ==========================================================================

function switchLoginTab(role) {
    currentAuthRole = role;
    const btnStudent = document.getElementById("btn-tab-student");
    const btnAdmin = document.getElementById("btn-tab-admin");
    const lblIdentity = document.getElementById("lbl-identity");
    const inputIdentity = document.getElementById("input-identity");

    if (!btnStudent || !btnAdmin) return;

    if (role === "admin") {
        btnAdmin.classList.add("active");
        btnStudent.classList.remove("active");
        if (lblIdentity) lblIdentity.textContent = "Admin Username";
        if (inputIdentity) inputIdentity.placeholder = "Enter admin username";
    } else {
        btnStudent.classList.add("active");
        btnAdmin.classList.remove("active");
        if (lblIdentity) lblIdentity.textContent = "Student ID";
        if (inputIdentity) inputIdentity.placeholder = "JIU/001/2026";
    }

    if (inputIdentity) inputIdentity.value = "";
    const passField = document.getElementById("input-secret");
    if (passField) passField.value = "";
}

async function executeAuthenticationForm(event) {
    event.preventDefault();

    const idVal = document.getElementById("input-identity").value.trim();
    const passVal = document.getElementById("input-secret").value.trim();

    if (!idVal || !passVal) {
        displaySystemAlertNotification("Please fill in all fields.", "error");
        return;
    }

    const isAdmin = currentAuthRole === "admin";
    const endpoint = isAdmin ? `${API_BASE_URL}/auth/admin-login` : `${API_BASE_URL}/auth/login`;
    const payload = isAdmin
        ? { username: idVal, password: passVal }
        : { studentId: idVal, password: passVal };

    try {
        toggleLoadingSpinner(true);
        const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Authentication failed. Check your credentials.");

        localStorage.setItem("jiu_portal_token", data.token);
        localStorage.setItem("jiu_portal_role", data.role);
        localStorage.setItem("jiu_portal_user", JSON.stringify(data.user));

        sessionStorageToken = data.token;
        sessionUserRecord = data.user;

        evaluateSessionPersistenceOnMount();
        displaySystemAlertNotification("Welcome to JIU Portal.");

        document.getElementById("input-identity").value = "";
        document.getElementById("input-secret").value = "";

    } catch (err) {
        displaySystemAlertNotification(err.message, "error");
    } finally {
        toggleLoadingSpinner(false);
    }
}

// ==========================================================================
// SESSION MANAGEMENT
// ==========================================================================

function evaluateSessionPersistenceOnMount() {
    const viewLogin = document.getElementById("view-login");
    const viewPortal = document.getElementById("view-portal");
    const globalUserDisplay = document.getElementById("global-user-display");
    const menuItemAdmin = document.getElementById("menu-item-admin");

    if (sessionStorageToken && sessionUserRecord) {
        if (viewLogin) viewLogin.classList.add("hidden");
        if (viewPortal) viewPortal.classList.remove("hidden");

        const cachedRole = localStorage.getItem("jiu_portal_role");
        const displayName = sessionUserRecord.fullname || sessionUserRecord.username || "User";

        if (globalUserDisplay) {
            globalUserDisplay.innerHTML = `<i class="fas fa-user-circle"></i> <span>${displayName}</span>`;
        }

        if (cachedRole === "admin") {
            if (menuItemAdmin) menuItemAdmin.classList.remove("hidden");
            navigateToPanel("admin");
        } else {
            if (menuItemAdmin) menuItemAdmin.classList.add("hidden");
            navigateToPanel("dashboard");
        }
    } else {
        terminateUserSession();
    }
}

function terminateUserSession() {
    localStorage.removeItem("jiu_portal_token");
    localStorage.removeItem("jiu_portal_role");
    localStorage.removeItem("jiu_portal_user");
    sessionStorageToken = null;
    sessionUserRecord = null;
    currentViewingStudentId = null;

    const viewPortal = document.getElementById("view-portal");
    const viewLogin = document.getElementById("view-login");
    if (viewPortal) viewPortal.classList.add("hidden");
    if (viewLogin) viewLogin.classList.remove("hidden");

    closeSidebar();
}

// ==========================================================================
// NAVIGATION
// ==========================================================================

function navigateToPanel(panelName) {
    const panels = ["dashboard", "profile", "admin"];
    const btnBackAdmin = document.getElementById("btn-back-to-admin");
    const cachedRole = localStorage.getItem("jiu_portal_role");

    closeSidebar();

    panels.forEach(p => {
        const panel = document.getElementById(`panel-${p}`);
        const menu = document.getElementById(`menu-item-${p}`);
        if (panel) panel.classList.add("hidden");
        if (menu) menu.classList.remove("active");
    });

    const activePanel = document.getElementById(`panel-${panelName}`);
    const activeMenu = document.getElementById(`menu-item-${panelName}`);
    if (activePanel) activePanel.classList.remove("hidden");
    if (activeMenu) activeMenu.classList.add("active");

    if (btnBackAdmin) {
        if (panelName === "dashboard" && cachedRole === "admin") {
            btnBackAdmin.classList.remove("hidden");
        } else {
            btnBackAdmin.classList.add("hidden");
        }
    }

    if (panelName === "dashboard" || panelName === "profile") {
        if (cachedRole === "student" && sessionUserRecord) {
            fetchStudentPersonaDataset(sessionUserRecord.id);
        } else if (cachedRole === "admin" && currentViewingStudentId) {
            fetchStudentPersonaDataset(currentViewingStudentId);
        }
    } else if (panelName === "admin") {
        fetchAdministrativeStudentDataList();
    }
}

// ==========================================================================
// STUDENT DATA FETCHING
// ==========================================================================

async function fetchStudentPersonaDataset(studentMongoId) {
    if (!studentMongoId) return;

    try {
        toggleLoadingSpinner(true);
        const response = await fetch(`${API_BASE_URL}/students/${studentMongoId}`, {
            headers: { "Authorization": `Bearer ${sessionStorageToken}` }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to load student data.");

        currentViewingStudentId = studentMongoId;

        setTextContent("txt-gpa-semester", Number(data.semesterGPA || 0).toFixed(2));
        setTextContent("txt-gpa-cumulative", Number(data.overallGPA || 0).toFixed(2));
        setTextContent("txt-total-subjects", data.results ? data.results.length : 0);

        setTextContent("profile-card-name", data.fullname || "---");
        setTextContent("profile-card-id", data.studentId || "---");
        setTextContent("prof-faculty", data.faculty || "---");
        setTextContent("prof-dept", data.department || "---");
        setTextContent("prof-semester", data.semester ? `Semester ${data.semester}` : "---");

        const printSummary = document.getElementById("print-student-meta-summary");
        if (printSummary) {
            printSummary.innerHTML = `
                <div><strong>Name:</strong> ${data.fullname || "---"}</div>
                <div><strong>ID:</strong> ${data.studentId || "---"}</div>
                <div><strong>Faculty:</strong> ${data.faculty || "---"}</div>
                <div><strong>Department:</strong> ${data.department || "---"}</div>
                <div><strong>Semester:</strong> ${data.semester || "---"}</div>
                <div><strong>CGPA:</strong> ${Number(data.overallGPA || 0).toFixed(2)}</div>
            `;
        }

        renderResultsTable(data.results);

    } catch (err) {
        displaySystemAlertNotification(err.message, "error");
    } finally {
        toggleLoadingSpinner(false);
    }
}

function renderResultsTable(results) {
    const tableBody = document.getElementById("table-body-results");
    const emptyState = document.getElementById("empty-results-state");
    if (!tableBody) return;

    tableBody.innerHTML = "";

    if (!results || results.length === 0) {
        tableBody.innerHTML = "";
        if (emptyState) emptyState.classList.remove("hidden");
        return;
    }

    if (emptyState) emptyState.classList.add("hidden");

    results.forEach(res => {
        const tr = document.createElement("tr");
        const isFailing = res.grade === "F" || res.grade === "Incomplete";
        const gradeClass = isFailing ? "badge-grade badge-grade-f" : "badge-grade";

        tr.innerHTML = `
            <td><strong>${escapeHtml(res.subject)}</strong></td>
            <td>S${res.semester}</td>
            <td>${res.credit}</td>
            <td>${res.midterm}</td>
            <td>${res.final || 0}</td>
            <td><strong>${res.total}</strong></td>
            <td><span class="${gradeClass}">${res.grade}</span></td>
        `;
        tableBody.appendChild(tr);
    });
}

// ==========================================================================
// ADMIN: STUDENT LIST
// ==========================================================================

async function fetchAdministrativeStudentDataList() {
    const searchField = document.getElementById("admin-search-field");
    const searchString = searchField ? searchField.value.trim() : "";
    const queryUrl = `${API_BASE_URL}/students?search=${encodeURIComponent(searchString)}`;

    try {
        const response = await fetch(queryUrl, {
            headers: { "Authorization": `Bearer ${sessionStorageToken}` }
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to load student list.");

        setTextContent("admin-total-students", data.length);

        const tableBody = document.getElementById("table-body-admin-students");
        const emptyState = document.getElementById("empty-admin-state");
        if (!tableBody) return;

        tableBody.innerHTML = "";

        if (data.length === 0) {
            if (emptyState) emptyState.classList.remove("hidden");
            return;
        }

        if (emptyState) emptyState.classList.add("hidden");

        data.forEach(student => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><code>${escapeHtml(student.studentId)}</code></td>
                <td><strong>${escapeHtml(student.fullname)}</strong></td>
                <td>${escapeHtml(student.faculty)} — ${escapeHtml(student.department)}</td>
                <td>S${student.semester}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-success btn-sm" onclick="viewSingleStudentTranscript('${student._id}')">
                            <i class="fas fa-eye"></i> <span class="btn-label">View</span>
                        </button>
                        <button class="btn btn-primary btn-sm" onclick="openScoreFormModal('${student._id}')">
                            <i class="fas fa-plus"></i> <span class="btn-label">Grade</span>
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="openDeleteConfirmModal('${student._id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

    } catch (err) {
        displaySystemAlertNotification(err.message, "error");
    }
}

function viewSingleStudentTranscript(studentMongoId) {
    currentViewingStudentId = studentMongoId;
    navigateToPanel("dashboard");
}

// ==========================================================================
// MODALS: STUDENT FORM
// ==========================================================================

function openStudentCreationModal() {
    document.getElementById("form-student-uuid").value = "";
    document.getElementById("form-student-name").value = "";
    document.getElementById("form-student-id").value = "";
    document.getElementById("form-student-faculty").value = "Faculty of IT";
    document.getElementById("form-student-dept").value = "Computer Science";
    document.getElementById("form-student-sem").value = "1";
    document.getElementById("form-student-pass").value = "";
    document.getElementById("student-modal-title").textContent = "Add New Student";

    const passNode = document.getElementById("pass-field-visibility-node");
    if (passNode) passNode.classList.remove("hidden");

    document.getElementById("modal-student-form").classList.remove("hidden");
}

function closeStudentFormModal() {
    document.getElementById("modal-student-form").classList.add("hidden");
}

async function handleStudentFormSubmission(event) {
    event.preventDefault();

    const uuid = document.getElementById("form-student-uuid").value;
    const payload = {
        fullname: document.getElementById("form-student-name").value.trim(),
        studentId: document.getElementById("form-student-id").value.trim(),
        faculty: document.getElementById("form-student-faculty").value.trim(),
        department: document.getElementById("form-student-dept").value.trim(),
        semester: parseInt(document.getElementById("form-student-sem").value)
    };

    if (!uuid) {
        payload.password = document.getElementById("form-student-pass").value.trim() || "jiu12345";
    }

    const url = uuid ? `${API_BASE_URL}/students/${uuid}` : `${API_BASE_URL}/students`;
    const method = uuid ? "PUT" : "POST";

    try {
        toggleLoadingSpinner(true);
        const response = await fetch(url, {
            method: method,
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${sessionStorageToken}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to save student data.");

        displaySystemAlertNotification(uuid ? "Student updated successfully." : "Student added successfully.");
        closeStudentFormModal();
        fetchAdministrativeStudentDataList();

    } catch (err) {
        displaySystemAlertNotification(err.message, "error");
    } finally {
        toggleLoadingSpinner(false);
    }
}

// ==========================================================================
// MODALS: SCORE FORM
// ==========================================================================

function openScoreFormModal(studentUuid) {
    document.getElementById("form-score-target-student-uuid").value = studentUuid;
    document.getElementById("form-score-subject").value = "";
    document.getElementById("form-score-credits").value = "3";
    document.getElementById("form-score-semester").value = "1";
    document.getElementById("form-score-midterm").value = "0";
    document.getElementById("form-score-final").value = "0";
    document.getElementById("modal-score-form").classList.remove("hidden");
}

function closeScoreFormModal() {
    document.getElementById("modal-score-form").classList.add("hidden");
}

async function handleScoreFormSubmission(event) {
    event.preventDefault();

    const targetUuid = document.getElementById("form-score-target-student-uuid").value;
    if (!targetUuid) {
        displaySystemAlertNotification("Target student not specified.", "error");
        return;
    }

    const payload = {
        studentObjId: targetUuid,
        subject: document.getElementById("form-score-subject").value.trim(),
        credit: parseInt(document.getElementById("form-score-credits").value),
        semester: parseInt(document.getElementById("form-score-semester").value),
        midterm: parseFloat(document.getElementById("form-score-midterm").value || 0),
        final: parseFloat(document.getElementById("form-score-final").value || 0)
    };

    if (!payload.subject) {
        displaySystemAlertNotification("Please enter a subject name.", "error");
        return;
    }

    try {
        toggleLoadingSpinner(true);
        const response = await fetch(`${API_BASE_URL}/results/add`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${sessionStorageToken}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to save grade data.");

        displaySystemAlertNotification("Grade saved successfully.");
        closeScoreFormModal();

        currentViewingStudentId = targetUuid;
        if (sessionUserRecord && sessionUserRecord.id === targetUuid) {
            fetchStudentPersonaDataset(targetUuid);
        }
        fetchAdministrativeStudentDataList();

    } catch (err) {
        displaySystemAlertNotification(err.message, "error");
    } finally {
        toggleLoadingSpinner(false);
    }
}

// ==========================================================================
// MODALS: DELETE CONFIRMATION
// ==========================================================================

function openDeleteConfirmModal(studentId) {
    pendingDeleteId = studentId;
    document.getElementById("modal-confirm-delete").classList.remove("hidden");
}

function closeDeleteConfirmModal() {
    pendingDeleteId = null;
    document.getElementById("modal-confirm-delete").classList.add("hidden");
}

// ==========================================================================
// PRINT
// ==========================================================================

function printTargetedTranscript() {
    window.print();
}

// ==========================================================================
// HELPERS
// ==========================================================================

function setTextContent(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = value;
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
