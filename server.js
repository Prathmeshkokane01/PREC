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
// IMPORTANT: In a real application, store these securely in a database, not in code.
const TEACHER_CREDENTIALS = [
    { email: 'teacher1@pravara.edu', accessCode: 'pass123' },
    { email: 'teacher2@pravara.edu', accessCode: 'pass456' }
];
const HOD_ACCESS_CODE = 'hod_secret_code';

// --- DATABASE CONNECTION ---
// The DATABASE_URL will come from your Neon project settings
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// --- MIDDLEWARE ---
app.use(cors()); // Allows requests from your frontend
app.use(express.json()); // Parses incoming JSON requests
app.use(express.static('.')); // Serve static files like index.html, style.css


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
        // Get list of students in the division
        const studentRes = await client.query('SELECT roll_no, name FROM students WHERE division = $1 ORDER BY roll_no', [division]);
        const students = studentRes.rows;

        // Get attendance for the last 7 days for these students
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const attendanceRes = await client.query(
            'SELECT student_roll_no, date, status FROM attendance_records WHERE division = $1 AND date >= $2',
            [division, sevenDaysAgo]
        );

        // Process data for easy frontend use
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

        // Generate date range for the table header
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
app.post('/api/attendance', async (req, res) => {
    const { date, division, subject, topic, teacher_name, time_slot, type, absent_roll_nos } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Start transaction

        // Insert the main lecture record
        const lectureInsertQuery = `
            INSERT INTO lectures (date, division, subject, topic, teacher_name, time_slot, type, absent_roll_nos)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;
        `;
        const lectureRes = await client.query(lectureInsertQuery, [date, division, subject, topic, teacher_name, time_slot, type, absent_roll_nos]);
        const lectureId = lectureRes.rows[0].id;
        
        // Mark students as absent
        for (const roll_no of absent_roll_nos) {
            const absentInsertQuery = `
                INSERT INTO attendance_records (lecture_id, student_roll_no, division, date, status)
                VALUES ($1, $2, $3, $4, 'A');
            `;
            await client.query(absentInsertQuery, [lectureId, parseInt(roll_no), division, date]);
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
app.post('/api/attendance/remove', async (req, res) => {
    const { date, time_slot, roll_no, division } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Find the lecture ID
        const lectureRes = await client.query(
            'SELECT id FROM lectures WHERE date = $1 AND time_slot = $2 AND division = $3',
            [date, time_slot, division]
        );

        if (lectureRes.rows.length === 0) {
            return res.status(404).json({ message: 'No lecture found for the specified date, time, and division.' });
        }
        const lectureId = lectureRes.rows[0].id;

        // Delete the specific absence record
        const deleteRes = await client.query(
            'DELETE FROM attendance_records WHERE lecture_id = $1 AND student_roll_no = $2',
            [lectureId, roll_no]
        );
        
        // Remove the roll number from the `absent_roll_nos` array in the `lectures` table
        await client.query(
            `UPDATE lectures SET absent_roll_nos = array_remove(absent_roll_nos, $1) WHERE id = $2`,
            [roll_no, lectureId]
        );

        if (deleteRes.rowCount > 0) {
            await client.query('COMMIT');
            res.json({ message: `Absence for Roll No ${roll_no} on ${date} has been removed.` });
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


// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});