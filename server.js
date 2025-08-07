// Import required packages
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

// --- CONFIGURATION ---
const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;
const HOD_ACCESS_CODE = 'hod123';

// --- DATABASE CONNECTION ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// --- API ENDPOINTS ---

// --- HOD & TEACHER AUTH & ADMIN ---
app.post('/api/auth/hod', (req, res) => {
    const { accessCode } = req.body;
    if (accessCode === HOD_ACCESS_CODE) {
        res.status(200).json({ message: 'HOD authenticated successfully.' });
    } else {
        res.status(401).json({ message: 'Invalid HOD access code.' });
    }
});

app.post('/api/teachers/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        await pool.query('INSERT INTO teachers (name, email, password_hash) VALUES ($1, $2, $3)', [name, email, passwordHash]);
        res.status(201).json({ message: 'Signup successful! Please wait for HOD verification.' });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ message: 'An error occurred. The email might already be in use.' });
    }
});

app.post('/api/teachers/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM teachers WHERE email = $1', [email]);
        const teacher = result.rows[0];
        if (!teacher) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }
        if (teacher.status === 'pending') {
            return res.status(403).json({ message: 'Your account has not been verified by the HOD. Please contact the HOD.' });
        }
        const isMatch = await bcrypt.compare(password, teacher.password_hash);
        if (isMatch) {
            await pool.query('UPDATE teachers SET last_login = NOW() WHERE id = $1', [teacher.id]);
            res.status(200).json({ message: 'Login successful!', teacher_name: teacher.name });
        } else {
            res.status(401).json({ message: 'Invalid email or password.' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'An error occurred during login.' });
    }
});

app.get('/api/teachers/pending', async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name, email FROM teachers WHERE status = 'pending' ORDER BY id ASC");
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch pending teachers.' });
    }
});

app.put('/api/teachers/verify/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("UPDATE teachers SET status = 'verified' WHERE id = $1", [id]);
        res.status(200).json({ message: 'Teacher verified successfully.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to verify teacher.' });
    }
});

app.get('/api/teachers/status', async (req, res) => {
    try {
        const result = await pool.query("SELECT name, last_login FROM teachers WHERE status = 'verified'");
        const activeThreshold = 5 * 60 * 1000; // 5 minutes
        const statuses = result.rows.map(teacher => {
            if (!teacher.last_login) { return { name: teacher.name, isActive: false }; }
            const lastLoginTime = new Date(teacher.last_login).getTime();
            const now = new Date().getTime();
            const isActive = (now - lastLoginTime) < activeThreshold;
            return { name: teacher.name, isActive };
        });
        res.json(statuses);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch teacher statuses.' });
    }
});

// --- STUDENT AUTH ---
app.post('/api/students/register', async (req, res) => {
    const { name, division, roll_no, phone_no, password } = req.body;
    try {
        const studentCheck = await pool.query('SELECT * FROM students WHERE division = $1 AND roll_no = $2', [division, roll_no]);
        if (studentCheck.rows.length > 0) {
            return res.status(400).json({ message: 'A student with this Roll Number is already registered in this division.' });
        }
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        await pool.query(
            'INSERT INTO students (name, division, roll_no, phone_no, password_hash, status) VALUES ($1, $2, $3, $4, $5, $6)',
            [name, division, roll_no, phone_no, passwordHash, 'pending']
        );
        res.status(201).json({ message: 'Registration successful! Please wait for a teacher to verify your account.' });
    } catch (error) {
        console.error('Student registration error:', error);
        res.status(500).json({ message: 'An error occurred. The phone number might already be in use.' });
    }
});

app.post('/api/students/login', async (req, res) => {
    const { phone_no, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM students WHERE phone_no = $1', [phone_no]);
        const student = result.rows[0];
        if (!student || !student.password_hash) {
            return res.status(401).json({ message: 'Invalid phone number or password.' });
        }
        if (student.status === 'pending') {
            return res.status(403).json({ message: 'Your registration is still pending verification by a teacher.' });
        }
        const isMatch = await bcrypt.compare(password, student.password_hash);
        if (isMatch) {
            await pool.query('UPDATE students SET last_login = NOW() WHERE phone_no = $1', [phone_no]);
            res.status(200).json({ 
                message: 'Login successful!',
                division: student.division,
                roll_no: student.roll_no
            });
        } else {
            res.status(401).json({ message: 'Invalid phone number or password.' });
        }
    } catch (error) {
        console.error('Student login error:', error);
        res.status(500).json({ message: 'An error occurred during login.' });
    }
});

