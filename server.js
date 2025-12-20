const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser()); // VULNERABILITY: No secret used, so cookies are not signed.

// In-memory "Database"
const comments = []; // For Stored XSS

// VULNERABILITY 1: Broken Authentication (Insecure Cookie)
// Middleware to read session from 'session_data' cookie (Base64 JSON)
// NO INTEGRITY CHECK!
const authMiddleware = (req, res, next) => {
    const sessionCookie = req.cookies.session_data;

    if (sessionCookie) {
        try {
            // Decode Base64 to String
            const jsonStr = Buffer.from(sessionCookie, 'base64').toString('utf-8');
            // Parse JSON
            req.user = JSON.parse(jsonStr);
        } catch (e) {
            console.error("Failed to parse session cookie:", e.message);
            // Incorrect cookie format, user remains undefined
        }
    }
    next();
};

app.use(authMiddleware);

// Routes

app.get('/', (req, res) => {
    if (req.user) {
        return res.redirect('/dashboard');
    }
    res.redirect('/login');
});

// LOGIN - GET
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// LOGIN - POST
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Hardcoded credentials for demo
    // student / student123
    // admin / admin_super_secure_password (Not intended to be guessed, intent is to steal session)

    if (username === 'student' && password === 'student123') {
        // VULNERABILITY: INSECURE COOKIE CREATION
        // We create a JSON object and encode it in Base64.
        // There is NO signature, so the user can edit this on the client side!
        const sessionObj = {
            username: 'student',
            role: 'user' // ATTACK GOAL: Change this to 'admin'
        };
        const sessionStr = JSON.stringify(sessionObj);
        const base64Session = Buffer.from(sessionStr).toString('base64');

        res.cookie('session_data', base64Session, { httpOnly: true }); // httpOnly doesn't stop manual editing in DevTools/Burp
        return res.redirect('/dashboard');
    }

    // For admin login demo (if they knew the pass)
    if (username === 'admin' && password === 'admin_super_secure_password') {
        const sessionObj = { username: 'admin', role: 'admin' };
        const base64Session = Buffer.from(JSON.stringify(sessionObj)).toString('base64');
        res.cookie('session_data', base64Session, { httpOnly: true });
        return res.redirect('/dashboard');
    }

    res.render('login', { error: "Invalid credentials (try: student / student123)" });
});

// DASHBOARD
app.get('/dashboard', (req, res) => {
    if (!req.user) {
        return res.redirect('/login');
    }
    // Render dashboard with user info and comments
    res.render('dashboard', { user: req.user, comments: comments });
});

// LOGOUT
app.get('/logout', (req, res) => {
    res.clearCookie('session_data');
    res.redirect('/login');
});

// VULNERABILITY 2: Stored XSS
app.post('/dashboard/comment', (req, res) => {
    if (!req.user) return res.redirect('/login');

    const { comment } = req.body;
    // Add to array WITHOUT SANITIZATION
    // If comment contains <script>...</script>, it will be served as code.
    if (comment) {
        comments.push({
            author: req.user.username,
            text: comment
        });
    }
    res.redirect('/dashboard');
});

// VULNERABILITY 3: Command Injection (RCE)
// ONLY for Admins
app.get('/admin/tools', (req, res) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).send("<h1>403 Forbidden</h1><p>Access Restricted to Admins.</p>");
    }
    res.render('admin', { output: null });
});

app.post('/admin/ping', (req, res) => {
    // Check Admin Access again
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).send("Forbidden");
    }

    const { ip } = req.body;

    // VULNERABILITY: COMMAND INJECTION
    // We concatenate user input DIRECTLY into a shell command.
    // Platform specific ping count flag (-c for *nix, -n for Windows). assuming Mac/Linux here based on USER_INFO.
    const command = `ping -c 2 ${ip}`;

    console.log(`Executing: ${command}`);

    exec(command, (error, stdout, stderr) => {
        let output = stdout;
        if (error) {
            output += `\nError: ${error.message}`;
        }
        if (stderr) {
            output += `\nStderr: ${stderr}`;
        }
        res.render('admin', { output: output });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
