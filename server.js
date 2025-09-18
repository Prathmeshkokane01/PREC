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
    ssl: { rejectUnauthorized: false }
});

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.use('/pending_images', express.static(path.join(__dirname, 'pending_images')));
app.use('/student_images', express.static(path.join(__dirname, 'student_images')));

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

app.post('/api/auth/division-access', (req, res) => {
    const { accessCode } = req.body;
    if (accessCode === DIV_A_ACCESS_CODE) return res.status(200).json({ message: 'Access Granted.', division: 'A' });
    if (accessCode === DIV_B_ACCESS_CODE) return res.status(200).json({ message: 'Access Granted.', division: 'B' });
    res.status(401).json({ message: 'Invalid Division Access Code.' });
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
        if (!teacher) return res.status(401).json({ message: 'Invalid email or password.' });
        if (teacher.status === 'pending') return res.status(403).json({ message: 'Your account has not been verified by the HOD.' });
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
    } catch (error) { res.status(500).json({ message: 'Failed to fetch pending teachers.' }); }
});

app.put('/api/teachers/verify/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query("UPDATE teachers SET status = 'verified' WHERE id = $1", [id]);
        res.status(200).json({ message: 'Teacher verified successfully.' });
    } catch (error) { res.status(500).json({ message: 'Failed to verify teacher.' }); }
});

app.get('/api/teachers/status', async (req, res) => {
    try {
        const result = await pool.query("SELECT name, last_login FROM teachers WHERE status = 'verified'");
        const activeThreshold = 5 * 60 * 1000;
        const statuses = result.rows.map(teacher => {
            if (!teacher.last_login) return { name: teacher.name, isActive: false };
            const isActive = (new Date().getTime() - new Date(teacher.last_login).getTime()) < activeThreshold;
            return { name: teacher.name, isActive };
        });
        res.json(statuses);
    } catch (error) { res.status(500).json({ message: 'Failed to fetch teacher statuses.' }); }
});

// --- STUDENT REGISTRATION AND VERIFICATION ---
app.post('/api/students/register', upload.single('student_image'), async (req, res) => {
    const { name, division, roll_no, phone_no, password } = req.body;
    if (!req.file) return res.status(400).json({ message: 'A photo is required for registration.' });
    
    const tempPath = req.file.path;
    const finalPendingPath = path.join('pending_images', req.file.filename);

    try {
        const studentCheck = await pool.query('SELECT * FROM students WHERE division = $1 AND roll_no = $2', [division, roll_no]);
        if (studentCheck.rows.length > 0) {
            fs.unlinkSync(tempPath);
            return res.status(400).json({ message: 'A student with this Roll Number is already registered.' });
        }
        
        fs.renameSync(tempPath, finalPendingPath);
        
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        await pool.query(
            'INSERT INTO students (name, division, roll_no, phone_no, password_hash, status, photo_path) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [name, division, roll_no, phone_no, passwordHash, 'pending', finalPendingPath]
        );
        res.status(201).json({ message: 'Registration submitted! Please wait for a teacher to verify your account.' });
    } catch (error) {
        fs.unlink(tempPath, () => {});
        fs.unlink(finalPendingPath, () => {});
        console.error('Student registration error:', error);
        res.status(500).json({ message: 'Registration failed. The phone number might already be in use.' });
    }
});

app.get('/api/students/pending', async (req, res) => {
    const { division } = req.query;
    if (!division) return res.status(400).json({ message: 'Division is required.' });
    try {
        const result = await pool.query("SELECT id, name, division, roll_no, photo_path FROM students WHERE status = 'pending' AND division = $1 ORDER BY id ASC", [division]);
        res.json(result.rows);
    } catch (error) { res.status(500).json({ message: 'Failed to fetch pending students.' }); }
});