// --- PENDING STUDENT VERIFICATION (for Teachers) ---
app.get('/api/students/pending', async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name, division, roll_no FROM students WHERE status = 'pending' ORDER BY division, roll_no ASC");
        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching pending students:", error);
        res.status(500).json({ message: 'Failed to fetch pending students.' });
    }
});

app.put('/api/students/verify/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("UPDATE students SET status = 'verified' WHERE id = $1", [id]);
        res.status(200).json({ message: 'Student verified successfully.' });
    } catch (error)
    {
        console.error("Error verifying student:", error);
        res.status(500).json({ message: 'Failed to verify student.' });
    }
});

// --- DATA & ATTENDANCE ---
app.get('/api/students/:division', async (req, res) => {
    const { division } = req.params;
    const client = await pool.connect();
    try {
        const studentRes = await client.query("SELECT roll_no, name, division FROM students WHERE division = $1 AND status = 'verified' ORDER BY roll_no", [division]);
        const students = studentRes.rows;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        const attendanceRes = await client.query('SELECT student_roll_no, division, date, status FROM attendance_records WHERE division = $1 AND date >= $2', [division, sevenDaysAgo]);
        const attendanceMap = {};
        attendanceRes.rows.forEach(row => {
            const key = `${row.division}-${row.student_roll_no}`;
            if (!attendanceMap[key]) { attendanceMap[key] = {}; }
            attendanceMap[key][new Date(row.date).toISOString().split('T')[0]] = { status: 'A' };
        });
        students.forEach(student => {
            const key = `${student.division}-${student.roll_no}`;
            student.attendance = attendanceMap[key] || {};
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

app.post('/api/attendance', async (req, res) => {
    const { date, division, subject, topic, teacher_name, time_slot, type, absent_roll_nos } = req.body;
    const absentRollNosAsInt = absent_roll_nos.map(r => parseInt(r, 10));
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const lectureInsertQuery = `INSERT INTO lectures (date, division, subject, topic, teacher_name, time_slot, type, absent_roll_nos) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;`;
        const lectureRes = await client.query(lectureInsertQuery, [date, division, subject, topic, teacher_name, time_slot, type, absentRollNosAsInt]);
        const lectureId = lectureRes.rows[0].id;
        for (const roll_no of absentRollNosAsInt) {
            const absentInsertQuery = `INSERT INTO attendance_records (lecture_id, student_roll_no, division, date, status) VALUES ($1, $2, $3, $4, 'A');`;
            await client.query(absentInsertQuery, [lectureId, roll_no, division, date]);
        }
        await client.query('COMMIT');
        res.status(201).json({ message: 'Attendance submitted successfully!' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error submitting attendance:', error);
        res.status(500).json({ message: 'Failed to submit attendance. Check if roll numbers are valid.' });
    } finally {
        client.release();
    }
});

app.get('/api/attendance', async (req, res) => {
    let { division, date } = req.query;
    let query = 'SELECT * FROM lectures';
    const params = [];
    if (division && division !== 'ALL' || date) {
        query += ' WHERE ';
        let conditions = [];
        if (division && division !== 'ALL') {
            params.push(division);
            conditions.push(`division = $${params.length}`);
        }
        if (date) {
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

app.post('/api/attendance/remove', async (req, res) => {
    const { date, time_slot, roll_no, division } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const lectureRes = await client.query('SELECT id FROM lectures WHERE date = $1 AND time_slot = $2 AND division = $3', [date, time_slot, division]);
        if (lectureRes.rows.length === 0) {
            return res.status(404).json({ message: 'No lecture found for that specific criteria.' });
        }
        const lectureId = lectureRes.rows[0].id;
        const studentRollNoInt = parseInt(roll_no, 10);
        const deleteRes = await client.query('DELETE FROM attendance_records WHERE lecture_id = $1 AND student_roll_no = $2 AND division = $3', [lectureId, studentRollNoInt, division]);
        await client.query(`UPDATE lectures SET absent_roll_nos = array_remove(absent_roll_nos, $1) WHERE id = $2`, [studentRollNoInt, lectureId]);
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

app.delete('/api/lectures/:id', async (req, res) => {
    const { id } = req.params;
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