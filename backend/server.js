/**
 * Jubba International University - Backend Server
 * File: backend/server.js
 */

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(cors({
    origin: ["http://localhost:3000", "http://localhost:5500", "http://127.0.0.1:5500"],
    credentials: true
}));
app.use(helmet({ contentSecurityPolicy: false }));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { message: "Too many requests. Please try again later." }
});
app.use("/api/", apiLimiter);

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://hoyo:0987@cluster0.hsrxvv4.mongodb.net/jubba_system?retryWrites=true&w=majority&appName=Cluster0";
const JWT_SECRET = process.env.JWT_SECRET || "jubba_university_secret";

mongoose.connect(MONGO_URI)
    .then(() => console.log("MongoDB connected successfully"))
    .catch(err => console.error("Database connection error:", err));

// --- Schemas ---

const resultSchema = new mongoose.Schema({
    subject: { type: String, required: true },
    credit: { type: Number, required: true },
    midterm: { type: Number, default: 0, min: 0, max: 40 },
    final: { type: Number, default: 0, min: 0, max: 60 },
    total: { type: Number, default: 0 },
    grade: { type: String, default: "Pending" },
    semester: { type: Number, required: true }
});

const studentSchema = new mongoose.Schema({
    fullname: { type: String, required: true },
    studentId: { type: String, required: true, unique: true },
    faculty: { type: String, required: true },
    department: { type: String, required: true },
    semester: { type: Number, required: true },
    password: { type: String, required: true },
    role: { type: String, default: "student" },
    results: [resultSchema]
}, { timestamps: true });

const Student = mongoose.model("Student", studentSchema);

const adminSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "admin" }
});

const Admin = mongoose.model("Admin", adminSchema);

// --- Grade Calculation ---

function calculateGradeAndPoints(midterm, final, isFinalSubmitted) {
    const total = (midterm || 0) + (final || 0);
    let grade = "F", points = 0.0;

    if (!isFinalSubmitted || final === 0) {
        return { total, grade: "Incomplete", points: 0.0 };
    }

    if (total >= 90) { grade = "A"; points = 4.0; }
    else if (total >= 85) { grade = "B+"; points = 3.5; }
    else if (total >= 80) { grade = "B"; points = 3.0; }
    else if (total >= 75) { grade = "C+"; points = 2.5; }
    else if (total >= 70) { grade = "C"; points = 2.0; }
    else if (total >= 65) { grade = "D+"; points = 1.5; }
    else if (total >= 60) { grade = "D"; points = 1.0; }

    return { total, grade, points };
}

function calculateGPA(results, targetedSemester = null) {
    let filtered = (results || []).filter(r => r.grade !== "Incomplete");

    if (targetedSemester) {
        filtered = filtered.filter(r => r.semester === parseInt(targetedSemester));
    }

    if (filtered.length === 0) return 0.00;

    let totalCredits = 0;
    let totalEarnedPoints = 0;

    filtered.forEach(r => {
        const { points } = calculateGradeAndPoints(r.midterm, r.final, r.final > 0);
        totalCredits += r.credit;
        totalEarnedPoints += points * r.credit;
    });

    return totalCredits === 0 ? 0.00 : parseFloat((totalEarnedPoints / totalCredits).toFixed(2));
}

// --- Middleware ---

const verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(403).json({ message: "No authentication token provided." });
    }

    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ message: "Invalid or expired token." });
        req.user = decoded;
        next();
    });
};

const verifyAdmin = (req, res, next) => {
    verifyToken(req, res, () => {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Admin only." });
        }
        next();
    });
};

// --- Routes ---

app.post("/api/auth/login", async (req, res) => {
    try {
        const { studentId, password } = req.body;
        if (!studentId || !password) {
            return res.status(400).json({ message: "Student ID and password are required." });
        }

        const student = await Student.findOne({ studentId: studentId.trim() });
        if (!student) return res.status(404).json({ message: "Student not found." });

        const isMatch = await bcrypt.compare(password, student.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials." });

        const token = jwt.sign(
            { id: student._id, studentId: student.studentId, role: "student" },
            JWT_SECRET,
            { expiresIn: "4h" }
        );

        res.json({
            token,
            role: "student",
            user: { id: student._id, studentId: student.studentId, fullname: student.fullname }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error during login." });
    }
});

app.post("/api/auth/admin-login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ message: "Username and password are required." });
        }

        const admin = await Admin.findOne({ username: username.trim() });
        if (!admin) return res.status(404).json({ message: "Admin not found." });

        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials." });

        const token = jwt.sign(
            { id: admin._id, username: admin.username, role: "admin" },
            JWT_SECRET,
            { expiresIn: "4h" }
        );

        res.json({
            token,
            role: "admin",
            user: { username: admin.username }
        });
    } catch (err) {
        res.status(500).json({ message: "Server error during login." });
    }
});

