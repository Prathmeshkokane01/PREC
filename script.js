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
    const dateDisplayInput = document.getElementById('att-date-display'); // This is the visible one
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

    // Fine Removal Forms (they share some IDs, which is okay as only one is visible at a time)
    const removeFineForms = document.querySelectorAll('#remove-fine-form');


    // --- INITIALIZATION CODE (runs after all elements are found) ---

    // Auto-set date with dual format
    const today = new Date();
    // Format for the user (DD-MM-YYYY)
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const year = today.getFullYear();
    if (dateDisplayInput) { // Check if the element exists before setting its value
        dateDisplayInput.value = `${day}-${month}-${year}`;
    }
    // Format for the database (YYYY-MM-DD)
    if (dateInput) { // Check if the element exists
        dateInput.value = today.toLocaleDateString('en-CA');
    }

    // --- HELPER FUNCTIONS ---
    const showMessage = (text, type = 'success') => {
        messageContainer.textContent = text;
        messageContainer.className = type;
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
        } catch (error) { /* Error handled by apiFetch */ }
    });

    // Attendance Form Submission
    attendanceForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(attendanceForm);
        const data = Object.fromEntries(formData.entries());
        data.absent_roll_nos = data.absent_roll_nos.split(',').map(n => n.trim()).filter(Boolean);

        try {
            const result = await apiFetch('/attendance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            showMessage(result.message);
            attendanceForm.reset();
            // Re-populate the date fields after reset
            dateDisplayInput.value = `${day}-${month}-${year}`;
            dateInput.value = today.toLocaleDateString('en-CA');
        } catch (error) { /* Error handled */ }
    });
    
    // --- STUDENT SECTION LOGIC ---
    const fetchAndDisplayStudentData = async (division) => {
        try {
            const data = await apiFetch(`/students/${division}`);
            studentTableHeading.textContent = `Displaying Data for Division ${division}`;
            
            let tableHTML = `<table><thead><tr><th>Roll No</th><th>Student Name</th>`;
            data.dates.forEach(date => {
                tableHTML += `<th>${new Date(date).toLocaleDateString('en-GB')}</th>`;
            });
            tableHTML += `<th>Total Fine</th></tr></thead><tbody>`;

            data.students.forEach(student => {
                let totalAbsences = 0;
                tableHTML += `<tr><td>${student.roll_no}</td><td>${student.name}</td>`;
                data.dates.forEach(date => {
                    const record = student.attendance[date];
                    if (record && record.status === 'A') {
                        tableHTML += `<td class="absent">A</td>`;
                        totalAbsences++;
                    } else {
                        tableHTML += `<td class="present">P</td>`;
                    }
                });
                const totalFine = totalAbsences * 100;
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
            fetchAndDisplayHodData();
        } catch(error) { /* Error handled */ }
    });
    // Replace the entire old function with this new one
const fetchAndDisplayHodData = async () => {
    const div = document.getElementById('hod-filter-div').value;
    const date = document.getElementById('hod-filter-date').value;

    let query = `?`;
    if (div && div !== 'ALL') query += `division=${div}&`;
    if (date) query += `date=${date}`;

    try {
        const records = await apiFetch(`/attendance${query}`);
        // ADDED "Actions" HEADER
        let tableHTML = `<table><thead><tr><th>Date</th><th>Time</th><th>Div</th><th>Subject</th><th>Topic</th><th>Teacher</th><th>Type</th><th>Absentees (Roll No)</th><th>Actions</th></tr></thead><tbody>`;
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
                    <td>
                        <button class="delete-btn" data-lecture-id="${rec.id}">Delete</button>
                    </td>
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
    // NEW CODE BLOCK - Listens for clicks on any delete button in the HOD table
hodTableContainer.addEventListener('click', async (e) => {
    // Check if a delete button was the specific element clicked
    if (e.target && e.target.classList.contains('delete-btn')) {
        const lectureId = e.target.dataset.lectureId;

        // Show a confirmation popup before deleting
        if (confirm('Are you sure you want to permanently delete this entire lecture record? This action cannot be undone.')) {
            try {
                const result = await apiFetch(`/lectures/${lectureId}`, {
                    method: 'DELETE'
                });
                showMessage(result.message); // Show success message
                fetchAndDisplayHodData(); // Refresh the table to show the row is gone
            } catch (error) {
                // The apiFetch function will automatically show the error message
            }
        }
    }
});

    // PDF Download
    hodDownloadPdfBtn.addEventListener('click', () => {
        const printContent = hodTableContainer.innerHTML;
        const originalContent = document.body.innerHTML;
        document.body.innerHTML = `<html><head><title>Attendance Report</title><style>table { width: 100%; border-collapse: collapse; font-size: 12px; } th, td { border: 1px solid #ccc; padding: 8px; text-align: left; } th { background-color: #f2f2f2; } h1 { font-size: 18px; }</style></head><body><h1>Attendance Report - Pravara Rural Engineering College</h1>${printContent}</body></html>`;
        window.print();
        window.location.reload();
    });

    // --- FINE REMOVAL LOGIC ---
    // This now applies to both forms (Teacher and HOD)
    removeFineForms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Get data from the specific form that was submitted
            const data = {
                date: e.target.querySelector('#fine-date').value,
                time_slot: e.target.querySelector('#fine-time').value,
                roll_no: e.target.querySelector('#fine-rollno').value,
                division: e.target.querySelector('#fine-div').value
            };

            try {
                const result = await apiFetch('/attendance/remove', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify(data)
                });
                showMessage(result.message);
                form.reset();
            } catch(error) { /* Error handled */ }
        });
    });

});