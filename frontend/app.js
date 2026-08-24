/**
 * Jubba International University - Portal Engine
 * File: frontend/app.js
 */

// const API_BASE_URL = "http://localhost:5000/api";
// const API_BASE_URL = "https://asayr-jiu.hf.space/api";
//const API_BASE_URL = "https://jiu-1-qum4.onrender.com/api";
const API_BASE_URL = "https://jiu-0v6r.onrender.com/api";
const JIU_LOGO = "https://z-cdn-media.chatglm.cn/files/28654fbc-c7d2-4fc4-97e8-acd903af6b4a.png?auth_key=1879268441-b74f70a21fb848dcbf31df2a382b6932-0-40b9ad4fb5c63b6af961916dadf5040e";

let currentAuthRole = "student";
let sessionStorageToken = localStorage.getItem("jiu_portal_token") || null;
let sessionUserRecord = JSON.parse(localStorage.getItem("jiu_portal_user")) || null;
let currentViewingStudentId = null;
let pendingDeleteId = null;
let pendingDeleteResultData = null;

// ==========================================================================
// INITIALIZATION
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
    evaluateSessionPersistenceOnMount();

    // Close sidebar on resize to desktop
    window.addEventListener("resize", () => {
        if (window.innerWidth > 991) {
            closeSidebar();
        }
    });

    // Close modals on Escape key
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeStudentFormModal();
            closeScoreFormModal();
            closeDeleteConfirmModal();
            closeSidebar();
        }
    });

    // Delete student confirm button
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

    // Delete result confirm button
    const confirmResultBtn = document.getElementById("btn-confirm-delete-result-action");
    if (confirmResultBtn) {
        confirmResultBtn.addEventListener("click", async () => {
            if (!pendingDeleteResultData) return;
            const { studentId, index } = pendingDeleteResultData;
            closeDeleteResultConfirmModal();

            try {
                toggleLoadingSpinner(true);
                const response = await fetch(`${API_BASE_URL}/results/${studentId}/${index}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${sessionStorageToken}` }
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.message || "Failed to delete grade.");

                displaySystemAlertNotification("Grade record deleted.");
                if (currentViewingStudentId) {
                    fetchStudentPersonaDataset(currentViewingStudentId);
                }

            } catch (err) {
                displaySystemAlertNotification(err.message, "error");
            } finally {
                toggleLoadingSpinner(false);
            }
        });
    }

    // Escape key handler for new modals (separate listener to avoid modifying existing code)
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closePasswordResetModal();
            closeEditResultModal();
            closeDeleteResultConfirmModal();
        }
    });
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

    // Clear fields on tab switch
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

        // Clear form
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

    // Hide all panels, deactivate all menu items
    panels.forEach(p => {
        const panel = document.getElementById(`panel-${p}`);
        const menu = document.getElementById(`menu-item-${p}`);
        if (panel) panel.classList.add("hidden");
        if (menu) menu.classList.remove("active");
    });

    // Activate selected
    const activePanel = document.getElementById(`panel-${panelName}`);
    const activeMenu = document.getElementById(`menu-item-${panelName}`);
    if (activePanel) activePanel.classList.remove("hidden");
    if (activeMenu) activeMenu.classList.add("active");

    // Back button for admin viewing student transcript
    if (btnBackAdmin) {
        if (panelName === "dashboard" && cachedRole === "admin") {
            btnBackAdmin.classList.remove("hidden");
        } else {
            btnBackAdmin.classList.add("hidden");
        }
    }

    // Load data based on panel
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

        // Update metric cards
        setTextContent("txt-gpa-semester", Number(data.semesterGPA || 0).toFixed(2));
        setTextContent("txt-gpa-cumulative", Number(data.overallGPA || 0).toFixed(2));
        setTextContent("txt-total-subjects", data.results ? data.results.length : 0);

        // Update profile fields
        setTextContent("profile-card-name", data.fullname || "---");
        setTextContent("profile-card-id", data.studentId || "---");
        setTextContent("prof-faculty", data.faculty || "---");
        setTextContent("prof-dept", data.department || "---");
        setTextContent("prof-semester", data.semester ? `Semester ${data.semester}` : "---");

        // Update print letterhead
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

        // Render results table
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

    const isAdminViewing = localStorage.getItem("jiu_portal_role") === "admin";

    results.forEach((res, index) => {
        const tr = document.createElement("tr");
        const isFailing = res.grade === "F" || res.grade === "Incomplete";
        const gradeClass = isFailing ? "badge-grade badge-grade-f" : "badge-grade";

        // Build subject cell with optional admin action buttons
        let subjectCellContent = `<strong>${escapeHtml(res.subject)}</strong>`;
        if (isAdminViewing && currentViewingStudentId) {
            subjectCellContent = `
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <strong>${escapeHtml(res.subject)}</strong>
                    <div class="result-row-actions">
                        <button type="button" class="btn-edit-result" title="Edit grade" onclick="openEditResultModal(${index})">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button type="button" class="btn-delete-result" title="Delete grade" onclick="openDeleteResultConfirmModal(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }

        tr.innerHTML = `
            <td>${subjectCellContent}</td>
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
                        <button class="btn btn-secondary btn-sm" onclick="openEditStudentModal(
                            '${student._id}',
                            '${escapeHtml(student.fullname)}',
                            '${escapeHtml(student.faculty)}',
                            '${escapeHtml(student.department)}',
                            ${student.semester}
                        )">
                            <i class="fas fa-pen"></i> <span class="btn-label">Edit</span>
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
// MODALS: STUDENT FORM (Add & Edit)
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

    // Show password field for new students
    const passNode = document.getElementById("pass-field-visibility-node");
    if (passNode) passNode.classList.remove("hidden");

    // Show student ID field for new students
    const idGroup = document.getElementById("field-student-id-group");
    if (idGroup) idGroup.classList.remove("hidden");

    // Enable student ID input
    const idInput = document.getElementById("form-student-id");
    if (idInput) idInput.disabled = false;

    document.getElementById("modal-student-form").classList.remove("hidden");
}

function openEditStudentModal(uuid, name, faculty, dept, semester) {
    document.getElementById("form-student-uuid").value = uuid;
    document.getElementById("form-student-name").value = name;
    document.getElementById("form-student-faculty").value = faculty;
    document.getElementById("form-student-dept").value = dept;
    document.getElementById("form-student-sem").value = semester;
    document.getElementById("student-modal-title").textContent = "Edit Student";

    // Hide password field when editing
    const passNode = document.getElementById("pass-field-visibility-node");
    if (passNode) passNode.classList.add("hidden");

    // Hide student ID field when editing (ID should not change)
    const idGroup = document.getElementById("field-student-id-group");
    if (idGroup) idGroup.classList.add("hidden");

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

        // Refresh both views if admin is looking at this student
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
// MODALS: DELETE CONFIRMATION (Student)
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
// MODALS: PASSWORD RESET (Admin resets student password)
// ==========================================================================

function openPasswordResetModal() {
    document.getElementById("reset-student-id").value = "";
    document.getElementById("reset-new-password").value = "";
    document.getElementById("reset-confirm-password").value = "";
    document.getElementById("modal-password-reset").classList.remove("hidden");
}

function closePasswordResetModal() {
    document.getElementById("modal-password-reset").classList.add("hidden");
}

async function handlePasswordReset(event) {
    event.preventDefault();

    const studentId = document.getElementById("reset-student-id").value.trim();
    const newPassword = document.getElementById("reset-new-password").value;
    const confirmPassword = document.getElementById("reset-confirm-password").value;

    if (!studentId) {
        displaySystemAlertNotification("Please enter the Student ID.", "error");
        return;
    }

    if (newPassword.length < 6) {
        displaySystemAlertNotification("Password must be at least 6 characters.", "error");
        return;
    }

    if (newPassword !== confirmPassword) {
        displaySystemAlertNotification("Passwords do not match.", "error");
        return;
    }

    try {
        toggleLoadingSpinner(true);
        const response = await fetch(`${API_BASE_URL}/students/reset-password`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${sessionStorageToken}`
            },
            body: JSON.stringify({ studentId: studentId, newPassword: newPassword })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to reset password.");

        displaySystemAlertNotification("Password reset successfully.");
        closePasswordResetModal();

    } catch (err) {
        displaySystemAlertNotification(err.message, "error");
    } finally {
        toggleLoadingSpinner(false);
    }
}

// ==========================================================================
// MODALS: EDIT RESULT (Admin edits individual grade)
// ==========================================================================

function openEditResultModal(resultIndex) {
    if (!currentViewingStudentId) {
        displaySystemAlertNotification("No student selected.", "error");
        return;
    }

    // Fetch fresh student data to get current result values
    fetch(`${API_BASE_URL}/students/${currentViewingStudentId}`, {
        headers: { "Authorization": `Bearer ${sessionStorageToken}` }
    })
        .then(res => res.json())
        .then(data => {
            if (!data.results || !data.results[resultIndex]) {
                displaySystemAlertNotification("Grade record not found.", "error");
                return;
            }

            const r = data.results[resultIndex];
            document.getElementById("edit-result-student-uuid").value = currentViewingStudentId;
            document.getElementById("edit-result-index").value = resultIndex;
            document.getElementById("edit-result-subject").value = r.subject;
            document.getElementById("edit-result-credits").value = r.credit;
            document.getElementById("edit-result-semester").value = r.semester;
            document.getElementById("edit-result-midterm").value = r.midterm;
            document.getElementById("edit-result-final").value = r.final || 0;
            document.getElementById("modal-edit-result").classList.remove("hidden");
        })
        .catch(err => {
            displaySystemAlertNotification(err.message, "error");
        });
}

function closeEditResultModal() {
    document.getElementById("modal-edit-result").classList.add("hidden");
}

async function handleEditResultSubmission(event) {
    event.preventDefault();

    const studentUuid = document.getElementById("edit-result-student-uuid").value;
    const resultIndex = parseInt(document.getElementById("edit-result-index").value);

    if (!studentUuid) {
        displaySystemAlertNotification("Student not specified.", "error");
        return;
    }

    const payload = {
        subject: document.getElementById("edit-result-subject").value.trim(),
        credit: parseInt(document.getElementById("edit-result-credits").value),
        semester: parseInt(document.getElementById("edit-result-semester").value),
        midterm: parseFloat(document.getElementById("edit-result-midterm").value || 0),
        final: parseFloat(document.getElementById("edit-result-final").value || 0)
    };

    if (!payload.subject) {
        displaySystemAlertNotification("Please enter a subject name.", "error");
        return;
    }

    try {
        toggleLoadingSpinner(true);
        const response = await fetch(`${API_BASE_URL}/results/${studentUuid}/${resultIndex}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${sessionStorageToken}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Failed to update grade.");

        displaySystemAlertNotification("Grade updated successfully.");
        closeEditResultModal();
        fetchStudentPersonaDataset(studentUuid);

    } catch (err) {
        displaySystemAlertNotification(err.message, "error");
    } finally {
        toggleLoadingSpinner(false);
    }
}

// ==========================================================================
// MODALS: DELETE RESULT CONFIRMATION
// ==========================================================================

function openDeleteResultConfirmModal(resultIndex) {
    if (!currentViewingStudentId) return;
    pendingDeleteResultData = {
        studentId: currentViewingStudentId,
        index: resultIndex
    };
    document.getElementById("modal-confirm-delete-result").classList.remove("hidden");
}

function closeDeleteResultConfirmModal() {
    pendingDeleteResultData = null;
    document.getElementById("modal-confirm-delete-result").classList.add("hidden");
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
