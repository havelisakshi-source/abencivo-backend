import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();
fs.mkdirSync("data",{recursive:true});
const db=new Database("data/abencivo.sqlite");
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS admins(id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,composition TEXT,dosage_form TEXT,category TEXT,image_url TEXT,description TEXT,active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS enquiries(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT,email TEXT,city TEXT,type TEXT,message TEXT,status TEXT DEFAULT 'New',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,admin_id INTEGER,action TEXT,entity TEXT,entity_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
// Migration: add columns that track who an enquiry was routed to and
// whether the notification email actually went out. Safe to run repeatedly —
// better-sqlite3/SQLite has no "ADD COLUMN IF NOT EXISTS", so we check first.
const enquiryColumns = db.prepare("PRAGMA table_info(enquiries)").all().map(c => c.name);
if (!enquiryColumns.includes("assigned_to")) {
  db.exec("ALTER TABLE enquiries ADD COLUMN assigned_to TEXT");
}
if (!enquiryColumns.includes("emailed")) {
  db.exec("ALTER TABLE enquiries ADD COLUMN emailed INTEGER DEFAULT 0");
}
// Only bootstrap the admin account when real credentials are configured.
// A hardcoded fallback password would mean anyone reading this source code
// (or the public repo) knows a valid login until someone remembers to
// change it — so if the env vars aren't set, we refuse to create one at
// all rather than create one with a guessable password.
if(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD){
 if(!db.prepare("SELECT id FROM admins WHERE email=?").get(process.env.ADMIN_EMAIL)){
  if(process.env.ADMIN_PASSWORD.length<8){
   console.warn("ADMIN_PASSWORD is under 8 characters — set a stronger password in .env before going live.");
  }
  const hash=bcrypt.hashSync(process.env.ADMIN_PASSWORD,12);
  db.prepare("INSERT INTO admins(email,password_hash) VALUES(?,?)").run(process.env.ADMIN_EMAIL,hash);
 }
} else {
 console.warn("ADMIN_EMAIL / ADMIN_PASSWORD not set in .env — no admin account was created. Set both and restart the server to enable /admin login.");
}
export default db;
