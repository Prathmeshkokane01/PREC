// Import required packages
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// --- CONFIGURATION ---
const app = express();
const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;
const HOD_ACCESS_CODE = 'hod123';
const DIV_A_ACCESS_CODE = 'divA2025';
const DIV_B_ACCESS_CODE = 'divB2025';

// --- DIRECTORY SETUP ---
['uploads', 'pending_images', 'student_images', 'student_images/A', 'student_images/B'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- MULTER CONFIG ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// --- DATABASE CONNECTION ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

// --- AUTO-FIX: CREATE TABLES FUNCTION ---
async function initializeDatabase() {
    const queries = `
        CREATE TABLE IF NOT EXISTS teachers (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            last_login TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS students (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            division VARCHAR(5),
            roll_no INTEGER,
            phone_no VARCHAR(15) UNIQUE,
            password_hash VARCHAR(255),
            status VARCHAR(20) DEFAULT 'pending',
            photo_path VARCHAR(255),
            last_login TIMESTAMP,
            UNIQUE(division, roll_no)
        );
        CREATE TABLE IF NOT EXISTS lectures (
            id SERIAL PRIMARY KEY,
            date DATE,
            division VARCHAR(5),
            subject VARCHAR(50),
            topic VARCHAR(255),
            teacher_name VARCHAR(100),
            time_slot VARCHAR(50),
            type VARCHAR(20),
            absent_roll_nos INTEGER[]
        );
        CREATE TABLE IF NOT EXISTS attendance_records (
            id SERIAL PRIMARY KEY,
            lecture_id INTEGER REFERENCES lectures(id) ON DELETE CASCADE,
            student_roll_no INTEGER,
            division VARCHAR(5),
            date DATE
        );
    `;

    try {
        await pool.query(queries);
        console.log(">>> SUCCESS: Database tables verified/created. <<<");
    } catch (error) {
        console.error("!!! DATABASE ERROR: Could not create tables.", error);
    }
}

// Initialize DB on Startup
initializeDatabase();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use('/pending_images', express.static(path.join(__dirname, 'pending_images')));
app.use('/student_images', express.static(path.join(__dirname, 'student_images')));

// --- API ENDPOINTS ---

// HOD Auth
app.post('/api/auth/hod', (req, res) => {
    if (req.body.accessCode === HOD_ACCESS_CODE) res.status(200).json({ message: 'HOD authenticated.' });
    else res.status(401).json({ message: 'Invalid code.' });
});

// Division Auth
app.post('/api/auth/division-access', (req, res) => {
    const { accessCode } = req.body;
    if (accessCode === DIV_A_ACCESS_CODE) return res.status(200).json({ message: 'Access Granted.', division: 'A' });
    if (accessCode === DIV_B_ACCESS_CODE) return res.status(200).json({ message: 'Access Granted.', division: 'B' });
    res.status(401).json({ message: 'Invalid Code.' });
});

// Teacher Routes
app.post('/api/teachers/signup', async (req, res) => {
    try {
        const hash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
        await pool.query('INSERT INTO teachers (name, email, password_hash) VALUES ($1, $2, $3)', [req.body.name, req.body.email, hash]);
        res.status(201).json({ message: 'Signup successful! Wait for verification.' });
    } catch (error) { res.status(500).json({ message: 'Email might be in use.' }); }
});

app.post('/api/teachers/login', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM teachers WHERE email = $1', [req.body.email]);
        const teacher = result.rows[0];
        if (!teacher) return res.status(401).json({ message: 'Invalid credentials.' });
        if (teacher.status === 'pending') return res.status(403).json({ message: 'Account pending HOD verification.' });
        const match = await bcrypt.compare(req.body.password, teacher.password_hash);
        if (match) {
            await pool.query('UPDATE teachers SET last_login = NOW() WHERE id = $1', [teacher.id]);
            res.status(200).json({ message: 'Login successful!', teacher_name: teacher.name });
        } else { res.status(401).json({ message: 'Invalid credentials.' }); }
    } catch (error) { res.status(500).json({ message: 'Login failed.' }); }
});

app.get('/api/teachers/status', async (req, res) => {
    try {
        const result = await pool.query("SELECT name, last_login FROM teachers WHERE status = 'verified'");
        const activeThreshold = 5 * 60 * 1000;
        const statuses = result.rows.map(t => ({
            name: t.name,
            isActive: t.last_login ? (new Date() - new Date(t.last_login) < activeThreshold) : false
        }));
        res.json(statuses);
    } catch (error) { console.error(error); res.status(500).json({ message: 'Failed to fetch statuses.' }); }
});

app.get('/api/teachers/pending', async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name, email FROM teachers WHERE status = 'pending' ORDER BY id ASC");
        res.json(result.rows);
    } catch (error) { res.status(500).json({ message: 'Failed to fetch pending.' }); }
});

app.put('/api/teachers/verify/:id', async (req, res) => {
    try {
        await pool.query("UPDATE teachers SET status = 'verified' WHERE id = $1", [req.params.id]);
        res.json({ message: 'Teacher verified.' });
    } catch (error) { res.status(500).json({ message: 'Verification failed.' }); }
});

