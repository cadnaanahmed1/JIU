// ... (all your existing code above) ...

// --- EDIT RESULT ---
app.put("/api/results/:studentId/:index", verifyAdmin, async (req, res) => {
    try {
        const { studentId, index } = req.params;
        const { subject, credit, midterm, final, semester } = req.body;

        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({ message: "Invalid student ID format." });
        }

        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: "Student not found." });

        if (!student.results[parseInt(index)]) {
            return res.status(404).json({ message: "Grade record not found." });
        }

        const result = student.results[parseInt(index)];
        if (subject) result.subject = subject.trim();
        if (credit) result.credit = parseInt(credit);
        if (semester) result.semester = parseInt(semester);
        if (midterm !== undefined) result.midterm = Math.max(0, Math.min(40, parseFloat(midterm)));
        if (final !== undefined) result.final = Math.max(0, Math.min(60, parseFloat(final)));

        const calc = calculateGradeAndPoints(result.midterm, result.final, result.final > 0);
        result.total = calc.total;
        result.grade = calc.grade;

        await student.save();
        res.json({ message: "Grade updated successfully." });

    } catch (err) {
        res.status(500).json({ message: "Failed to update grade." });
    }
});

// --- DELETE RESULT ---
app.delete("/api/results/:studentId/:index", verifyAdmin, async (req, res) => {
    try {
        const { studentId, index } = req.params;

        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({ message: "Invalid student ID format." });
        }

        const student = await Student.findById(studentId);
        if (!student) return res.status(404).json({ message: "Student not found." });

        if (!student.results[parseInt(index)]) {
            return res.status(404).json({ message: "Grade record not found." });
        }

        student.results.splice(parseInt(index), 1);
        await student.save();
        res.json({ message: "Grade deleted successfully." });

    } catch (err) {
        res.status(500).json({ message: "Failed to delete grade." });
    }
});

// --- RESET STUDENT PASSWORD ---
app.put("/api/students/reset-password", verifyAdmin, async (req, res) => {
    try {
        const { studentId, newPassword } = req.body;

        if (!studentId || !newPassword) {
            return res.status(400).json({ message: "Student ID and new password are required." });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters." });
        }

        const student = await Student.findOne({ studentId: studentId.trim() });
        if (!student) return res.status(404).json({ message: "Student not found." });

        student.password = await bcrypt.hash(newPassword, 10);
        await student.save();
        res.json({ message: "Password reset successfully." });

    } catch (err) {
        res.status(500).json({ message: "Failed to reset password." });
    }
});

// --- Catch-all for SPA ---
app.get("*", (req, res) => {
    const indexPath = path.join(frontendDir, "index.html");
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).json({ message: "Not found." });
    }
});

// --- Global error handler (MUST BE LAST) ---
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err.message);
    res.status(500).json({ message: "Internal server error." });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