app.put('/api/students/verify/:id', async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const studentRes = await client.query('SELECT * FROM students WHERE id = $1 FOR UPDATE', [id]);
        if (studentRes.rows.length === 0) throw new Error('Student not found.');
        
        const student = studentRes.rows[0];
        const pendingPhotoPath = student.photo_path;
        if (!fs.existsSync(pendingPhotoPath)) throw new Error('Pending photo not found.');

        const finalPhotoDir = path.join('student_images', student.division);
        if (!fs.existsSync(finalPhotoDir)) fs.mkdirSync(finalPhotoDir, { recursive: true });
        
        const finalPhotoPath = path.join(finalPhotoDir, `${student.roll_no}${path.extname(pendingPhotoPath)}`);
        
        fs.renameSync(pendingPhotoPath, finalPhotoPath);
        
        await client.query("UPDATE students SET status = 'verified', photo_path = $1 WHERE id = $2", [finalPhotoPath, id]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'Student verified successfully.' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Error verifying student:", error);
        res.status(500).json({ message: 'Failed to verify student.' });
    } finally {
        client.release();
    }
});

app.put('/api/students/reject/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const studentRes = await pool.query('SELECT photo_path FROM students WHERE id = $1', [id]);
        if (studentRes.rows.length > 0 && studentRes.rows[0].photo_path) {
            fs.unlink(studentRes.rows[0].photo_path, (err) => {
                if(err) console.error("Could not delete rejected photo:", err);
            });
        }
        await pool.query('DELETE FROM students WHERE id = $1', [id]);
        res.status(200).json({ message: 'Student registration rejected and removed.' });
    } catch (error) {
        console.error("Error rejecting student:", error);
        res.status(500).json({ message: 'Failed to reject student.' });
    }
});

