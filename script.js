document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const API_BASE_URL = ''; // Keep empty for relative paths

    // --- DOM ELEMENT CACHING ---
    const navButtons = document.querySelectorAll('.nav-button');
    const sections = document.querySelectorAll('main > section');
    const messageContainer = document.getElementById('message-container');
    const togglePasswordIcons = document.querySelectorAll('.toggle-password');

    // --- HELPER FUNCTIONS ---
    /**
     * Displays a message to the user in a toast notification.
     * @param {string} text The message to display.
     * @param {string} type The type of message ('success' or 'error').
     */
    const showMessage = (text, type = 'success') => {
        messageContainer.textContent = text;
        messageContainer.className = `message ${type}`;
        messageContainer.style.display = 'block';
        setTimeout(() => {
            messageContainer.style.display = 'none';
        }, 4000);
    };

    /**
     * A wrapper for the fetch API to handle API requests and errors.
     * @param {string} endpoint The API endpoint to call (e.g., '/users').
     * @param {object} options The options for the fetch request.
     * @returns {Promise<object>} The JSON response from the server.
     */
    const apiFetch = async (endpoint, options = {}) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api${endpoint}`, options);
            if (!response.ok) {
                // Try to parse the error message from the server
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    throw new Error('An error occurred on the server.');
                }
                throw new Error(errorData.message || 'An unknown error occurred.');
            }
            if (response.status !== 204) { // 204 No Content has no body
                return await response.json();
            }
        } catch (error) {
            showMessage(error.message, 'error');
            throw error;
        }
    };

    // --- INITIALIZATION ---
    // Set the default date for the attendance form
    const dateInput = document.getElementById('att-date');
    const dateDisplayInput = document.getElementById('att-date-display');
    if (dateDisplayInput && dateInput) {
        const today = new Date();
        dateDisplayInput.value = today.toLocaleDateString('en-GB').replace(/\//g, '-');
        dateInput.value = today.toLocaleDateString('en-CA'); // Format YYYY-MM-DD
    }

    // --- GENERIC UI LOGIC ---

    // Main navigation between Teacher, Student, and HOD sections
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            navButtons.forEach(btn => btn.classList.remove('active'));
            sections.forEach(sec => sec.classList.add('hidden'));
            e.target.classList.add('active');
            const sectionId = e.target.id.replace('nav-', '') + '-section';
            document.getElementById(sectionId).classList.remove('hidden');
        });
    });

    // Password visibility toggle
    togglePasswordIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            const passwordInput = icon.previousElementSibling;
            passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
            icon.textContent = passwordInput.type === 'password' ? '👁️' : '🙈';
        });
    });

    // Reusable function for tabbed interfaces
    function setupTabs(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;
        const tabs = container.querySelectorAll('.dashboard-tab, .auth-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const targetId = e.currentTarget.dataset.target;
                tabs.forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const contents = container.parentElement.querySelectorAll('.dashboard-content, .auth-container > div[id$="-view"], .auth-container > .dashboard-content');
                contents.forEach(content => {
                    content.id === targetId ? content.classList.remove('hidden') : content.classList.add('hidden');
                });
            });
        });
    }
    setupTabs('#teacher-dashboard-tabs');
    setupTabs('#student-dashboard-tabs');
    setupTabs('#hod-dashboard-tabs');
    setupTabs('#teacher-section .auth-tabs');

    // --- TEACHER SECTION ---
    const teacherAuthContainer = document.querySelector('#teacher-section .auth-container');
    const teacherFormView = document.getElementById('teacher-form-view');
    const teacherNameInput = document.getElementById('att-teacher');

    // Teacher Signup
    const teacherSignupForm = document.getElementById('teacher-signup-form');
    if (teacherSignupForm) {
        teacherSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                name: document.getElementById('signup-name').value,
                email: document.getElementById('signup-email').value,
                password: document.getElementById('signup-password').value
            };
            try {
                const result = await apiFetch('/teachers/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (result) {
                    showMessage(result.message);
                    teacherSignupForm.reset();
                    document.getElementById('show-login-tab').click();
                }
            } catch (error) { /* Handled in apiFetch */ }
        });
    }

    // Teacher Login
    const teacherLoginForm = document.getElementById('teacher-login-form');
    if (teacherLoginForm) {
        teacherLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                email: document.getElementById('teacher-email').value,
                password: document.getElementById('teacher-password').value
            };
            try {
                const result = await apiFetch('/teachers/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (result) {
                    teacherAuthContainer.classList.add('hidden');
                    teacherFormView.classList.remove('hidden');
                    showMessage('Login successful!');
                    teacherNameInput.value = result.teacher_name;
                }
            } catch (error) { /* Handled in apiFetch */ }
        });
    }

    // Attendance form: Toggle between video and photo upload
    const videoUploadWrapper = document.getElementById('video-upload-wrapper');
    const photosUploadWrapper = document.getElementById('photos-upload-wrapper');
    const videoInputField = document.getElementById('att-video');
    const photosInputField = document.getElementById('att-photos');
    document.querySelectorAll('input[name="upload_method"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'video') {
                videoUploadWrapper.classList.remove('hidden');
                videoInputField.disabled = false;
                photosUploadWrapper.classList.add('hidden');
                photosInputField.disabled = true;
            } else {
                videoUploadWrapper.classList.add('hidden');
                videoInputField.disabled = true;
                photosUploadWrapper.classList.remove('hidden');
                photosInputField.disabled = false;
            }
        });
    });

    // Attendance form: Submission
    const attendanceForm = document.getElementById('attendance-form');
    if (attendanceForm) {
        attendanceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(attendanceForm);
            showMessage('Uploading and processing... Please wait.', 'success');
            try {
                // We use fetch directly here because apiFetch is for JSON, not FormData
                const response = await fetch(`${API_BASE_URL}/api/attendance/upload`, {
                    method: 'POST',
                    body: formData
                });
                const result = await response.json();
                if (!response.ok) {
                    throw new Error(result.message || 'An error occurred during processing.');
                }
                if (result) {
                    showMessage(result.message);
                    attendanceForm.reset();
                    // Reset date fields after submission
                    const today = new Date();
                    dateDisplayInput.value = today.toLocaleDateString('en-GB').replace(/\//g, '-');
                    dateInput.value = today.toLocaleDateString('en-CA');
                }
            } catch (error) {
                showMessage(error.message, 'error');
            }
        });
    }

    // Teacher Dashboard: Student Verification
    const studentVerifyLoginForm = document.getElementById('student-verify-login-form');
    const pendingStudentsListView = document.getElementById('pending-students-list-view');
    const pendingListHeading = document.getElementById('pending-list-heading');
    const pendingStudentsContainer = document.getElementById('pending-students-container');

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
                    </div>`;
                pendingStudentsContainer.appendChild(card);
            });
        } catch (error) {
            pendingStudentsContainer.innerHTML = '<p>Could not load pending students.</p>';
        }
    };

    if (studentVerifyLoginForm) {
        studentVerifyLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const accessCode = document.getElementById('division-access-code').value;
            try {
                const result = await apiFetch('/auth/division-access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accessCode })
                });
                if (result) {
                    studentVerifyLoginForm.parentElement.classList.add('hidden');
                    pendingStudentsListView.classList.remove('hidden');
                    pendingListHeading.textContent = `Pending Students for Division ${result.division}`;
                    fetchPendingStudents(result.division);
                }
            } catch (error) { /* Handled */ }
        });
    }

    if (pendingStudentsContainer) {
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
                } catch (error) { /* Handled */ }
            }
        });
    }

    // --- STUDENT SECTION ---
    const studentPublicContent = document.getElementById('student-public-content');
    const studentDashboardView = document.getElementById('student-dashboard-view');

    // Student Registration: Populate Roll Numbers
    const regStudentDiv = document.getElementById('reg-student-div');
    const regStudentRollNo = document.getElementById('reg-student-rollno');
    if (regStudentDiv) {
        regStudentDiv.addEventListener('change', () => {
            regStudentRollNo.innerHTML = '<option value="">-- Select Roll Number --</option>';
            if (!regStudentDiv.value) {
                regStudentRollNo.disabled = true;
                return;
            }
            for (let i = 1; i <= 71; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = i;
                regStudentRollNo.appendChild(option);
            }
            regStudentRollNo.disabled = false;
        });
    }

    // Student Registration: Form Submission
    const studentRegForm = document.getElementById('student-reg-form');
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

    // Student Login
    const studentLoginForm = document.getElementById('student-login-form');
    if (studentLoginForm) {
        studentLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                phone_no: document.getElementById('student-phone').value,
                password: document.getElementById('student-password').value
            };
            try {
                const result = await apiFetch('/students/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (result) {
                    showMessage(result.message);
                    studentPublicContent.classList.add('hidden');
                    studentDashboardView.classList.remove('hidden');
                    fetchAndDisplayStudentData(result.division, result.roll_no, result.photo_path);
                }
            } catch (error) { /* Handled */ }
        });
    }

    // Student Logout
    const studentLogoutBtn = document.getElementById('student-logout-btn');
    if (studentLogoutBtn) {
        studentLogoutBtn.addEventListener('click', () => {
            studentDashboardView.classList.add('hidden');
            studentPublicContent.classList.remove('hidden');
            // Reset to the login tab in the public view
            document.querySelector('#student-dashboard-tabs .dashboard-tab[data-target="student-login-wrapper"]').click();
        });
    }

    // Function to fetch and render student attendance tables
    const fetchAndDisplayStudentData = async (division, loggedInRollNo = null, photoPath = null) => {
        const isPublicView = !loggedInRollNo;
        const container = isPublicView ? document.querySelector('#student-db-wrapper #student-table-container-public') : document.querySelector('#student-dashboard-view #student-table-container-loggedin');
        const headingElement = isPublicView ? document.querySelector('#student-db-wrapper #student-table-heading-public') : document.getElementById('student-dashboard-heading');
        const studentProfilePic = document.getElementById('student-profile-pic');
        
        if (!container) return;
        container.innerHTML = `<p>Loading data for Division ${division}...</p>`;

        try {
            const data = await apiFetch(`/students/${division}`);
            const { students, dates } = data;
            
            let headingText = `Displaying Data for Division ${division}`;
            if (loggedInRollNo) {
                const currentUser = students.find(s => s.roll_no == loggedInRollNo && s.division == division);
                if (currentUser) {
                    headingText = `Attendance Report for ${currentUser.name}`;
                    if (studentProfilePic && photoPath) {
                        studentProfilePic.src = `/${photoPath}`;
                    }
                }
            }
            if (headingElement) headingElement.textContent = headingText;

            let tableHTML = `<table><thead><tr><th>Photo</th><th>Roll No</th><th>Name</th>`;
            dates.forEach(dateStr => {
                tableHTML += `<th>${new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-GB')}</th>`;
            });
            tableHTML += `<th>Total Fine</th></tr></thead><tbody>`;

            students.forEach(student => {
                const isHighlighted = student.roll_no == loggedInRollNo && student.division == division;
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
                tableHTML += rowHTML;
            });

            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;

        } catch (error) {
            container.innerHTML = `<p>Could not load student data for Division ${division}.</p>`;
        }
    };

    const viewDivA_Btn = document.getElementById('view-div-a');
    const viewDivB_Btn = document.getElementById('view-div-b');
    if (viewDivA_Btn) viewDivA_Btn.addEventListener('click', () => fetchAndDisplayStudentData('A'));
    if (viewDivB_Btn) viewDivB_Btn.addEventListener('click', () => fetchAndDisplayStudentData('B'));

    // --- HOD SECTION ---
    const hodLoginView = document.getElementById('hod-login-view');
    const hodDataView = document.getElementById('hod-data-view');
    const hodLoginBtn = document.getElementById('hod-login-btn');
    const hodTableContainer = document.getElementById('hod-table-container');
    const pendingTeachersContainer = document.getElementById('pending-teachers-container');
    const teacherStatusContainer = document.getElementById('teacher-status-container');
    let statusInterval;

    // **** NEWLY ADDED FUNCTIONS FOR HOD DASHBOARD ****
    const fetchPendingTeachers = async () => {
        try {
            const teachers = await apiFetch('/teachers/pending');
            pendingTeachersContainer.innerHTML = '';
            if (!teachers || teachers.length === 0) {
                pendingTeachersContainer.innerHTML = '<li>No pending verifications.</li>';
                return;
            }
            let content = '<ul>';
            teachers.forEach(teacher => {
                content += `<li>
                    <span>${teacher.name} (${teacher.email})</span>
                    <button class="verify-btn" data-teacher-id="${teacher.id}">Verify</button>
                </li>`;
            });
            content += '</ul>';
            pendingTeachersContainer.innerHTML = content;
        } catch (error) {
            pendingTeachersContainer.innerHTML = '<li>Could not load pending teachers.</li>';
        }
    };

    const fetchTeacherStatus = async () => {
        try {
            const statuses = await apiFetch('/teachers/status');
            teacherStatusContainer.innerHTML = '';
            if (!statuses || statuses.length === 0) {
                teacherStatusContainer.innerHTML = '<li>No verified teachers found.</li>';
                return;
            }
            let content = '<ul>';
            statuses.forEach(status => {
                content += `<li>
                    <span class="status-dot ${status.isactive ? 'active' : 'inactive'}"></span>
                    <span>${status.name}</span>
                </li>`;
            });
            content += '</ul>';
            teacherStatusContainer.innerHTML = content;
        } catch (error) {
            teacherStatusContainer.innerHTML = '<li>Could not load teacher statuses.</li>';
        }
    };
    // **** END OF NEWLY ADDED FUNCTIONS ****

    const fetchAndDisplayHodData = async () => {
        const div = document.getElementById('hod-filter-div').value;
        const date = document.getElementById('hod-filter-date').value;
        let query = `?`;
        if (div && div !== 'ALL') query += `division=${div}&`;
        if (date) query += `date=${date}`;

        hodTableContainer.innerHTML = "<p>Loading attendance records...</p>";
        try {
            const records = await apiFetch(`/attendance${query}`);
            if (!records || records.length === 0) {
                hodTableContainer.innerHTML = "<p>No attendance records found for the selected filters.</p>";
                return;
            }
            let tableHTML = `<table><thead><tr><th>Date</th><th>Time</th><th>Div</th><th>Subject</th><th>Topic</th><th>Teacher</th><th>Type</th><th>Absentees</th><th>Actions</th></tr></thead><tbody>`;
            records.forEach(rec => {
                tableHTML += `<tr>
                    <td>${new Date(rec.date + 'T12:00:00Z').toLocaleDateString('en-GB')}</td>
                    <td>${rec.time_slot}</td>
                    <td>${rec.division}</td>
                    <td>${rec.subject}</td>
                    <td>${rec.topic}</td>
                    <td>${rec.teacher_name}</td>
                    <td>${rec.type}</td>
                    <td>${rec.absent_roll_nos.join(', ')}</td>
                    <td><button class="delete-btn" data-lecture-id="${rec.id}">Delete</button></td>
                </tr>`;
            });
            tableHTML += '</tbody></table>';
            hodTableContainer.innerHTML = tableHTML;
        } catch (error) {
            hodTableContainer.innerHTML = `<p>Could not load attendance records.</p>`;
        }
    };

    if (hodLoginBtn) {
        hodLoginBtn.addEventListener('click', async () => {
            const accessCode = document.getElementById('hod-access-code').value;
            try {
                const result = await apiFetch('/auth/hod', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accessCode })
                });
                if (result) {
                    hodLoginView.style.display = 'none';
                    hodDataView.classList.remove('hidden');
                    showMessage('HOD Login successful!');
                    // These will now be called correctly
                    fetchPendingTeachers();
                    fetchAndDisplayHodData();
                    fetchTeacherStatus();
                    if (statusInterval) clearInterval(statusInterval);
                    statusInterval = setInterval(fetchTeacherStatus, 15000); // Refresh status every 15s
                }
            } catch (error) { /* Handled */ }
        });
    }

    if (hodTableContainer) {
        hodTableContainer.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-btn')) {
                const lectureId = e.target.dataset.lectureId;
                if (confirm('Are you sure you want to permanently delete this entire lecture record?')) {
                    try {
                        const result = await apiFetch(`/lectures/${lectureId}`, { method: 'DELETE' });
                        if (result) {
                            showMessage(result.message);
                            fetchAndDisplayHodData();
                        }
                    } catch (error) { /* Handled */ }
                }
            }
        });
    }

    const hodFilterBtn = document.getElementById('hod-filter-btn');
    if (hodFilterBtn) hodFilterBtn.addEventListener('click', fetchAndDisplayHodData);

    if (pendingTeachersContainer) {
        pendingTeachersContainer.addEventListener('click', async (e) => {
            if (e.target.classList.contains('verify-btn')) {
                const teacherId = e.target.dataset.teacherId;
                try {
                    const result = await apiFetch(`/teachers/verify/${teacherId}`, { method: 'PUT' });
                    if (result) {
                        showMessage(result.message);
                        fetchPendingTeachers(); // Refresh list after verifying
                        fetchTeacherStatus(); // Refresh status list
                    }
                } catch (error) { /* Handled */ }
            }
        });
    }

    // **** NEWLY ADDED LOGIC for "Remove Fine" Forms ****
    document.querySelectorAll('.remove-fine-form').forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                date: form.querySelector('.fine-date').value,
                time_slot: form.querySelector('.fine-time').value,
                roll_no: form.querySelector('.fine-rollno').value,
                division: form.querySelector('.fine-div').value
            };

            if (!data.date || !data.time_slot || !data.roll_no || !data.division) {
                showMessage('Please fill out all fields.', 'error');
                return;
            }

            try {
                const result = await apiFetch('/attendance/remove', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                if (result) {
                    showMessage(result.message);
                    form.reset();
                }
            } catch (error) { /* Handled */ }
        });
    });

    // Student Dashboard for HOD
    const hodStudentFilterBtn = document.getElementById('hod-student-filter-btn');
    const hodStudentTableContainer = document.getElementById('hod-student-table-container');
    const hodStudentFilterDateRange = document.getElementById('hod-student-filter-date-range');
    const customDateFilter = document.getElementById('custom-date-filter');

    if (hodStudentFilterBtn) {
        hodStudentFilterBtn.addEventListener('click', async () => {
            const division = document.getElementById('hod-student-filter-div').value;
            const range = hodStudentFilterDateRange.value;
            let startDate, endDate;
            const today = new Date();

            if (range === 'weekly') {
                endDate = new Date(today);
                startDate = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
            } else if (range === 'monthly') {
                endDate = new Date(today);
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            } else {
                startDate = new Date(document.getElementById('hod-student-start-date').value);
                endDate = new Date(document.getElementById('hod-student-end-date').value);
            }

            if (isNaN(startDate) || isNaN(endDate)) {
                showMessage('Please select valid dates for the custom range.', 'error');
                return;
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
                            <td>${student.division}</td>`;
                        subjects.forEach(subject => {
                            const avg = student.subject_avg[subject];
                            let cellClass = '';
                            if (avg !== 'N/A' && parseFloat(avg) < 75) cellClass = 'low-attendance';
                            else if (avg !== 'N/A' && parseFloat(avg) >= 75) cellClass = 'high-attendance';
                            tableHTML += `<td class="${cellClass}">${avg}</td>`;
                        });
                        let totalAvgClass = '';
                        if (student.total_avg !== 'N/A' && parseFloat(student.total_avg) < 75) totalAvgClass = 'low-attendance';
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
            customDateFilter.classList.toggle('hidden', hodStudentFilterDateRange.value !== 'custom');
        });
    }
});