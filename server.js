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
            fs.unlinkSync(tempPath); // Clean up temp file
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
    // ... (This function remains the same as your original)
});

app.post('/api/attendance/upload', 
    upload.fields([{ name: 'attendance_video', maxCount: 1 }, { name: 'attendance_photos', maxCount: 6 }]), 
    async (req, res) => {
    // ... (This function remains the same as your original)
});

app.get('/api/attendance', async (req, res) => {
    // ... (This function remains the same as your original)
});

app.post('/api/attendance/remove', async (req, res) => {
    // ... (This function remains the same as your original)
});

app.delete('/api/lectures/:id', async (req, res) => {
    // ... (This function remains the same as your original)
});

app.get('/api/hod/student-dashboard', async (req, res) => {
    // ... (This function remains the same as your original)
});

// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});