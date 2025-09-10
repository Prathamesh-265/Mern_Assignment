# MERN Intern Assignment (Express + SQLite + React via CDN)

## What this delivers
- JWT authentication (signup/login) with bcrypt-hashed passwords.
- Roles: Admin and Student.
- Admin dashboard: view/add/edit/delete student records.
- Student dashboard: view and update own profile.
- Single localhost: Express serves both API and frontend static files (no separate dev server needed).
- SQLite used as the database (file-based, no external DB required).
- Seeded admin account: **admin@example.com / admin123**

## Run locally
1. Ensure Node.js (>=14) is installed.
2. Extract the zip.
3. In project root:
   ```bash
   npm install
   npm start
   ```
4. Open browser to `http://localhost:5000`

## Notes
- Frontend is a lightweight React SPA using CDN so there's no build step — convenient for the single-host requirement.
- JWT secret can be customized by setting `JWT_SECRET` environment variable.
