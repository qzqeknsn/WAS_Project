# CyberState University Portal (Vulnerable App)

![Security Level: Critical](https://img.shields.io/badge/Security_Level-Critical-red) ![Type: Educational](https://img.shields.io/badge/Purpose-Educational-blue)

A professionally designed, **intentionally vulnerable** web application for cybersecurity training.
This project simulates a university portal (`CyberState University`) with a premium "Commercial-Grade" UI, hiding serious security flaws under the hood.

> **⚠️ WARNING**: Do not host this application on a public server. It contains deliberate Remote Code Execution (RCE) and other critical vulnerabilities.

## 🌟 Features
*   **Premium UI**:
    *   Bootstrap 5 Dark Mode & Light Mode themes.
    *   Single-Page Dashboard with smooth scrolling.
    *   Interactive "Hacker-style" Admin Terminal.
*   **Mock Data**: Realistic courses, grades, and schedules.
*   **Tech Stack**: Node.js, Express, EJS, SQLite, Cookie-Parser.

## 🔓 Implemented Vulnerabilities

### 1. Broken Authentication (Insecure Cookie) 🍪
*   **Description**: The application uses a base64-encoded JSON cookie (`session_data`) to manage sessions. It is **not signed** and **not encrypted**.
*   **Exploit**: An attacker can decode the cookie, modify `{"role":"user"}` to `{"role":"admin"}`, and re-encode it to bypass authentication checks using the same cookie.
*   **Target**: Access the hidden `/admin/tools` page.

### 2. Remote Code Execution (Command Injection) 💥
*   **Description**: The "Network Diagnostics" tool (Ping Utility) in the Admin Panel takes user input (IP Address) and passes it directly to the system shell via `child_process.exec`.
*   **Exploit**: An attacker can append system commands using separators like `;` or `&&` (e.g., `8.8.8.8; ls -la`).
*   **Target**: Execute arbitrary commands on the server.

### 3. Stored XSS (Cross-Site Scripting) 🪤
*   **Description**: The "Student Community Forum" on the Dashboard allows users to post anonymous comments. The input is stored in memory and rendered **without escaping** (`<%- comment %>`).
*   **Exploit**: An attacker can inject malicious JavaScript (`<script>...`) which will execute in the browser of any user (including Admins) who views the dashboard.
*   **Target**: Session hijacking, redirection, or defacement.

---

## 🚀 Setup & Run

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start the Server**:
    ```bash
    node server.js
    ```

3.  **Access the Portal**:
    *   Open `http://localhost:3000`.
    *   **Student Credentials**:
        *   Username: `student`
        *   Password: `student123`

---

## 🕵️‍♂️ Hacking Guide
Detailed step-by-step instructions for exploiting these vulnerabilities can be found in `hacking_guide_advanced.md`.

---

## © License
This project is for educational purposes only.
**CyberState University** - "Secure Systems for a Secure Future".
