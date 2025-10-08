document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const API_BASE_URL = '';
    
    // --- DOM ELEMENT CACHING ---
    const navButtons = document.querySelectorAll('.nav-button');
    const sections = document.querySelectorAll('main > section');
    const messageContainer = document.getElementById('message-container');
    
    // Teacher Auth & Dashboard
    const teacherAuthContainer = document.querySelector('#teacher-section .auth-container');
    const showLoginTab = document.getElementById('show-login-tab');
    const teacherLoginForm = document.getElementById('teacher-login-form');
    const teacherSignupForm = document.getElementById('teacher-signup-form');
    const teacherFormView = document.getElementById('teacher-form-view');
    const attendanceForm = document.getElementById('attendance-form');
    const dateInput = document.getElementById('att-date');
    const dateDisplayInput = document.getElementById('att-date-display');
    const teacherNameInput = document.getElementById('att-teacher');
    const studentVerifyLoginForm = document.getElementById('student-verify-login-form');
    const pendingStudentsListView = document.getElementById('pending-students-list-view');
    const pendingListHeading = document.getElementById('pending-list-heading');
    const pendingStudentsContainer = document.getElementById('pending-students-container');
    const videoUploadWrapper = document.getElementById('video-upload-wrapper');
    const photosUploadWrapper = document.getElementById('photos-upload-wrapper');
    const videoInputField = document.getElementById('att-video');
    const photosInputField = document.getElementById('att-photos');
    const togglePasswordIcons = document.querySelectorAll('.toggle-password');

    // Student Section & Auth
    const studentPublicContent = document.getElementById('student-public-content');
    const studentLoginForm = document.getElementById('student-login-form');
    const studentRegForm = document.getElementById('student-reg-form');
    const studentDashboardView = document.getElementById('student-dashboard-view');
    const regStudentDiv = document.getElementById('reg-student-div');
    const regStudentRollNo = document.getElementById('reg-student-rollno');
    const studentLogoutBtn = document.getElementById('student-logout-btn');
    
    // Student Table (Public and LoggedIn)
    const viewDivA_Btn = document.getElementById('view-div-a');
    const viewDivB_Btn = document.getElementById('view-div-b');
    const studentTableContainerPublic = document.querySelector('#student-db-wrapper #student-table-container-public');
    const studentTableHeadingPublic = document.querySelector('#student-db-wrapper #student-table-heading-public');
    const studentTableContainerLoggedIn = document.querySelector('#student-dashboard-view #student-table-container-loggedin');
    const studentDashboardHeading = document.getElementById('student-dashboard-heading');
    const studentProfilePic = document.getElementById('student-profile-pic');
    
    // HOD Section
    const hodLoginView = document.getElementById('hod-login-view');
    const hodDataView = document.getElementById('hod-data-view');
    const hodLoginBtn = document.getElementById('hod-login-btn');
    const hodAccessCodeInput = document.getElementById('hod-access-code');
    const hodFilterBtn = document.getElementById('hod-filter-btn');
    const hodDownloadPdfBtn = document.getElementById('hod-download-pdf');
    const hodTableContainer = document.getElementById('hod-table-container');
    const pendingTeachersContainer = document.getElementById('pending-teachers-container');
    const teacherStatusContainer = document.getElementById('teacher-status-container');
    const removeFineForms = document.querySelectorAll('.remove-fine-form');
    let statusInterval;
    const hodStudentFilterBtn = document.getElementById('hod-student-filter-btn');
    const hodStudentTableContainer = document.getElementById('hod-student-table-container');
    const hodStudentFilterDateRange = document.getElementById('hod-student-filter-date-range');
    const customDateFilter = document.getElementById('custom-date-filter');

    // --- INITIALIZATION ---
    if (dateDisplayInput && dateInput) {
        const today = new Date();
        dateDisplayInput.value = today.toLocaleDateString('en-GB').replace(/\//g, '-');
        dateInput.value = today.toLocaleDateString('en-CA');
    }

    // --- HELPER FUNCTIONS ---
    const showMessage = (text, type = 'success') => {
        messageContainer.className = '';
        messageContainer.textContent = text;
        messageContainer.classList.add(type);
        messageContainer.style.display = 'block';
        setTimeout(() => { messageContainer.style.display = 'none'; }, 4000);
    };

    const apiFetch = async (endpoint, options = {}) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api${endpoint}`, options);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'An error occurred.');
            }
            if (response.status !== 204) { return await response.json(); }
        } catch (error) {
            showMessage(error.message, 'error');
            throw error;
        }
    };

    // --- NAVIGATION LOGIC ---
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            navButtons.forEach(btn => btn.classList.remove('active'));
            sections.forEach(sec => sec.classList.add('hidden'));
            e.target.classList.add('active');
            const sectionId = e.target.id.replace('nav-', '') + '-section';
            document.getElementById(sectionId).classList.remove('hidden');
        });
    });

    // --- PASSWORD TOGGLE LOGIC ---
    togglePasswordIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            const passwordInput = icon.previousElementSibling;
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.textContent = '🙈';
            } else {
                passwordInput.type = 'password';
                icon.textContent = '👁️';
            }
        });
    });

    // --- GENERIC TAB SWITCHING LOGIC ---
    function setupTabs(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;
        const tabs = container.querySelectorAll('.dashboard-tab, .auth-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.target;
                tabs.forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const contents = container.parentElement.querySelectorAll('.dashboard-content, .auth-container > div[id$="-view"]');
                contents.forEach(content => {
                    if (content.id === targetId) content.classList.remove('hidden');
                    else content.classList.add('hidden');
                });
            });
        });
    }
    setupTabs('#teacher-dashboard-tabs');
    setupTabs('#student-dashboard-tabs');
    setupTabs('#hod-dashboard-tabs');
    setupTabs('#teacher-section .auth-tabs');

    // --- TEACHER SECTION LOGIC ---
    if (teacherSignupForm) {
        teacherSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = { name: document.getElementById('signup-name').value, email: document.getElementById('signup-email').value, password: document.getElementById('signup-password').value };
            try {
                const result = await apiFetch('/teachers/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                if(result) { showMessage(result.message); teacherSignupForm.reset(); document.getElementById('show-login-tab').click(); }
            } catch (error) { /* Handled */ }
        });
    }

    if (teacherLoginForm) {
        teacherLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = { email: document.getElementById('teacher-email').value, password: document.getElementById('teacher-password').value };
            try {
                const result = await apiFetch('/teachers/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                if(result){
                    teacherAuthContainer.classList.add('hidden');
                    teacherFormView.classList.remove('hidden');
                    showMessage('Login successful!');
                    teacherNameInput.value = result.teacher_name;
                }
            } catch (error) { /* Handled */ }
        });
    }
    
    document.querySelectorAll('input[name="upload_method"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'video') {
                videoUploadWrapper.classList.remove('hidden');
                photosUploadWrapper.classList.add('hidden');
            } else {
                videoUploadWrapper.classList.add('hidden');
                photosUploadWrapper.classList.remove('hidden');
            }
        });
    });
    
    if (attendanceForm) {
        attendanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(attendanceForm);
            showMessage('Uploading and processing... Please wait.', 'success');
            try {
                const response = await fetch(`${API_BASE_URL}/api/attendance/upload`, {
                    method: 'POST',
                    body: formData 
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'An error occurred during processing.');
                }
                const result = await response.json();
                if(result){
                    showMessage(result.message);
                    attendanceForm.reset();
                }
            } catch (error) {
                showMessage(error.message, 'error');
            }
        });
    }

    if(studentVerifyLoginForm) {
        studentVerifyLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const accessCode = document.getElementById('division-access-code').value;
            try {
                const result = await apiFetch('/auth/division-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessCode }) });
                if (result) {
                    studentVerifyLoginForm.parentElement.classList.add('hidden');
                    pendingStudentsListView.classList.remove('hidden');
                    pendingListHeading.textContent = `Pending Students for Division ${result.division}`;
                    fetchPendingStudents(result.division);
                }
            } catch (error) {}
        });
    }

    const fetchPendingStudents = async (division) => {
        try {
            const students = await apiFetch(`/students/pending?division=${division}`);
            pendingStudentsContainer.innerHTML = '';
            if (students.length === 0) {
                pendingStudentsContainer.innerHTML = `<p>No pending verifications for Division ${division}.</p>`;
                return;
            }
            students.forEach(student => {
                const card = document.createElement('div');
                card.className = 'pending-student-card';
                card.innerHTML = `
                    <img src="/${student.photo_path}" alt="Photo of ${student.name}" class="pending-student-photo">
                    <div class="pending-student-details">
                        <strong>${student.name}</strong><br>
                        Roll No: ${student.roll_no} | Division: ${student.division}
                    </div>
                    <div class="pending-student-actions">
                        <button class="verify-btn" data-id="${student.id}">Verify</button>
                        <button class="reject-btn" data-id="${student.id}">Reject</button>
                    </div>
                `;
                pendingStudentsContainer.appendChild(card);
            });
        } catch (error) { 
            pendingStudentsContainer.innerHTML = '<p>Could not load pending students.</p>';
        }
    };

    if(pendingStudentsContainer) {
        pendingStudentsContainer.addEventListener('click', async (e) => {
            if (e.target.matches('.verify-btn, .reject-btn')) {
                const studentId = e.target.dataset.id;
                const action = e.target.classList.contains('verify-btn') ? 'verify' : 'reject';
                const division = pendingListHeading.textContent.slice(-1);
                try {
                    const result = await apiFetch(`/students/${action}/${studentId}`, { method: 'PUT' });
                    if (result) {
                        showMessage(result.message);
                        fetchPendingStudents(division);
                    }
                } catch (error) {}
            }
        });
    }

    // --- STUDENT SECTION LOGIC ---
    if (regStudentDiv) {
        regStudentDiv.addEventListener('change', () => {
            regStudentRollNo.innerHTML = '';
            regStudentRollNo.disabled = true;
            if (!regStudentDiv.value) {
                regStudentRollNo.innerHTML = '<option value="">-- Select Division First --</option>';
                return;
            }
            for (let i = 1; i <= 71; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i;
                regStudentRollNo.appendChild(option);
            }
            regStudentRollNo.disabled = false;
            regStudentRollNo.innerHTML = `<option value="">-- Select Roll Number --</option>${regStudentRollNo.innerHTML}`;
        });
    }

    if (studentRegForm) {
        studentRegForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(studentRegForm);
            try {
                const response = await fetch(`${API_BASE_URL}/api/students/register`, {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                showMessage(result.message);
                studentRegForm.reset();
                document.querySelector('#student-dashboard-tabs .dashboard-tab[data-target="student-login-wrapper"]').click();
            } catch (error) {
                showMessage(error.message, 'error');
            }
        });
    }

    if (studentLoginForm) {
        studentLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = { phone_no: document.getElementById('student-phone').value, password: document.getElementById('student-password').value };
            try {
                const result = await apiFetch('/students/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                if(result) {
                    showMessage(result.message);
                    studentPublicContent.classList.add('hidden');
                    studentDashboardView.classList.remove('hidden');
                    fetchAndDisplayStudentData(result.division, result.roll_no, result.photo_path);
                }
            } catch (error) { /* Handled */ }
        });
    }

    if (studentLogoutBtn) {
        studentLogoutBtn.addEventListener('click', () => {
            studentDashboardView.classList.add('hidden');
            studentPublicContent.classList.remove('hidden');
            document.querySelector('#student-dashboard-tabs .dashboard-tab[data-target="student-login-wrapper"]').click();
        });
    }

    const fetchAndDisplayStudentData = async (division, loggedInRollNo = null, photoPath = null) => {
        try {
            const data = await apiFetch(`/students/${division}`);
            const { students, dates } = data;
            const isPublicView = !loggedInRollNo;
            const container = isPublicView ? studentTableContainerPublic : studentTableContainerLoggedIn;
            const headingElement = isPublicView ? studentTableHeadingPublic : studentDashboardHeading;
            
            let headingText = `Displaying Data for Division ${division}`;
            if (!isPublicView && students.length > 0) {
                // Logic for Public View
            } else if (loggedInRollNo) {
                const currentUser = students.find(s => s.roll_no == loggedInRollNo && s.division == division);
                if (currentUser) {
                    headingText = `Attendance Report for ${currentUser.name}`;
                    if (studentProfilePic && photoPath) {
                        studentProfilePic.src = `/${photoPath}`;
                    }
                }
            }
            
            let tableHTML = `<table><thead><tr><th>Photo</th><th>Roll No</th><th>Student Name</th>`;
            dates.forEach(dateStr => { 
                tableHTML += `<th>${new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-GB')}</th>`; 
            });
            tableHTML += `<th>Total Fine</th></tr></thead><tbody>`;
            
            students.forEach(student => {
                let isHighlighted = student.roll_no == loggedInRollNo && student.division == division;
                if (!isPublicView && !isHighlighted) return;

                let totalAbsences = 0;
                let rowHTML = `<tr class="${isHighlighted ? 'highlighted' : ''}">
                                 <td><img src="/${student.photo_path}" alt="Photo" class="profile-pic-table"></td>
                                 <td>${student.roll_no}</td>
                                 <td>${student.name}</td>`;
                
                dates.forEach(dateStr => {
                    const status = student.attendance[dateStr];
                    if (status === 'A') {
                        rowHTML += `<td class="absent">A</td>`;
                        totalAbsences++;
                    } else if (status === 'P') {
                        rowHTML += `<td class="present">P</td>`;
                    } else {
                        rowHTML += `<td class="not-applicable">N/A</td>`;
                    }
                });

                rowHTML += `<td class="fine">₹${totalAbsences * 100}</td></tr>`;
                
                if (isPublicView) tableHTML += rowHTML;
                else if (isHighlighted) tableHTML += rowHTML;
            });

            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;
            if(headingElement) headingElement.textContent = headingText;
        } catch (error) {
            const container = loggedInRollNo ? studentTableContainerLoggedIn : studentTableContainerPublic;
            if(container) container.innerHTML = `<p>Could not load student data.</p>`;
        }
    };
    
    if(viewDivA_Btn) viewDivA_Btn.addEventListener('click', () => fetchAndDisplayStudentData('A'));
    if(viewDivB_Btn) viewDivB_Btn.addEventListener('click', () => fetchAndDisplayStudentData('B'));

    // --- HOD SECTION LOGIC ---
    const fetchAndDisplayHodData = async () => {
        const div = document.getElementById('hod-filter-div').value;
        const date = document.getElementById('hod-filter-date').value;
        let query = `?`;
        if (div && div !== 'ALL') query += `division=${div}&`;
        if (date) query += `date=${date}`;
        try {
            const records = await apiFetch(`/attendance${query}`);
            let tableHTML = `<table><thead><tr><th>Date</th><th>Time</th><th>Div</th><th>Subject</th><th>Topic</th><th>Teacher</th><th>Type</th><th>Absentees</th><th>Actions</th></tr></thead><tbody>`;
            records.forEach(rec => {
                tableHTML += `<tr><td>${new Date(rec.date + 'T12:00:00Z').toLocaleDateString('en-GB')}</td><td>${rec.time_slot}</td><td>${rec.division}</td><td>${rec.subject}</td><td>${rec.topic}</td><td>${rec.teacher_name}</td><td>${rec.type}</td><td>${rec.absent_roll_nos.join(', ')}</td><td><button class="delete-btn" data-lecture-id="${rec.id}">Delete</button></td></tr>`;
            });
            hodTableContainer.innerHTML = tableHTML;
        } catch (error) {
             hodTableContainer.innerHTML = `<p>Could not load attendance records.</p>`;
        }
    };

    if (hodLoginBtn) {
        hodLoginBtn.addEventListener('click', async () => {
            const accessCode = hodAccessCodeInput.value;
            try {
                const result = await apiFetch('/auth/hod', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessCode }) });
                if(result) {
                    hodLoginView.style.display = 'none';
                    hodDataView.classList.remove('hidden');
                    showMessage('HOD Login successful!');
                    fetchPendingTeachers();
                    fetchAndDisplayHodData();
                    fetchTeacherStatus();
                    if(statusInterval) clearInterval(statusInterval);
                    statusInterval = setInterval(fetchTeacherStatus, 15000);
                }
            } catch(error) { /* Handled */ }
        });
    }

    if (hodTableContainer) {
        hodTableContainer.addEventListener('click', async (e) => {
            if (e.target && e.target.classList.contains('delete-btn')) {
                const lectureId = e.target.dataset.lectureId;
                if (confirm('Are you sure you want to permanently delete this entire lecture record?')) {
                    try {
                        const result = await apiFetch(`/lectures/${lectureId}`, { method: 'DELETE' });
                        if(result) { showMessage(result.message); fetchAndDisplayHodData(); }
                    } catch (error) { /* Handled */ }
                }
            }
        });
    }
    
    if (hodFilterBtn) hodFilterBtn.addEventListener('click', fetchAndDisplayHodData);

    if (pendingTeachersContainer) {
        pendingTeachersContainer.addEventListener('click', async (e) => {
            if (e.target.classList.contains('verify-btn')) {
                const teacherId = e.target.dataset.teacherId;
                try {
                    const result = await apiFetch(`/teachers/verify/${teacherId}`, { method: 'PUT' });
                    if(result) { showMessage(result.message); fetchPendingTeachers(); }
                } catch (error) { /* Handled */ }
            }
        });
    }
    
    if (hodStudentFilterBtn) {
        hodStudentFilterBtn.addEventListener('click', async () => {
            const hodStudentFilterDiv = document.getElementById('hod-student-filter-div');
            const division = hodStudentFilterDiv.value;
            const range = hodStudentFilterDateRange.value;
            let startDate, endDate;
            const today = new Date();
            if (range === 'weekly') {
                endDate = new Date(today);
                startDate = new Date(today);
                startDate.setDate(today.getDate() - 6);
            } else if (range === 'monthly') {
                endDate = new Date(today);
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            } else {
                const hodStudentStartDate = document.getElementById('hod-student-start-date');
                const hodStudentEndDate = document.getElementById('hod-student-end-date');
                startDate = new Date(hodStudentStartDate.value);
                endDate = new Date(hodStudentEndDate.value);
            }
            const startDateStr = startDate.toLocaleDateString('en-CA');
            const endDateStr = endDate.toLocaleDateString('en-CA');
            hodStudentTableContainer.innerHTML = `<p>Generating report... Please wait.</p>`;
            try {
                const reportData = await apiFetch(`/hod/student-dashboard?division=${division}&startDate=${startDateStr}&endDate=${endDateStr}`);
                if (reportData) {
                    const subjects = ['DS', 'OOPCG', 'ELE DF', 'OS', 'DELD', 'UHV', 'ED', 'DSL', 'CEP'];
                    let tableHTML = `<table><thead><tr><th>Photo</th><th>Roll No</th><th>Name</th><th>Div</th>`;
                    subjects.forEach(s => tableHTML += `<th>${s} (%)</th>`);
                    tableHTML += `<th>Total Avg (%)</th></tr></thead><tbody>`;
                    reportData.forEach(student => {
                        tableHTML += `<tr>
                            <td><img src="/${student.photo_path}" alt="Photo" class="profile-pic-table"></td>
                            <td>${student.roll_no}</td>
                            <td>${student.name}</td>
                            <td>${student.division}</td>
                        `;
                        subjects.forEach(subject => {
                            const avg = student.subject_avg[subject];
                            let cellClass = '';
                            if (avg !== 'N/A' && parseFloat(avg) < 75) cellClass = 'low-attendance';
                            else if (avg !== 'N/A' && parseFloat(avg) >= 75) cellClass = 'high-attendance';
                            tableHTML += `<td class="${cellClass}">${avg}</td>`;
                        });
                        let totalAvgClass = '';
                        if(student.total_avg !== 'N/A' && parseFloat(student.total_avg) < 75) totalAvgClass = 'low-attendance';
                        else if (student.total_avg !== 'N/A' && parseFloat(student.total_avg) >= 75) totalAvgClass = 'high-attendance';
                        tableHTML += `<td class="${totalAvgClass}">${student.total_avg}</td></tr>`;
                    });
                    tableHTML += `</tbody></table>`;
                    hodStudentTableContainer.innerHTML = tableHTML;
                }
            } catch (error) {
                hodStudentTableContainer.innerHTML = `<p>Could not generate report.</p>`;
            }
        });
    }

    if (hodStudentFilterDateRange) {
        hodStudentFilterDateRange.addEventListener('change', () => {
            if (hodStudentFilterDateRange.value === 'custom') {
                customDateFilter.classList.remove('hidden');
            } else {
                customDateFilter.classList.add('hidden');
            }
        });
    }
});