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
// NEW, CORRECTED FUNCTION for Composite Key
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

        const studentRollNoInt = parseInt(roll_no, 10);

        // THE QUERY IS NOW MORE SPECIFIC, IT ALSO CHECKS THE DIVISION
        const deleteRes = await client.query(
            'DELETE FROM attendance_records WHERE lecture_id = $1 AND student_roll_no = $2 AND division = $3',
            [lectureId, studentRollNoInt, division]
        );

        await client.query(
            `UPDATE lectures SET absent_roll_nos = array_remove(abs_roll_nos, $1) WHERE id = $2`,
            [studentRollNoInt, lectureId]
        );

        if (deleteRes.rowCount > 0) {
            await client.query('COMMIT');
            res.json({ message: `Absence for Roll No ${studentRollNoInt} in Div ${division} on ${date} has been removed.` });
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