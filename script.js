document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const API_BASE_URL = ''; // This will be your Render URL later, leave empty for local dev
    
    // --- DOM ELEMENTS ---
    const navButtons = document.querySelectorAll('.nav-button');
    const sections = document.querySelectorAll('main > section');
    const messageContainer = document.getElementById('message-container');

    // Teacher Section
    const teacherLoginView = document.getElementById('teacher-login-view');
    const teacherFormView = document.getElementById('teacher-form-view');
    const teacherLoginBtn = document.getElementById('teacher-login-btn');
    const teacherEmailInput = document.getElementById('teacher-email');
    const teacherAccessCodeInput = document.getElementById('teacher-access-code');
    const attendanceForm = document.getElementById('attendance-form');
    const dateInput = document.getElementById('att-date');
    const typeSelect = document.getElementById('att-type');
    const timeSelect = document.getElementById('att-time');

    // Student Section
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

    // Fine Removal Section
    const removeFineForm = document.getElementById('remove-fine-form');

    // --- HELPER FUNCTIONS ---
    const showMessage = (text, type = 'success') => {
        messageContainer.textContent = text;
        messageContainer.className = type; // 'success' or 'error'
        messageContainer.style.display = 'block';
        setTimeout(() => {
            messageContainer.style.display = 'none';
        }, 4000);
    };

    const apiFetch = async (endpoint, options = {}) => {
        try {
            const response = await fetch(`${API_BASE_URL}/api${endpoint}`, options);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'An error occurred.');
            }
            return await response.json();
        } catch (error) {
            showMessage(error.message, 'error');
            console.error('API Fetch Error:', error);
            throw error; // Re-throw to handle in calling function if needed
        }
    };

    // --- NAVIGATION LOGIC ---
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Deactivate all buttons and hide all sections
            navButtons.forEach(btn => btn.classList.remove('active'));
            sections.forEach(sec => sec.classList.add('hidden'));

            // Activate the clicked button and show the corresponding section
            button.classList.add('active');
            const sectionId = button.id.replace('nav-', '') + '-section';
            document.getElementById(sectionId).classList.remove('hidden');
        });
    });

    // --- TEACHER SECTION LOGIC ---
    // Auto-set date
    dateInput.value = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format

    // Auto-select time for practicals
    typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'Practical') {
            timeSelect.value = '11.30am to 1.20pm';
            timeSelect.disabled = true;
        } else {
            timeSelect.disabled = false;
        }
    });

    // Teacher Login
    teacherLoginBtn.addEventListener('click', async () => {
        const email = teacherEmailInput.value;
        const accessCode = teacherAccessCodeInput.value;
        try {
            await apiFetch('/auth/teacher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, accessCode })
            });
            teacherLoginView.classList.add('hidden');
            teacherFormView.classList.remove('hidden');
            showMessage('Login successful!');
        } catch (error) {
            // Error message is already shown by apiFetch
        }
    });

    // Attendance Form Submission
    attendanceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(attendanceForm);
        const data = Object.fromEntries(formData.entries());
        data.absent_roll_nos = data.absent_roll_nos.split(',').map(n => n.trim()).filter(Boolean); // Convert to array

        try {
            const result = await apiFetch('/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            showMessage(result.message);
            attendanceForm.reset();
            dateInput.value = new Date().toLocaleDateString('en-CA'); // Reset date
        } catch (error) {
            // Error handling done in apiFetch
        }
    });
    
    // --- STUDENT SECTION LOGIC ---
    const fetchAndDisplayStudentData = async (division) => {
        try {
            const data = await apiFetch(`/students/${division}`);
            studentTableHeading.textContent = `Displaying Data for Division ${division}`;
            
            let tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Roll No</th>
                            <th>Student Name</th>
            `;
            // Add date headers
            data.dates.forEach(date => {
                tableHTML += `<th>${new Date(date).toLocaleDateString('en-GB')}</th>`;
            });

            tableHTML += `
                            <th>Total Fine</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            // Add student rows
            data.students.forEach(student => {
                let totalAbsences = 0;
                tableHTML += `<tr>
                    <td>${student.roll_no}</td>
                    <td>${student.name}</td>
                `;
                data.dates.forEach(date => {
                    const record = student.attendance[date];
                    if (record && record.status === 'A') {
                        tableHTML += `<td class="absent">A</td>`;
                        totalAbsences++;
                    } else {
                        tableHTML += `<td class="present">P</td>`;
                    }
                });
                const totalFine = totalAbsences * 100; // Fine logic
                tableHTML += `<td class="fine">₹${totalFine}</td></tr>`;
            });

            tableHTML += `</tbody></table>`;
            studentTableContainer.innerHTML = tableHTML;

        } catch (error) {
            studentTableContainer.innerHTML = `<p>Could not load student data.</p>`;
        }
    };
    
    viewDivA_Btn.addEventListener('click', () => fetchAndDisplayStudentData('A'));
    viewDivB_Btn.addEventListener('click', () => fetchAndDisplayStudentData('B'));

    // --- HOD SECTION LOGIC ---
    // HOD Login
    hodLoginBtn.addEventListener('click', async () => {
        const accessCode = hodAccessCodeInput.value;
        try {
             await apiFetch('/auth/hod', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accessCode })
            });
            hodLoginView.classList.add('hidden');
            hodDataView.classList.remove('hidden');
            showMessage('HOD Login successful!');
            fetchAndDisplayHodData(); // Fetch initial data
        } catch(error) {
            // Error handled by apiFetch
        }
    });
    
    const fetchAndDisplayHodData = async () => {
        const div = document.getElementById('hod-filter-div').value;
        const date = document.getElementById('hod-filter-date').value;

        let query = `?`;
        if (div && div !== 'ALL') query += `division=${div}&`;
        if (date) query += `date=${date}`;

        try {
            const records = await apiFetch(`/attendance${query}`);
            let tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Div</th>
                            <th>Subject</th>
                            <th>Topic</th>
                            <th>Teacher</th>
                            <th>Type</th>
                            <th>Absentees (Roll No)</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            records.forEach(rec => {
                tableHTML += `
                    <tr>
                        <td>${new Date(rec.date).toLocaleDateString('en-GB')}</td>
                        <td>${rec.time_slot}</td>
                        <td>${rec.division}</td>
                        <td>${rec.subject}</td>
                        <td>${rec.topic}</td>
                        <td>${rec.teacher_name}</td>
                        <td>${rec.type}</td>
                        <td>${rec.absent_roll_nos.join(', ')}</td>
                    </tr>
                `;
            });
            tableHTML += `</tbody></table>`;
            hodTableContainer.innerHTML = tableHTML;
        } catch (error) {
             hodTableContainer.innerHTML = `<p>Could not load attendance records.</p>`;
        }
    };

    hodFilterBtn.addEventListener('click', fetchAndDisplayHodData);

    // PDF Download (simplified using browser's print function)
    hodDownloadPdfBtn.addEventListener('click', () => {
        const printContent = hodTableContainer.innerHTML;
        const originalContent = document.body.innerHTML;
        document.body.innerHTML = `
            <html>
                <head>
                    <title>Attendance Report</title>
                    <style>
                        table { width: 100%; border-collapse: collapse; font-size: 12px; }
                        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; }
                        h1 { font-size: 18px; }
                    </style>
                </head>
                <body>
                    <h1>Attendance Report - Pravara Engg College</h1>
                    ${printContent}
                </body>
            </html>
        `;
        window.print();
        document.body.innerHTML = originalContent;
        // Re-attach event listeners because document body was replaced. This is a complex problem,
        // so for now we'll just reload the page for simplicity after printing.
        window.location.reload();
    });


    // --- FINE REMOVAL LOGIC ---
    removeFineForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            date: document.getElementById('fine-date').value,
            time_slot: document.getElementById('fine-time').value,
            roll_no: document.getElementById('fine-rollno').value,
            division: document.getElementById('fine-div').value
        };

        try {
            const result = await apiFetch('/attendance/remove', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(data)
            });
            showMessage(result.message);
            removeFineForm.reset();
        } catch(error) {
            // Error handled
        }
    });

});