// Student Routes
app.post('/api/students/register', upload.single('student_image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Photo required.' });
    const tempPath = req.file.path;
    const finalPendingPath = path.join('pending_images', req.file.filename).replace(/\\/g, "/"); 
    try {
        const check = await pool.query('SELECT * FROM students WHERE division = $1 AND roll_no = $2', [req.body.division, req.body.roll_no]);
        if (check.rows.length > 0) { fs.unlinkSync(tempPath); return res.status(400).json({ message: 'Roll Number exists.' }); }
        fs.renameSync(tempPath, finalPendingPath);
        const hash = await bcrypt.hash(req.body.password, SALT_ROUNDS);
        await pool.query('INSERT INTO students (name, division, roll_no, phone_no, password_hash, status, photo_path) VALUES ($1, $2, $3, $4, $5, $6, $7)', [req.body.name, req.body.division, req.body.roll_no, req.body.phone_no, hash, 'pending', finalPendingPath]);
        res.status(201).json({ message: 'Registration submitted.' });
    } catch (error) { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); res.status(500).json({ message: 'Registration failed.' }); }
});

app.get('/api/students/pending', async (req, res) => {
    try {
        const result = await pool.query("SELECT id, name, division, roll_no, photo_path FROM students WHERE status = 'pending' AND division = $1 ORDER BY id ASC", [req.query.division]);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ message: 'Error fetching students.' }); }
});

app.put('/api/students/verify/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const s = (await client.query('SELECT * FROM students WHERE id = $1', [req.params.id])).rows[0];
        if (!s) throw new Error('Student not found');
        const finalDir = path.join('student_images', s.division);
        if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true });
        const finalName = `${s.roll_no}${path.extname(s.photo_path)}`;
        const finalPath = path.join(finalDir, finalName);
        if(fs.existsSync(s.photo_path)) fs.renameSync(s.photo_path, finalPath);
        const webPath = finalPath.replace(/\\/g, "/");
        await client.query("UPDATE students SET status = 'verified', photo_path = $1 WHERE id = $2", [webPath, s.id]);
        await client.query('COMMIT');
        res.json({ message: 'Verified.' });
    } catch (error) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Verify failed.' }); } finally { client.release(); }
});

app.post('/api/students/login', async (req, res) => {
    try {
        const student = (await pool.query('SELECT * FROM students WHERE phone_no = $1', [req.body.phone_no])).rows[0];
        if (!student || !student.password_hash) return res.status(401).json({ message: 'Invalid credentials.' });
        if (student.status === 'pending') return res.status(403).json({ message: 'Pending verification.' });
        if (await bcrypt.compare(req.body.password, student.password_hash)) {
            await pool.query('UPDATE students SET last_login = NOW() WHERE phone_no = $1', [req.body.phone_no]);
            res.json({ message: 'Login success!', division: student.division, roll_no: student.roll_no, photo_path: student.photo_path });
        } else { res.status(401).json({ message: 'Invalid credentials.' }); }
    } catch (e) { res.status(500).json({ message: 'Login error.' }); }
});

app.get('/api/students/:division', async (req, res) => {
    const { division } = req.params;
    const client = await pool.connect();
    try {
        const studentRes = await client.query("SELECT roll_no, name, division, photo_path FROM students WHERE division = $1 AND status = 'verified' ORDER BY roll_no", [division]);
        const students = studentRes.rows;
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(); d.setDate(d.getDate() - i); dates.push(d.toISOString().split('T')[0]);
        }
        dates.reverse();
        const sevenDaysAgo = dates[0]; const today = dates[6];

        const attendanceRes = await client.query('SELECT student_roll_no, date FROM attendance_records WHERE division = $1 AND date >= $2 AND date <= $3', [division, sevenDaysAgo, today]);
        const lectureDatesRes = await client.query("SELECT DISTINCT date FROM lectures WHERE division = $1 AND date >= $2 AND date <= $3", [division, sevenDaysAgo, today]);
        
        const lectureDates = new Set(lectureDatesRes.rows.map(row => new Date(row.date).toISOString().split('T')[0]));
        const absenceMap = {};
        attendanceRes.rows.forEach(row => {
            const dateStr = new Date(row.date).toISOString().split('T')[0];
            if (!absenceMap[row.student_roll_no]) absenceMap[row.student_roll_no] = new Set();
            absenceMap[row.student_roll_no].add(dateStr);
        });

        students.forEach(student => {
            student.attendance = {};
            const studentAbsences = absenceMap[student.roll_no] || new Set();
            dates.forEach(dateStr => {
                if (studentAbsences.has(dateStr)) student.attendance[dateStr] = 'A';
                else if (lectureDates.has(dateStr)) student.attendance[dateStr] = 'P';
                else student.attendance[dateStr] = 'N/A';
            });
        });
        res.json({ students, dates });
    } catch (error) { res.status(500).json({ message: 'Failed to fetch data.' }); } finally { client.release(); }
});

// --- ATTENDANCE ROUTES (The Missing Part) ---

