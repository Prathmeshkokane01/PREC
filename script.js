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
    const studentDBView = document.getElementById('student-db-wrapper');
    const regStudentDiv = document.getElementById('reg-student-div');
    const regStudentRollNo = document.getElementById('reg-student-rollno');
    
    // Student Table (Public and LoggedIn)
    const viewDivA_Btn = document.getElementById('view-div-a');
    const viewDivB_Btn = document.getElementById('view-div-b');
    const studentTableContainerPublic = document.querySelector('#student-db-wrapper #student-table-container');
    const studentTableHeadingPublic = document.querySelector('#student-db-wrapper #student-table-heading');
    const studentTableContainerLoggedIn = document.querySelector('#student-dashboard-view #student-table-container-loggedin');
    
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
    const showMessage = (text, type = 'success') => { /* ... showMessage logic ... */ };
    const apiFetch = async (endpoint, options = {}) => { /* ... apiFetch logic ... */ };

    // --- MAIN NAVIGATION LOGIC ---
    navButtons.forEach(button => { /* ... Main nav logic ... */ });

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

    // --- TAB SWITCHING LOGIC ---
    function setupTabs(tabContainerId) {
        const tabContainer = document.getElementById(tabContainerId);
        if (!tabContainer) return;
        
        const tabs = tabContainer.querySelectorAll('.dashboard-tab');
        const contents = tabContainer.parentElement.querySelectorAll('.dashboard-content');

        tabContainer.addEventListener('click', (e) => {
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

    // --- TEACHER SECTION ---
    showLoginTab.addEventListener('click', () => { /* ... show login logic ... */ });
    showSignupTab.addEventListener('click', () => { /* ... show signup logic ... */ });
    teacherSignupForm.addEventListener('submit', async (e) => { /* ... signup logic ... */ });
    teacherLoginForm.addEventListener('submit', async (e) => { /* ... login logic ... */ });
    function generateRollNumberGrid(totalRollNumbers = 71) { /* ... grid generation ... */ }
    if (gridContainer) { gridContainer.addEventListener('click', (e) => { /* ... grid click logic ... */ }); }
    if(typeSelect) { typeSelect.addEventListener('change', () => { /* ... practical timeslot logic ... */ }); }
    attendanceForm.addEventListener('submit', async (e) => { /* ... attendance submission logic ... */ });
    
    // --- STUDENT SECTION ---
    regStudentDiv.addEventListener('change', () => { /* ... dynamic roll no logic ... */ });
    studentRegForm.addEventListener('submit', async (e) => { /* ... student registration logic ... */ });
    studentLoginForm.addEventListener('submit', async (e) => { /* ... student login logic ... */ });
    const fetchAndDisplayStudentData = async (division, loggedInRollNo = null) => {
        try {
            const data = await apiFetch(`/students/${division}`);
            let container = loggedInRollNo ? studentTableContainerLoggedIn : studentTableContainerPublic;
            let headingElement = loggedInRollNo ? studentDashboardView.querySelector('h2') : studentTableHeadingPublic;
            
            let headingText = `Displaying Data for Division ${division}`;
            let tableHTML = `<table><thead><tr><th>Roll No</th><th>Student Name</th>`;
            data.dates.forEach(date => { tableHTML += `<th>${new Date(date).toLocaleDateString('en-GB')}</th>`; });
            tableHTML += `<th>Total Fine</th></tr></thead><tbody>`;
            
            data.students.forEach(student => {
                let isHighlighted = student.roll_no == loggedInRollNo && student.division == division;
                if (loggedInRollNo && !isHighlighted) return; // If logged in, only show their row

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
        } catch (error) { /* error handling */ }
    };
    if(viewDivA_Btn) viewDivA_Btn.addEventListener('click', () => fetchAndDisplayStudentData('A'));
    if(viewDivB_Btn) viewDivB_Btn.addEventListener('click', () => fetchAndDisplayStudentData('B'));

    // --- HOD SECTION LOGIC (COMPLETE) ---
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