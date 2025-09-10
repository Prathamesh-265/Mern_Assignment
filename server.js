const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const PORT = process.env.PORT || 5000;
const DB_FILE = path.join(__dirname, 'database.sqlite');

app.use(express.json({ limit: '5mb' })); // built-in body parser

// Serve static frontend
app.use(express.static(path.join(__dirname, 'client')));

// init db
const db = new sqlite3.Database(DB_FILE);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    name TEXT,
    email TEXT,
    course TEXT,
    enrollmentDate TEXT,
    FOREIGN KEY(userId) REFERENCES users(id)
  )`);
});

// helper
function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ message: 'Missing authorization header' });
  const token = auth.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Invalid token format' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Not authenticated' });
    if (req.user.role !== role) return res.status(403).json({ message: 'Forbidden: insufficient role' });
    next();
  };
}

// Routes
app.post('/api/signup', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Missing fields' });
  const hashed = bcrypt.hashSync(password, 8);
  const userRole = role === 'Admin' ? 'Admin' : 'Student';
  const stmt = db.prepare("INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)");
  stmt.run(name, email, hashed, userRole, function(err) {
    if (err) {
      return res.status(400).json({ message: 'Email already exists or invalid' });
    }
    const userId = this.lastID;
    // If student, create a student record
    if (userRole === 'Student') {
      const enroll = new Date().toISOString().slice(0,10);
      const s = db.prepare("INSERT INTO students (userId,name,email,course,enrollmentDate) VALUES (?,?,?,?,?)");
      s.run(userId, name, email, 'MERN Bootcamp', enroll, function(err2){
        const token = generateToken({ id: userId, role: userRole });
        return res.json({ token, role: userRole, name });
      });
    } else {
      const token = generateToken({ id: userId, role: userRole });
      return res.json({ token, role: userRole, name });
    }
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Missing fields' });
  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err || !user) return res.status(400).json({ message: 'Invalid credentials' });
    const matches = bcrypt.compareSync(password, user.password);
    if (!matches) return res.status(400).json({ message: 'Invalid credentials' });
    const token = generateToken(user);
    return res.json({ token, role: user.role, name: user.name });
  });
});

// Admin routes: supports pagination
app.get('/api/students', authMiddleware, requireRole('Admin'), (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const limit = Math.max(1, parseInt(req.query.limit || '10'));
  const offset = (page - 1) * limit;

  db.get("SELECT COUNT(*) as count FROM students", [], (err, row) => {
    if (err) return res.status(500).json({ message: 'DB error' });
    const total = row.count || 0;
    db.all("SELECT * FROM students ORDER BY id DESC LIMIT ? OFFSET ?", [limit, offset], (err2, rows) => {
      if (err2) return res.status(500).json({ message: 'DB error' });
      res.json({ students: rows, total, page, limit });
    });
  });
});

app.post('/api/students', authMiddleware, requireRole('Admin'), (req, res) => {
  const { name, email, course, enrollmentDate } = req.body;
  if (!name || !email) return res.status(400).json({ message: 'Missing fields' });
  // create user + student
  const password = Math.random().toString(36).slice(2,10);
  const hashed = bcrypt.hashSync(password, 8);
  db.run("INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)", [name,email,hashed,'Student'], function(err){
    if (err) return res.status(400).json({ message: 'Email may already exist' });
    const userId = this.lastID;
    const enroll = enrollmentDate || new Date().toISOString().slice(0,10);
    db.run("INSERT INTO students (userId,name,email,course,enrollmentDate) VALUES (?,?,?,?,?)", [userId,name,email,course || 'MERN Bootcamp', enroll], function(err2){
      if (err2) return res.status(500).json({ message: 'Failed to create student' });
      // return created student entry
      db.get("SELECT * FROM students WHERE id = ?", [this.lastID], (err3, srow) => {
        if (err3) return res.status(500).json({ message: 'Created but failed to fetch' });
        res.json({ student: srow, password });
      });
    });
  });
});

app.put('/api/students/:id', authMiddleware, requireRole('Admin'), (req, res) => {
  const id = req.params.id;
  const { name, email, course, enrollmentDate } = req.body;
  db.run("UPDATE students SET name=?, email=?, course=?, enrollmentDate=? WHERE id=?", [name,email,course,enrollmentDate,id], function(err){
    if (err) return res.status(500).json({ message: 'Failed to update' });
    res.json({ success: true });
  });
});

app.delete('/api/students/:id', authMiddleware, requireRole('Admin'), (req, res) => {
  const id = req.params.id;
  // delete student and corresponding user
  db.get("SELECT userId FROM students WHERE id=?", [id], (err,row) => {
    if (err || !row) return res.status(400).json({ message: 'Student not found' });
    const userId = row.userId;
    db.run("DELETE FROM students WHERE id=?", [id], function(err2){
      if (err2) return res.status(500).json({ message: 'Failed to delete student' });
      db.run("DELETE FROM users WHERE id=?", [userId], function(err3){
        if (err3) return res.status(500).json({ message: 'Failed to delete user' });
        res.json({ success: true });
      });
    });
  });
});

// Student routes
app.get('/api/students/me', authMiddleware, (req, res) => {
  const userId = req.user.id;
  db.get("SELECT * FROM users WHERE id=?", [userId], (err,u)=>{
    if (err || !u) return res.status(400).json({ message: 'User not found' });
    if (u.role === 'Admin') return res.status(403).json({ message: 'Admins have no student profile' });
    db.get("SELECT * FROM students WHERE userId=?", [userId], (err2, s) => {
      if (err2 || !s) return res.status(400).json({ message: 'Student profile not found' });
      res.json(s);
    });
  });
});

app.put('/api/students/me', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { name, email, course } = req.body;
  db.get("SELECT * FROM users WHERE id=?", [userId], (err,u)=>{
    if (err || !u) return res.status(400).json({ message: 'User not found' });
    db.run("UPDATE users SET name=?, email=? WHERE id=?", [name, email, userId], function(err2){
      if (err2) return res.status(500).json({ message: 'Failed to update user' });
      db.run("UPDATE students SET name=?, email=?, course=? WHERE userId=?", [name, email, course, userId], function(err3){
        if (err3) return res.status(500).json({ message: 'Failed to update student' });
        res.json({ success: true });
      });
    });
  });
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Seed admin if not exists
function seedAdmin(){
  db.get("SELECT * FROM users WHERE email=?", ['admin@example.com'], (err,row)=>{
    if (!row) {
      const hashed = bcrypt.hashSync('admin123', 8);
      db.run("INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)", ['Admin','admin@example.com',hashed,'Admin'], function(err2){
        console.log('Seeded admin -> email: admin@example.com password: admin123');
      });
    } else {
      console.log('Admin exists');
    }
  });
}

seedAdmin();

app.listen(PORT, ()=> {
  console.log('Server running on port', PORT);
});