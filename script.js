document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const API_BASE_URL = '';
    
    // --- DOM ELEMENT CACHING ---
    const navButtons = document.querySelectorAll('.nav-button');
    const sections = document.querySelectorAll('main > section');
    const messageContainer = document.getElementById('message-container');
    
    // Teacher Auth & Dashboard
    const authContainer = document.querySelector('#teacher-section .auth-container');
    const showLoginTab = document.getElementById('show-login-tab');
    const showSignupTab = document.getElementById('show-signup-tab');
    const teacherLoginView = document.getElementById('teacher-login-view');
    const teacherSignupView = document.getElementById('teacher-signup-view');
    const teacherLoginForm = document.getElementById('teacher-login-form');
    const teacherSignupForm = document.getElementById('teacher-signup-form');
    const teacherFormView = document.getElementById('teacher-form-view');
    const attendanceForm = document.getElementById('attendance-form');
    const dateInput = document.getElementById('att-date');
    const dateDisplayInput = document.getElementById('att-date-display');
    const typeSelect = document.getElementById('att-type');
    const timeSelect = document.getElementById('att-time');
    const gridContainer = document.getElementById('roll-number-grid');
    const teacherNameInput = document.getElementById('att-teacher');

    // Student Auth & Dashboard
    const studentAuthContainer = document.querySelector('#student-section .auth-container');
    const showStudentLoginTab = document.getElementById('show-student-login-tab');
    const showStudentRegTab = document.getElementById('show-student-reg-tab');
    const studentLoginView = document.getElementById('student-login-view');
    const studentRegView = document.getElementById('student-reg-view');
    const studentLoginForm = document.getElementById('student-login-form');
    const studentRegForm = document.getElementById('student-reg-form');
    const studentDashboardView = document.getElementById('student-dashboard-view');
    const regStudentDiv = document.getElementById('reg-student-div');
    const regStudentRollNo = document.getElementById('reg-student-rollno');
    
    // Student View (Table)
    const viewDivA_Btn = document.getElementById('view-div-a');
    const viewDivB_Btn = document.getElementById('view-div-b');
    const studentTableContainer = document.getElementById('student-table-container');
    const studentTableHeading = document.getElementById('student-table-heading');
    
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

    // --- INITIALIZATION ---
    if (dateDisplayInput && dateInput) {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        dateDisplayInput.value = `${day}-${month}-${year}`;
        dateInput.value = today.toLocaleDateString('en-CA');
    }

    // --- HELPER FUNCTIONS ---
    const showMessage = (text, type = 'success') => {
        messageContainer.textContent = text;
        messageContainer.className = type;
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
            console.error('API Fetch Error:', error);
            throw error;
        }
    };

    // --- NAVIGATION LOGIC ---
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            navButtons.forEach(btn => btn.classList.remove('active'));
            sections.forEach(sec => sec.classList.add('hidden'));
            button.classList.add('active');
            const sectionId = button.id.replace('nav-', '') + '-section';
            document.getElementById(sectionId).classList.remove('hidden');
        });
    });

    // --- TEACHER SECTION LOGIC ---
    showLoginTab.addEventListener('click', () => {
        teacherSignupView.classList.add('hidden');
        teacherLoginView.classList.remove('hidden');
        showSignupTab.classList.remove('active');
        showLoginTab.classList.add('active');
    });

    showSignupTab.addEventListener('click', () => {
        teacherLoginView.classList.add('hidden');
        teacherSignupView.classList.remove('hidden');
        showLoginTab.classList.remove('active');
        showSignupTab.classList.add('active');
    });

    teacherSignupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = { name: document.getElementById('signup-name').value, email: document.getElementById('signup-email').value, password: document.getElementById('signup-password').value };
        try {
            const result = await apiFetch('/teachers/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            showMessage(result.message);
            teacherSignupForm.reset();
            showLoginTab.click();
        } catch (error) { /* Handled */ }
    });

    teacherLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = { email: document.getElementById('teacher-email').value, password: document.getElementById('teacher-password').value };
        try {
            const result = await apiFetch('/teachers/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            authContainer.classList.add('hidden');
            teacherFormView.classList.remove('hidden');
            showMessage('Login successful!');
            teacherNameInput.value = result.teacher_name; // Auto-fill teacher name
            generateRollNumberGrid();
        } catch (error) { /* Handled */ }
    });
    
    function generateRollNumberGrid(totalRollNumbers = 71) {
        if (!gridContainer) return;
        gridContainer.innerHTML = '';
        for (let i = 1; i <= totalRollNumbers; i++) {
            const rollItem = document.createElement('div');
            rollItem.classList.add('roll-number-item');
            rollItem.textContent = i;
            rollItem.dataset.rollNo = i;
            gridContainer.appendChild(rollItem);
        }
    }

    if (gridContainer) {
        gridContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('roll-number-item')) {
                e.target.classList.toggle('absent');
            }
        });
    }

    if(typeSelect){
        typeSelect.addEventListener('change', () => {
            if (typeSelect.value === 'Practical') {
                timeSelect.value = '11.30am to 1.20pm';
                timeSelect.disabled = true;
            } else { timeSelect.disabled = false; }
        });
    }

    attendanceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(attendanceForm);
        const data = Object.fromEntries(formData.entries());
        const absentRollNos = [];
        const selectedItems = document.querySelectorAll('#roll-number-grid .roll-number-item.absent');
        selectedItems.forEach(item => { absentRollNos.push(item.dataset.rollNo); });
        data.absent_roll_nos = absentRollNos;
        try {
            const result = await apiFetch('/attendance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            showMessage(result.message);
            attendanceForm.reset();
            selectedItems.forEach(item => item.classList.remove('absent'));
            const today = new Date();
            const day = String(today.getDate()).padStart(2, '0');
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const year = today.getFullYear();
            dateDisplayInput.value = `${day}-${month}-${year}`;
            dateInput.value = today.toLocaleDateString('en-CA');
            teacherNameInput.value = data.teacher_name; // Keep teacher name filled
        } catch (error) { /* Handled */ }
    });
    
    // --- STUDENT SECTION LOGIC ---
    showStudentLoginTab.addEventListener('click', () => {
        studentRegView.classList.add('hidden');
        studentLoginView.classList.remove('hidden');
        studentDashboardView.classList.add('hidden');
        studentAuthContainer.classList.remove('hidden');
        showStudentRegTab.classList.remove('active');
        showStudentLoginTab.classList.add('active');
    });

    showStudentRegTab.addEventListener('click', () => {
        studentLoginView.classList.add('hidden');
        studentRegView.classList.remove('hidden');
        showStudentLoginTab.classList.remove('active');
        showStudentRegTab.classList.add('active');
    });

    regStudentDiv.addEventListener('change', () => {
        const division = regStudentDiv.value;
        regStudentRollNo.innerHTML = '';
        regStudentRollNo.disabled = true;
        if (!division) {
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

    studentRegForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = { name: document.getElementById('reg-student-name').value, division: document.getElementById('reg-student-div').value, roll_no: document.getElementById('reg-student-rollno').value, phone_no: document.getElementById('reg-student-phone').value, password: document.getElementById('reg-student-password').value };
        try {
            const result = await apiFetch('/students/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            showMessage(result.message);
            studentRegForm.reset();
            showStudentLoginTab.click();
        } catch (error) { /* Handled */ }
    });

    studentLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = { phone_no: document.getElementById('student-phone').value, password: document.getElementById('student-password').value };
        try {
            const result = await apiFetch('/students/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            showMessage(result.message);
            studentAuthContainer.classList.add('hidden');
            studentDashboardView.classList.remove('hidden');
            fetchAndDisplayStudentData(result.division, result.roll_no);
        } catch (error) { /* Handled */ }
    });

    const fetchAndDisplayStudentData = async (division, loggedInRollNo = null) => {
        try {
            const data = await apiFetch(`/students/${division}`);
            let heading = `Displaying Data for Division ${division}`;
            let tableHTML = `<table><thead><tr><th>Roll No</th><th>Student Name</th>`;
            data.dates.forEach(date => { tableHTML += `<th>${new Date(date).toLocaleDateString('en-GB')}</th>`; });
            tableHTML += `<th>Total Fine</th></tr></thead><tbody>`;
            
            let loggedInStudentRow = '';
            let otherStudentRows = '';

            data.students.forEach(student => {
                let totalAbsences = 0;
                let rowHTML = `<tr class="${student.roll_no == loggedInRollNo ? 'highlighted' : ''}"><td>${student.roll_no}</td><td>${student.name}</td>`;
                data.dates.forEach(date => {
                    const record = student.attendance[date];
                    if (record && record.status === 'A') {
                        rowHTML += `<td class="absent">A</td>`;
                        totalAbsences++;
                    } else {
                        rowHTML += `<td class="present">P</td>`;
                    }
                });
                const totalFine = totalAbsences * 100;
                rowHTML += `<td class="fine">₹${totalFine}</td></tr>`;
                
                if(student.roll_no == loggedInRollNo){
                    loggedInStudentRow = rowHTML;
                    heading = `Attendance Report for ${student.name} (Roll No: ${student.roll_no}, Div: ${division})`;
                }
                otherStudentRows += rowHTML;
            });

            // If a student is logged in, show only their data
            if(loggedInRollNo) {
                 tableHTML += loggedInStudentRow;
            } else {
                 tableHTML += otherStudentRows;
            }

            tableHTML += `</tbody></table>`;
            document.getElementById('student-table-container').innerHTML = tableHTML;
            document.getElementById('student-table-heading').textContent = heading;

        } catch (error) {
            document.getElementById('student-table-container').innerHTML = `<p>Could not load student data.</p>`;
        }
    };
    
    // Legacy buttons for public view
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
            let tableHTML = `<table><thead><tr><th>Date</th><th>Time</th><th>Div</th><th>Subject</th><th>Topic</th><th>Teacher</th><th>Type</th><th>Absentees (Roll No)</th><th>Actions</th></tr></thead><tbody>`;
            records.forEach(rec => {
                tableHTML += `<tr><td>${new Date(rec.date).toLocaleDateString('en-GB')}</td><td>${rec.time_slot}</td><td>${rec.division}</td><td>${rec.subject}</td><td>${rec.topic}</td><td>${rec.teacher_name}</td><td>${rec.type}</td><td>${rec.absent_roll_nos.join(', ')}</td><td><button class="delete-btn" data-lecture-id="${rec.id}">Delete</button></td></tr>`;
            });
            tableHTML += `</tbody></table>`;
            hodTableContainer.innerHTML = tableHTML;
        } catch (error) {
             hodTableContainer.innerHTML = `<p>Could not load attendance records.</p>`;
        }
    };

    hodFilterBtn.addEventListener('click', fetchAndDisplayHodData);
    hodTableContainer.addEventListener('click', async (e) => {
        if (e.target && e.target.classList.contains('delete-btn')) {
            const lectureId = e.target.dataset.lectureId;
            if (confirm('Are you sure you want to permanently delete this entire lecture record?')) {
                try {
                    const result = await apiFetch(`/lectures/${lectureId}`, { method: 'DELETE' });
                    showMessage(result.message);
                    fetchAndDisplayHodData();
                } catch (error) { /* Handled */ }
            }
        }
    });
    hodDownloadPdfBtn.addEventListener('click', () => { /* ... PDF logic ... */ });

    const fetchPendingTeachers = async () => { /* ... Fetch pending logic ... */ };
    pendingTeachersContainer.addEventListener('click', async (e) => { /* ... Verify logic ... */ });
    const fetchTeacherStatus = async () => { /* ... Fetch status logic ... */ };
    hodLoginBtn.addEventListener('click', async () => { /* ... HOD login logic ... */ });

    // --- FINE REMOVAL LOGIC ---
    removeFineForms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = { date: form.querySelector('.fine-date').value, time_slot: form.querySelector('.fine-time').value, roll_no: form.querySelector('.fine-rollno').value, division: form.querySelector('.fine-div').value };
            try {
                const result = await apiFetch('/attendance/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                showMessage(result.message);
                form.reset();
            } catch(error) { /* Handled */ }
        });
    });
});