app.get("/api/students", verifyAdmin, async (req, res) => {
    try {
        const { search, semester } = req.query;
        const query = {};

        if (search) {
            query.$or = [
                { fullname: { $regex: search, $options: "i" } },
                { studentId: { $regex: search, $options: "i" } }
            ];
        }
        if (semester) query.semester = parseInt(semester);

        const students = await Student.find(query).select("-password").sort({ createdAt: -1 });
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch students." });
    }
});

app.get("/api/students/:id", verifyToken, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid student ID format." });
        }

        const student = await Student.findById(req.params.id).select("-password");
        if (!student) return res.status(404).json({ message: "Student not found." });

        const studentObj = student.toObject();
        studentObj.semesterGPA = calculateGPA(student.results, student.semester);
        studentObj.overallGPA = calculateGPA(student.results);
        res.json(studentObj);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch student data." });
    }
});

app.post("/api/students", verifyAdmin, async (req, res) => {
    try {
        const { fullname, studentId, faculty, department, semester, password } = req.body;

        if (!fullname || !studentId || !faculty || !department || !semester) {
            return res.status(400).json({ message: "All required fields must be provided." });
        }

        const exists = await Student.findOne({ studentId: studentId.trim() });
        if (exists) return res.status(400).json({ message: "This Student ID is already registered." });

        const hashedPassword = await bcrypt.hash(password || "jiu12345", 10);
        const newStudent = new Student({
            fullname: fullname.trim(),
            studentId: studentId.trim(),
            faculty: faculty.trim(),
            department: department.trim(),
            semester: parseInt(semester),
            password: hashedPassword,
            results: []
        });

        await newStudent.save();
        res.status(201).json({ message: "Student created successfully." });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: "This Student ID is already registered." });
        }
        res.status(500).json({ message: "Failed to create student." });
    }
});

app.put("/api/students/:id", verifyAdmin, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid student ID format." });
        }

        const { fullname, faculty, department, semester } = req.body;
        const updateData = {};
        if (fullname) updateData.fullname = fullname.trim();
        if (faculty) updateData.faculty = faculty.trim();
        if (department) updateData.department = department.trim();
        if (semester) updateData.semester = parseInt(semester);

        const student = await Student.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!student) return res.status(404).json({ message: "Student not found." });

        res.json({ message: "Student updated successfully." });
    } catch (err) {
        res.status(500).json({ message: "Failed to update student." });
    }
});

app.delete("/api/students/:id", verifyAdmin, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: "Invalid student ID format." });
        }

        const student = await Student.findByIdAndDelete(req.params.id);
        if (!student) return res.status(404).json({ message: "Student not found." });

        res.json({ message: "Student deleted successfully." });
    } catch (err) {
        res.status(500).json({ message: "Failed to delete student." });
    }
});

app.post("/api/results/add", verifyAdmin, async (req, res) => {
    try {
        const { studentObjId, subject, credit, midterm, final, semester } = req.body;

        if (!studentObjId || !subject || !credit || !semester) {
            return res.status(400).json({ message: "Student ID, subject, credits, and semester are required." });
        }

        if (!mongoose.Types.ObjectId.isValid(studentObjId)) {
            return res.status(400).json({ message: "Invalid student ID format." });
        }

        const student = await Student.findById(studentObjId);
        if (!student) return res.status(404).json({ message: "Student not found." });

        const targetSubject = subject.trim().toLowerCase();
        const targetSemester = parseInt(semester);

        // Find existing entry for upsert
        const existing = student.results.find(r =>
            r.subject.trim().toLowerCase() === targetSubject && r.semester === targetSemester
        );

        const mMark = Math.max(0, Math.min(40, parseFloat(midterm || 0)));
        const fMark = Math.max(0, Math.min(60, parseFloat(final || 0)));

        if (existing) {
            if (mMark > 0) existing.midterm = mMark;
            if (fMark > 0) existing.final = fMark;
            const calc = calculateGradeAndPoints(existing.midterm, existing.final, existing.final > 0);
            existing.total = calc.total;
            existing.grade = calc.grade;
            existing.credit = parseInt(credit);
        } else {
            const calc = calculateGradeAndPoints(mMark, fMark, fMark > 0);
            student.results.push({
                subject: subject.trim(),
                credit: parseInt(credit),
                midterm: mMark,
                final: fMark,
                total: calc.total,
                grade: calc.grade,
                semester: targetSemester
            });
        }

        await student.save();
        res.status(201).json({ message: "Grade saved successfully." });

    } catch (err) {
        res.status(500).json({ message: "Failed to save grade." });
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ message: "Internal server error." });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});