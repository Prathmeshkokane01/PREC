// Import required packages
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config(); // To read .env file

// --- CONFIGURATION ---
const app = express();
const PORT = process.env.PORT || 3000;
const FINE_PER_ABSENCE = 100;

// --- PRE-DEFINED ACCESS CODES & EMAILS (as requested) ---
const TEACHER_CREDENTIALS = [
    { email: 'prathmeshkokane2511@gmail.com', accessCode: '1230' },
    { email: 'teacher2@pravara.edu', accessCode: 'pass456' }
];
const HOD_ACCESS_CODE = 'hod123';

// --- DATABASE CONNECTION ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static('.'));


// --- API ENDPOINTS (ROUTES) ---

// 1. Authentication Routes
app.post('/api/auth/teacher', (req, res) => {
    const { email, accessCode } = req.body;
    const isValid = TEACHER_CREDENTIALS.some(cred => cred.email === email && cred.accessCode === accessCode);
    if (isValid) {
        res.status(200).json({ message: 'Teacher authenticated successfully.' });
    } else {
        res.status(401).json({ message: 'Invalid email or access code.' });
    }
});

app.post('/api/auth/hod', (req, res) => {
    const { accessCode } = req.body;
    if (accessCode === HOD_ACCESS_CODE) {
        res.status(200).json({ message: 'HOD authenticated successfully.' });
    } else {
        res.status(401).json({ message: 'Invalid HOD access code.' });
    }
});


// 2. Get Student Data for Student View
app.get('/api/students/:division', async (req, res) => {
    const { division } = req.params;
    const client = await pool.connect();
    try {
        const studentRes = await client.query('SELECT roll_no, name FROM students WHERE division = $1 ORDER BY roll_no', [division]);
        const students = studentRes.rows;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        
        // THIS IS THE VERIFIED CORRECT QUERY
        const attendanceRes = await client.query(
            'SELECT student_roll_no, date, status FROM attendance_records WHERE division = $1 AND date >= $2',
            [division, sevenDaysAgo]
        );

        const attendanceMap = {};
        attendanceRes.rows.forEach(row => {
            if (!attendanceMap[row.student_roll_no]) {
                attendanceMap[row.student_roll_no] = {};
            }
            attendanceMap[row.student_roll_no][new Date(row.date).toISOString().split('T')[0]] = { status: 'A' };
        });

        students.forEach(student => {
            student.attendance = attendanceMap[student.roll_no] || {};
        });

        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
        dates.reverse();

        res.json({ students, dates });

    } catch (error) {
        console.error('Error fetching student data:', error);
        res.status(500).json({ message: 'Failed to fetch student data.' });
    } finally {
        client.release();
    }
});


// 3. Submit New Attendance Record
// NEW, CORRECTED FUNCTION
app.post('/api/attendance/remove', async (req, res) => {
    const { date, time_slot, roll_no, division } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const lectureRes = await client.query(
            'SELECT id FROM lectures WHERE date = $1 AND time_slot = $2 AND division = $3',
            [date, time_slot, division]
        );

        if (lectureRes.rows.length === 0) {
            return res.status(404).json({ message: 'No lecture found for the specified date, time, and division.' });
        }
        const lectureId = lectureRes.rows[0].id;

        // Using parseInt() here to fix the bug
        const studentRollNoInt = parseInt(roll_no, 10);

        const deleteRes = await client.query(
            'DELETE FROM attendance_records WHERE lecture_id = $1 AND student_roll_no = $2',
            [lectureId, studentRollNoInt] // Use the integer version
        );

        await client.query(
            `UPDATE lectures SET absent_roll_nos = array_remove(absent_roll_nos, $1) WHERE id = $2`,
            [studentRollNoInt, lectureId] // Use the integer version
        );

        if (deleteRes.rowCount > 0) {
            await client.query('COMMIT');
            res.json({ message: `Absence for Roll No ${studentRollNoInt} on ${date} has been removed.` });
        } else {
            await client.query('ROLLBACK');
            res.status(404).json({ message: 'Student was not marked absent for this lecture.' });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error removing absence:', error);
        res.status(500).json({ message: 'Failed to remove absence record.' });
    } finally {
        client.release();
    }
});

// 4. Get All Attendance for HOD view
app.get('/api/attendance', async (req, res) => {
    let { division, date } = req.query;
    let query = 'SELECT * FROM lectures';
    const params = [];

    if(division && division !== 'ALL' || date) {
        query += ' WHERE ';
        let conditions = [];
        if(division && division !== 'ALL') {
            params.push(division);
            conditions.push(`division = $${params.length}`);
        }
        if(date) {
            params.push(date);
            conditions.push(`date = $${params.length}`);
        }
        query += conditions.join(' AND ');
    }

    query += ' ORDER BY date DESC, time_slot ASC';
    
    try {
        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching HOD data:', error);
        res.status(500).json({ message: 'Failed to fetch attendance records.' });
    }
});


// 5. Remove an Absence Record (for fine removal)
// NEW, CORRECTED FUNCTION
app.post('/api/attendance', async (req, res) => {
    const { date, division, subject, topic, teacher_name, time_slot, type, absent_roll_nos } = req.body;

    // FIX: Convert array of string roll numbers to array of integers
    const absentRollNosAsInt = absent_roll_nos.map(r => parseInt(r, 10));

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        // Insert the main lecture record
        const lectureInsertQuery = `
            INSERT INTO lectures (date, division, subject, topic, teacher_name, time_slot, type, absent_roll_nos)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;
        `;
        // Use the new integer array here
        const lectureRes = await client.query(lectureInsertQuery, [date, division, subject, topic, teacher_name, time_slot, type, absentRollNosAsInt]);
        const lectureId = lectureRes.rows[0].id;

        // Mark students as absent
        // Loop through the new integer array here as well
        for (const roll_no of absentRollNosAsInt) {
            const absentInsertQuery = `
                INSERT INTO attendance_records (lecture_id, student_roll_no, division, date, status)
                VALUES ($1, $2, $3, $4, 'A');
            `;
            await client.query(absentInsertQuery, [lectureId, roll_no, division, date]);
        }

        await client.query('COMMIT'); // Commit transaction
        res.status(201).json({ message: 'Attendance submitted successfully!' });
    } catch (error) {
        await client.query('ROLLBACK'); // Rollback on error
        console.error('Error submitting attendance:', error);
        res.status(500).json({ message: 'Failed to submit attendance. Check if roll numbers are valid.' });
    } finally {
        client.release();
    }
});
// 6. Delete a specific Lecture Record
app.delete('/api/lectures/:id', async (req, res) => {
    const { id } = req.params; // Get the lecture ID from the URL
    try {
        await pool.query('DELETE FROM lectures WHERE id = $1', [id]);
        res.status(200).json({ message: 'Lecture record and all associated absences have been deleted.' });
    } catch (error) {
        console.error('Error deleting lecture:', error);
        res.status(500).json({ message: 'Failed to delete lecture record.' });
    }
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});