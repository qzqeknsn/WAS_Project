# Vulnerable University Portal

This is an intentionally vulnerable Node.js application for educational purposes. It demonstrates SQL Injection, Reflected XSS, and IDOR.

## Setup & Run

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Start Server:**
    ```bash
    node server.js
    ```
    The server will start at `http://localhost:3000`.

## Exploiting Vulnerabilities

### 1. SQL Injection (Login Bypass)
**Goal:** Log in as the first user (admin) without knowing the password.
- Go to `/login`.
- **Username:** `admin` (or any string)
- **Password:** `' OR '1'='1`
- **Result:** The SQL query becomes `... WHERE username = 'admin' AND password = '' OR '1'='1'`, which is always true. You will be logged in as the admin.

### 2. Reflected XSS (Cross-Site Scripting)
**Goal:** Execute arbitrary JavaScript in the victim's browser.
- Log in first.
- Go to `/dashboard`.
- In the search box, enter: `<script>alert('XSS')</script>`
- **Result:** The script executes immediately, popping up an alert box. This happens because the query parameter is rendered raw with `<%- query %>` instead of escaped `<%= query %>`.

### 3. IDOR (Insecure Direct Object Reference)
**Goal:** View grades of another student.
- Log in as `student1` (Password: `12345`).
- Click "My Grades". The URL will be `/grades?student_id=2`.
- Change the URL to `/grades?student_id=3`.
- **Result:** You can see the grades of `student2`, even though you are logged in as `student1`. The server does not check authorization for the requested resource ID.
