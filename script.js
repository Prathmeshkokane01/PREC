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
    const studentLoginView = document.getElementById('student-login-view');
    const studentRegView = document.getElementById('student-reg-view');
    const studentLoginForm = document.getElementById('student-login-form');
    const studentRegForm = document.getElementById('student-reg-form');
    const studentDashboardView = document.getElementById('student-dashboard-view');
    const regStudentDiv = document.getElementById('reg-student-div');
    const regStudentRollNo = document.getElementById('reg-student-rollno');
    
    // Student Table (Public and LoggedIn)
    const studentPublicView = document.getElementById('student-db-wrapper');
    const viewDivA_Btn = document.getElementById('view-div-a');
    const viewDivB_Btn = document.getElementById('view-div-b');
    const studentTableContainerPublic = document.querySelector('#student-db-wrapper #student-table-container');
    const studentTableHeadingPublic = document.querySelector('#student-db-wrapper #student-table-heading');
    const studentTableContainerLoggedIn = document.querySelector('#student-dashboard-view #student-table-container-loggedin');
    const studentDashboardHeading = document.getElementById('student-dashboard-heading');
    
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
    const togglePasswordIcons = document.querySelectorAll('.toggle-password');
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
        messageContainer.className = '';
        messageContainer.classList.add(type);
        messageContainer.textContent = text;
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
    function setupTabs(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const tabs = container.querySelectorAll('.dashboard-tab');
        const contents = container.parentElement.querySelectorAll('.dashboard-content');
        
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('dashboard-tab')) {
                const targetId = e.target.dataset.target;
                tabs.forEach(tab => tab.classList.remove('active'));
                e.target.classList.add('active');
                contents.forEach(content => {
                    if (content.id === targetId) {
                        content.classList.remove('hidden');
                    } else {
                        content.classList.add('hidden');
                    }
                });
            }
        });
    }
    setupTabs('teacher-dashboard-tabs');
    setupTabs('student-dashboard-tabs');

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
            if(result) { showMessage(result.message); teacherSignupForm.reset(); showLoginTab.click(); }
        } catch (error) { /* Handled */ }
    });

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
                generateRollNumberGrid();
            }
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
            if (e.target.classList.contains('roll-number-item')) { e.target.classList.toggle('absent'); }
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
            if(result){
                showMessage(result.message);
                selectedItems.forEach(item => item.classList.remove('absent'));
            }
        } catch (error) { /* Handled */ }
    });
    
    // --- STUDENT SECTION LOGIC ---
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
            if(result) { showMessage(result.message); studentRegForm.reset(); document.getElementById('show-student-login-tab').click(); }
        } catch (error) { /* Handled */ }
    });

    studentLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = { phone_no: document.getElementById('student-phone').value, password: document.getElementById('student-password').value };
        try {
            const result = await apiFetch('/students/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            if(result) {
                showMessage(result.message);
                studentAuthContainer.parentElement.querySelector('.dashboard-tabs').classList.add('hidden');
                studentAuthContainer.parentElement.querySelector('h2').classList.add('hidden');
                studentAuthContainer.classList.add('hidden');
                studentPublicView.classList.add('hidden');
                studentDashboardView.classList.remove('hidden');
                fetchAndDisplayStudentData(result.division, result.roll_no);
            }
        } catch (error) { /* Handled */ }
    });

    const fetchAndDisplayStudentData = async (division, loggedInRollNo = null) => {
        try {
            const data = await apiFetch(`/students/${division}`);
            const isPublicView = !loggedInRollNo;
            const container = isPublicView ? studentTableContainerPublic : studentTableContainerLoggedIn;
            const headingElement = isPublicView ? studentTableHeadingPublic : studentDashboardHeading;
            
            let headingText = `Displaying Data for Division ${division}`;
            let tableHTML = `<table><thead><tr><th>Roll No</th><th>Student Name</th>`;
            data.dates.forEach(date => { tableHTML += `<th>${new Date(date).toLocaleDateString('en-GB')}</th>`; });
            tableHTML += `<th>Total Fine</th></tr></thead><tbody>`;
            
            data.students.forEach(student => {
                let isHighlighted = student.roll_no == loggedInRollNo && student.division == division;
                if (!isPublicView && !isHighlighted) return;

                let totalAbsences = 0;
                let rowHTML = `<tr class="${isHighlighted ? 'highlighted' : ''}"><td>${student.roll_no}</td><td>${student.name}</td>`;
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
                tableHTML += rowHTML;

                if(isHighlighted){
                    headingText = `Attendance Report for ${student.name}`;
                }
            });
            tableHTML += `</tbody></table>`;
            container.innerHTML = tableHTML;
            headingElement.textContent = headingText;
        } catch (error) {
            const container = loggedInRollNo ? studentTableContainerLoggedIn : studentTableContainerPublic;
            container.innerHTML = `<p>Could not load student data.</p>`;
        }
    };
    
    if(viewDivA_Btn) viewDivA_Btn.addEventListener('click', () => fetchAndDisplayStudentData('A'));
    if(viewDivB_Btn) viewDivB_Btn.addEventListener('click', () => fetchAndDisplayStudentData('B'));

    // --- HOD SECTION LOGIC ---
    const fetchAndDisplayHodData = async () => { /* ... HOD Table Logic ... */ };
    hodFilterBtn.addEventListener('click', fetchAndDisplayHodData);
    hodTableContainer.addEventListener('click', async (e) => { /* ... Delete Lecture Logic ... */ });
    hodDownloadPdfBtn.addEventListener('click', () => { /* ... PDF Logic ... */ });
    const fetchPendingTeachers = async () => { /* ... Fetch Pending Logic ... */ };
    pendingTeachersContainer.addEventListener('click', async (e) => { /* ... Verify Logic ... */ });
    const fetchTeacherStatus = async () => { /* ... Fetch Status Logic ... */ };
    
    hodLoginBtn.addEventListener('click', async () => {
        const accessCode = hodAccessCodeInput.value;
        try {
            const result = await apiFetch('/auth/hod', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessCode }) });
            if(result) {
                hodLoginView.classList.add('hidden');
                hodDataView.classList.remove('hidden');
                showMessage('HOD Login successful!');
                fetchPendingTeachers();
                fetchAndDisplayHodData();
                if(statusInterval) clearInterval(statusInterval);
                statusInterval = setInterval(fetchTeacherStatus, 15000);
            }
        } catch(error) { /* Handled */ }
    });

    // --- FINE REMOVAL LOGIC ---
    removeFineForms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = { date: e.target.querySelector('.fine-date').value, time_slot: e.target.querySelector('.fine-time').value, roll_no: e.target.querySelector('.fine-rollno').value, division: e.target.querySelector('.fine-div').value };
            try {
                const result = await apiFetch('/attendance/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
                if(result) {
                    showMessage(result.message);
                    form.reset();
                }
            } catch(error) { /* Handled */ }
        });
    });
});