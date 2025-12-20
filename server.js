const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

// === НАСТРОЙКИ ===
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// === БАЗА ДАННЫХ (В памяти) ===
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    // 1. Таблица Пользователей
    db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, role TEXT)");

    const stmt = db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)");
    stmt.run("student", "student123", "user");
    stmt.run("admin", "admin_super_secret", "admin");
    stmt.finalize();

    // 2. Таблица Комментариев
    db.run("CREATE TABLE comments (id INTEGER PRIMARY KEY, author TEXT, text TEXT, date TEXT)");

    // ИСПРАВЛЕНО: Теперь вставляем данные безопасно через stmt.run
    const commentStmt = db.prepare("INSERT INTO comments (author, text, date) VALUES (?, ?, ?)");
    commentStmt.run('Alice', 'Does anyone have notes for Cryptography 101?', '2025-12-19 10:00');
    commentStmt.run('Bob', "Don't forget the deadline for the final project!", '2025-12-19 12:30');
    commentStmt.finalize();

    console.log(">>> Database initialized with mock data.");
});

// === C2 SERVER STORAGE (KILLER FEATURE) ===
const stolenData = [];

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function getUserFromCookie(req) {
    if (!req.cookies.session_data) return null;
    try {
        const base64Data = req.cookies.session_data;
        const jsonData = Buffer.from(base64Data, 'base64').toString('utf-8');
        return JSON.parse(jsonData);
    } catch (e) {
        return null;
    }
}

// === РОУТЫ ===

app.get('/', (req, res) => {
    const user = getUserFromCookie(req);
    if (user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, row) => {

        // --- ХАКЕРСКОЕ ИЗМЕНЕНИЕ НАЧАЛО ---
        // Логируем ВСЕ попытки (и удачные, и нет)
        stolenData.unshift({
            time: new Date().toLocaleTimeString(),
            ip: req.ip,
            type: row ? 'SUCCESS_LOGIN' : 'FAILED_LOGIN', // Если row есть - успех, если нет - провал
            data: `User: ${username} | Pass: ${password}`
        });
        // --- ХАКЕРСКОЕ ИЗМЕНЕНИЕ КОНЕЦ ---

        if (row) {
            // Успешный вход
            const sessionObj = { username: row.username, role: row.role };
            const cookieValue = Buffer.from(JSON.stringify(sessionObj)).toString('base64');
            res.cookie('session_data', cookieValue, { httpOnly: false });
            res.redirect('/dashboard');
        } else {
            // Ошибка входа
            res.render('login', { error: "Invalid username or password" });
        }
    });
});

app.get('/logout', (req, res) => {
    res.clearCookie('session_data');
    res.redirect('/login');
});

// === C2 SPY ROUTES ===

// 1. Шпионский роут (принимает данные скрытно)
app.get('/steal', (req, res) => {
    const { data, type } = req.query;
    if (data) {
        stolenData.unshift({
            time: new Date().toLocaleTimeString(),
            ip: req.ip,
            type: type || 'UNKNOWN',
            data: data
        });
    }
    // Возвращаем "Ничего" (204 No Content), чтобы жертва не заметила подвоха
    res.status(204).send();
});

// 2. Панель Хакера (Dark Web Interface)
app.get('/darkweb', (req, res) => {
    let rows = stolenData.map(item => `
        <tr>
            <td>${item.time}</td>
            <td>${item.ip}</td>
            <td style="color: #0f0;">${item.type}</td>
            <td style="color: #fff;">${item.data}</td>
        </tr>
    `).join('');

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>C2 SERVER :: ACCESS TERMINAL</title>
        <meta http-equiv="refresh" content="2"> <!-- Auto-refresh every 2s -->
        <style>
            body { background-color: #000; color: #00ff00; font-family: 'Courier New', monospace; padding: 20px; }
            h1 { border-bottom: 2px solid #00ff00; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #333; padding: 10px; text-align: left; }
            th { color: #fff; background: #111; }
            .blink { animation: blinker 1s linear infinite; }
            @keyframes blinker { 50% { opacity: 0; } }
            .header { display: flex; justify-content: space-between; align-items: center; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>💀 C2 SERVER :: CREDENTIAL HARVESTER</h1>
            <div class="blink">[LISTENING...]</div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>TIME</th>
                    <th>IP ADDRESS</th>
                    <th>EVENT TYPE</th>
                    <th>CAPTURED DATA</th>
                </tr>
            </thead>
            <tbody>
                ${rows.length > 0 ? rows : '<tr><td colspan="4" style="text-align:center; color:#555;">...WAITING FOR INCOMING DATA...</td></tr>'}
            </tbody>
        </table>
    </body>
    </html>
    `;
    res.send(html);
});

app.get('/dashboard', (req, res) => {
    const user = getUserFromCookie(req);
    if (!user) return res.redirect('/login');

    db.all("SELECT * FROM comments ORDER BY id DESC", (err, rows) => {
        res.render('dashboard', { user: user, comments: rows });
    });
});

app.post('/dashboard/comment', (req, res) => {
    const user = getUserFromCookie(req);
    if (!user) return res.redirect('/login');

    const text = req.body.comment; // Frontend uses name="comment"
    const date = new Date().toLocaleString();

    // УЯЗВИМОСТЬ: STORED XSS (Вставка без проверки)
    const stmt = db.prepare("INSERT INTO comments (author, text, date) VALUES (?, ?, ?)");
    stmt.run(user.username, text, date, () => {
        res.redirect('/dashboard#news');
    });
    stmt.finalize();
});

app.get('/admin/tools', (req, res) => {
    const user = getUserFromCookie(req);

    if (!user || user.role !== 'admin') {
        return res.status(403).send(`
            <h1 style="color:red; text-align:center; margin-top:50px;">ACCESS DENIED</h1>
            <p style="text-align:center;">You are logged in as <b>${user ? user.username : 'Guest'}</b>.</p>
            <p style="text-align:center;">Administrator privileges required.</p>
            <center><a href="/dashboard">Go Back</a></center>
        `);
    }
    res.render('admin', { output: null });
});

app.post('/admin/ping', (req, res) => {
    const user = getUserFromCookie(req);
    if (!user || user.role !== 'admin') return res.status(403).send("Access Denied");

    const ip = req.body.ip;

    // УЯЗВИМОСТЬ: RCE (Command Injection)
    // Внимание: Если ты на Windows, раскомментируй строку ниже, а верхнюю закомментируй
    const command = `ping -c 2 ${ip}`; // MAC/LINUX
    // const command = `ping -n 2 ${ip}`; // WINDOWS

    console.log(`Executing: ${command}`);

    exec(command, (error, stdout, stderr) => {
        const result = stdout || stderr || error.message;
        res.render('admin', { output: result });
    });
});

app.listen(PORT, () => {
    console.log(`\n>>> CyberState University Portal is running!`);
    console.log(`>>> URL: http://localhost:${PORT}`);
    console.log(`>>> Login as student / student123\n`);
});