// 1. GET Attendance Records (For HOD Dashboard)
app.get('/api/attendance', async (req, res) => {
    let { division, date } = req.query;
    let query = 'SELECT * FROM lectures';
    const params = [];
    if ((division && division !== 'ALL') || date) {
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
        console.error('Attendance Fetch Error:', error);
        res.status(500).json({ message: 'Failed to fetch records.' });
    }
});

// 2. Upload Attendance (AI Process)
app.post('/api/attendance/upload', upload.any(), async (req, res) => {
    const { division, date, subject, topic, teacher_name, time_slot, type } = req.body;
    if (!req.files || req.files.length === 0) return res.status(400).json({ message: 'No files uploaded.' });

    const filePaths = req.files.map(f => f.path);
    const uploadType = req.files[0].fieldname === 'attendance_video' ? 'video' : 'photos';

    const pythonProcess = spawn('python', ['ai_processor.py', 'attendance', uploadType, division, ...filePaths]);
    let output = '', errOutput = '';

    pythonProcess.stdout.on('data', (data) => output += data.toString());
    pythonProcess.stderr.on('data', (data) => errOutput += data.toString());

    pythonProcess.on('close', async (code) => {
        filePaths.forEach(p => { if(fs.existsSync(p)) fs.unlinkSync(p); });
        if (code !== 0) { console.error("AI Error:", errOutput); return res.status(500).json({ message: 'AI Processing Failed.' }); }

        let presentRolls = [];
        try { presentRolls = JSON.parse(output); } catch (e) { return res.status(500).json({ message: 'Failed to parse AI response.' }); }

        const client = await pool.connect();
        try {
            const allStudents = (await client.query("SELECT roll_no FROM students WHERE division = $1 AND status = 'verified'", [division])).rows.map(s => s.roll_no);
            const absentRolls = allStudents.filter(r => !presentRolls.includes(r));

            await client.query('BEGIN');
            const lec = await client.query(`INSERT INTO lectures (date, division, subject, topic, teacher_name, time_slot, type, absent_roll_nos) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`, [date, division, subject, topic, teacher_name, time_slot, type, absentRolls]);
            for (const r of absentRolls) { await client.query(`INSERT INTO attendance_records (lecture_id, student_roll_no, division, date) VALUES ($1, $2, $3, $4)`, [lec.rows[0].id, r, division, date]); }
            await client.query('COMMIT');
            res.json({ message: `Done! Present: ${presentRolls.length}, Absent: ${absentRolls.length}` });
        } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Database Error.' }); } finally { client.release(); }
    });
});

// 3. Remove Fine/Absence
app.post('/api/attendance/remove', async (req, res) => {
    const { date, time_slot, roll_no, division } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const lec = (await client.query('SELECT id FROM lectures WHERE date = $1 AND time_slot = $2 AND division = $3', [date, time_slot, division])).rows[0];
        if (!lec) return res.status(404).json({ message: 'Lecture not found.' });
        
        await client.query('DELETE FROM attendance_records WHERE lecture_id = $1 AND student_roll_no = $2', [lec.id, roll_no]);
        await client.query(`UPDATE lectures SET absent_roll_nos = array_remove(absent_roll_nos, $1) WHERE id = $2`, [parseInt(roll_no), lec.id]);
        await client.query('COMMIT');
        res.json({ message: 'Fine removed.' });
    } catch (e) { await client.query('ROLLBACK'); res.status(500).json({ message: 'Remove failed.' }); } finally { client.release(); }
});

// 4. Delete Lecture
app.delete('/api/lectures/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM lectures WHERE id = $1', [req.params.id]);
        res.json({ message: 'Deleted.' });
    } catch (e) { res.status(500).json({ message: 'Delete failed.' }); }
});

// 5. HOD Student Stats
app.get('/api/hod/student-dashboard', async (req, res) => {
    const { division, startDate, endDate } = req.query;
    const subjects = ['DS', 'OOPCG', 'ELE DF', 'OS', 'DELD', 'UHV', 'ED', 'DSL', 'CEP'];
    try {
        const students = (await pool.query("SELECT * FROM students WHERE division = $1 AND status = 'verified'", [division])).rows;
        const lectures = (await pool.query("SELECT * FROM lectures WHERE date >= $1 AND date <= $2", [startDate, endDate])).rows;
        
        const report = students.map(s => {
            const rep = { roll_no: s.roll_no, name: s.name, division: s.division, photo_path: s.photo_path, subject_avg: {}, total_avg: 0 };
            let attended = 0, total = 0;
            subjects.forEach(sub => {
                const lecs = lectures.filter(l => l.subject === sub && l.division === s.division);
                if (lecs.length === 0) return rep.subject_avg[sub] = 'N/A';
                const abs = lecs.filter(l => l.absent_roll_nos.includes(s.roll_no)).length;
                const pres = lecs.length - abs;
                rep.subject_avg[sub] = ((pres / lecs.length) * 100).toFixed(1);
                attended += pres; total += lecs.length;
            });
            rep.total_avg = total > 0 ? ((attended / total) * 100).toFixed(1) : 'N/A';
            return rep;
        });
        res.json(report);
    } catch (e) { res.status(500).json({ message: 'Report failed.' }); }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});