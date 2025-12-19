const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'super_secret_insecure_key',
    resave: false,
    saveUninitialized: true
}));

// Database Setup
const db = new sqlite3.Database(':memory:'); // In-memory DB for easy setup

function setupDB() {
    db.serialize(() => {
        // Create Users Table
        db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT)");

        // Insert Users (Passwords in plaintext as requested)
        const users = [
            ['admin', 'admin123', 'admin'],
            ['student1', '12345', 'student'], // ID will be 2
            ['student2', 'qwerty', 'student'] // ID will be 3
        ];

        const stmt = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
        users.forEach(user => stmt.run(user));
        stmt.finalize();

        // Create Grades Table
        db.run("CREATE TABLE grades (id INTEGER PRIMARY KEY, student_id INTEGER, subject TEXT, score INTEGER)");

        // Insert Grades
        const grades = [
            [2, 'Math', 95],
            [2, 'Physics', 88],
            [2, 'History', 90],
            [3, 'Math', 70],
            [3, 'Physics', 65],
            [3, 'Chemistry', 82]
        ];

        const gradeStmt = db.prepare("INSERT INTO grades (student_id, subject, score) VALUES (?, ?, ?)");
        grades.forEach(grade => gradeStmt.run(grade));
        gradeStmt.finalize();

        console.log("Database initialized with test data.");
    });
}

setupDB();

// Routes

app.get('/', (req, res) => {
    res.redirect('/login');
});

// LOGIN - GET
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// LOGIN - POST with SQL Injection FIXED
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // SECURITY FIX: Use parameterized queries (Prepared Statements)
    // This prevents SQL Injection by treating inputs as data, not executable code
    const sql = "SELECT * FROM users WHERE username = ? AND password = ?";

    // Log safe version for debugging
    console.log(`Attempting login for user: ${username}`);

    db.get(sql, [username, password], (err, row) => {
        if (err) {
            console.error(err);
            return res.render('login', { error: "Database error" });
        }

        if (row) {
            // Login successful
            req.session.user = { id: row.id, username: row.username, role: row.role };
            res.redirect('/dashboard');
        } else {
            res.render('login', { error: "Invalid credentials" });
        }
    });
});

// Dashboard with Reflected XSS Vulnerability
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    // The 'q' parameter is passed to the view
    // The FIX involves changing how it is rendered in the EJS template (using <%= %> instead of <%- %>)
    const query = req.query.q;
    res.render('dashboard', { user: req.session.user, query: query });
});

// Grades with IDOR Vulnerability FIXED
app.get('/grades', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    // SECURITY FIX: Access Control Check
    // We check if the requested student_id matches the logged-in user's ID.
    // (In a real app, Admins might be allowed to view others, but here we enforce strict ownership)

    let requestedId = req.query.student_id ? parseInt(req.query.student_id) : req.session.user.id;
    const currentUserId = req.session.user.id;

    if (requestedId !== currentUserId) {
        // Simple Access Denied
        return res.status(403).send("<h1>403 Forbidden</h1><p>You are not authorized to view these grades.</p><a href='/dashboard'>Back to Dashboard</a>");
    }

    const sql = "SELECT * FROM grades WHERE student_id = ?";

    db.all(sql, [requestedId], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Database error");
        }
        res.render('grades', { grades: rows, student_id: requestedId });
    });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