app.post('/api/students/login', async (req, res) => {
    const { phone_no, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM students WHERE phone_no = $1', [phone_no]);
        const student = result.rows[0];
        if (!student || !student.password_hash) return res.status(401).json({ message: 'Invalid phone number or password.' });
        if (student.status === 'pending') return res.status(403).json({ message: 'Your registration is still pending verification.' });
        const isMatch = await bcrypt.compare(password, student.password_hash);
        if (isMatch) {
            await pool.query('UPDATE students SET last_login = NOW() WHERE phone_no = $1', [phone_no]);
            res.status(200).json({ message: 'Login successful!', division: student.division, roll_no: student.roll_no });
        } else {
            res.status(401).json({ message: 'Invalid phone number or password.' });
        }
    } catch (error) {
        console.error('Student login error:', error);
        res.status(500).json({ message: 'An error occurred during login.' });
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
        const attendanceRes = await client.query('SELECT student_roll_no, division, date FROM attendance_records WHERE division = $1 AND date >= $2', [division, sevenDaysAgo]);
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

app.post('/api/attendance/upload', 
    upload.fields([{ name: 'attendance_video', maxCount: 1 }, { name: 'attendance_photos', maxCount: 6 }]), 
    async (req, res) => {
    const { date, division, subject, topic, teacher_name, time_slot, type } = req.body;
    let filePaths = [], uploadType = '';
    if (req.files['attendance_video']) {
        uploadType = 'video';
        filePaths.push(req.files['attendance_video'][0].path);
    } else if (req.files['attendance_photos']) {
        uploadType = 'photos';
        req.files['attendance_photos'].forEach(file => filePaths.push(file.path));
    } else {
        return res.status(400).json({ message: 'No video or photos uploaded.' });
    }
    const pythonProcess = spawn('python', ['ai_processor.py', 'attendance', uploadType, division, ...filePaths]);
    let recognizedRollNos = [], errorOutput = '';
    pythonProcess.stdout.on('data', data => {
        try { recognizedRollNos = JSON.parse(data.toString()); } catch(e) { errorOutput += data.toString(); }
    });
    pythonProcess.stderr.on('data', data => errorOutput += data.toString());
    pythonProcess.on('close', async (code) => {
        filePaths.forEach(path => fs.unlink(path, err => { if (err) console.error("Failed to delete temp file:", path); }));
        if (code !== 0 || !Array.isArray(recognizedRollNos)) {
            console.error(`Python script error: ${errorOutput}`);
            return res.status(500).json({ message: 'AI processing failed.' });
        }
        const client = await pool.connect();
        try {
            const studentRes = await client.query("SELECT roll_no FROM students WHERE division = $1 AND status = 'verified'", [division]);
            const allRollNos = studentRes.rows.map(s => s.roll_no);
            const absentRollNos = allRollNos.filter(roll_no => !recognizedRollNos.includes(roll_no));
            await client.query('BEGIN');
            const lectureRes = await client.query(`INSERT INTO lectures (date, division, subject, topic, teacher_name, time_slot, type, absent_roll_nos) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;`, [date, division, subject, topic, teacher_name, time_slot, type, absentRollNos]);
            const lectureId = lectureRes.rows[0].id;
            for (const roll_no of absentRollNos) {
                await client.query(`INSERT INTO attendance_records (lecture_id, student_roll_no, division, date) VALUES ($1, $2, $3, $4);`, [lectureId, roll_no, division, date]);
            }
            await client.query('COMMIT');
            res.status(201).json({ message: `Attendance submitted! Present: ${recognizedRollNos.length}, Absent: ${absentRollNos.length}` });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error submitting AI attendance:', error);
            res.status(500).json({ message: 'Failed to save attendance after AI processing.' });
        } finally {
            client.release();
        }
    });
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
        if (lectureRes.rows.length === 0) return res.status(404).json({ message: 'No lecture found for that specific criteria.' });
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

app.get('/api/hod/student-dashboard', async (req, res) => {
    const { division, startDate, endDate } = req.query;
    const subjects = ['DS', 'OOPCG', 'ELE DF', 'OS', 'DELD', 'UHV', 'ED', 'DSL', 'CEP'];
    let studentQuery = "SELECT id, name, division, roll_no FROM students WHERE status = 'verified'";
    const studentParams = [];
    if (division && division !== 'ALL') {
        studentParams.push(division);
        studentQuery += ` AND division = $${studentParams.length}`;
    }
    studentQuery += " ORDER BY division, roll_no";
    try {
        const studentsRes = await pool.query(studentQuery, studentParams);
        const students = studentsRes.rows;
        const lecturesRes = await pool.query("SELECT id, subject, division, absent_roll_nos FROM lectures WHERE date >= $1 AND date <= $2", [startDate, endDate]);
        const lectures = lecturesRes.rows;
        const report = students.map(student => {
            const studentReport = { roll_no: student.roll_no, name: student.name, division: student.division, subject_avg: {}, total_avg: 0 };
            let totalLecturesAttended = 0, totalLecturesHeld = 0;
            subjects.forEach(subject => {
                const relevantLectures = lectures.filter(lec => lec.subject === subject && lec.division === student.division);
                const lecturesHeld = relevantLectures.length;
                if (lecturesHeld === 0) return studentReport.subject_avg[subject] = 'N/A';
                const absences = relevantLectures.filter(lec => lec.absent_roll_nos.includes(student.roll_no)).length;
                const attended = lecturesHeld - absences;
                const percentage = (attended / lecturesHeld) * 100;
                studentReport.subject_avg[subject] = percentage.toFixed(1);
                totalLecturesAttended += attended;
                totalLecturesHeld += lecturesHeld;
            });
            studentReport.total_avg = (totalLecturesHeld > 0) ? ((totalLecturesAttended / totalLecturesHeld) * 100).toFixed(1) : 'N/A';
            return studentReport;
        });
        res.json(report);
    } catch (error) {
        console.error("Error generating HOD student dashboard:", error);
        res.status(500).json({ message: 'Failed to generate student dashboard report.' });
    }
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});