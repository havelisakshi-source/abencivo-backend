import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import multer from "multer";
import path from "path";
import fs from "fs";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import db from "./db.js";
import {auth} from "./auth.js";
import {recipientFor} from "./team.js";
import {validateEnquiry, validateProduct, validateStatus} from "./validate.js";

dotenv.config();
const app=express(), port=process.env.PORT||4000;

// === FORCE CREATE ADMIN ACCOUNT ON STARTUP ===
const adminEmail = "admin@abencivobiotech.com";
const adminPassword = "AbencivoAdmin2026!"; // You will use this to login
try {
  const existingAdmin = db.prepare("SELECT * FROM admins WHERE email=?").get(adminEmail);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync(adminPassword, 10);
    db.prepare("INSERT INTO admins (email, password_hash) VALUES (?, ?)").run(adminEmail, hash);
    console.log("✅ ADMIN ACCOUNT CREATED SUCCESSFULLY!");
  } else {
    console.log("✅ ADMIN ACCOUNT ALREADY EXISTS.");
  }
} catch (err) {
  console.error("❌ FAILED TO CREATE ADMIN:", err.message);
}
// =============================================

// === CREATE CATEGORIES TABLE IF MISSING ===
try {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '💊',
      icon_url TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
} catch (err) {
  console.error("❌ FAILED TO CREATE categories TABLE:", err.message);
}
// ==========================================

// === ADD "packing" COLUMN TO products IF MISSING ===
try {
  db.prepare("ALTER TABLE products ADD COLUMN packing TEXT DEFAULT ''").run();
} catch (err) {
  // Column already exists — safe to ignore
}
// =================================================

// === AUTO-SEED PRODUCTS ON FIRST STARTUP ===
try {
  const productCount = db.prepare("SELECT COUNT(*) as c FROM products").get().c;

  if (productCount === 0) {
    console.log("🌱 Seeding products...");

    const seedProducts = [
      ["ETOABN-TH", "Etoricoxib 60mg + Thiocolchicoside 4mg", "Tablet", "Tablets", "10x10 Alu-Alu", "Premium pain relief formulation."],
      ["ETOABN-120", "Etoricoxib 120mg", "Tablet", "Tablets", "10x10 Alu-Alu", "High strength Etoricoxib tablet."],
      ["UROABN-300", "Ursodeoxycholic acid 300mg", "Tablet", "Tablets", "10x1x10 Alu", "Liver support formulation."],
      ["ABC-500", "Levofloxacin 500mg", "Tablet", "Tablets", "10x10 Alu-Alu", "Broad-spectrum antibiotic."],
      ["ABCNET-FX", "Montelukast 10mg + Fexofenadine 120mg", "Tablet", "Tablets", "10x10 Alu-Alu", "Anti-allergic combination."],
      ["ABNZID-600", "Linezolid 600mg", "Tablet", "Tablets", "10x1x10 Alu", "Antibiotic tablet."],
      ["PENCIV-DSR", "Pantoprazole 40mg + Domperidone 30mg", "Capsule", "Capsules", "10x10 Alu-Alu", "PPI combination capsule."],
      ["REBCIV-DSR", "Rabeprazole 20mg + Domperidone 30mg", "Capsule", "Capsules", "10x10 Alu-Alu", "PPI combination capsule."],
      ["ABNRAB-LSR", "Rabeprazole 20mg + Levosulpride 75mg", "Capsule", "Capsules", "10x10 Alu-Alu", "Gastro capsule."],
      ["ESOABN-DSR", "Esomeprazole 40mg + Domperidone 30mg", "Capsule", "Capsules", "10x10 Alu-Alu", "PPI capsule."],
      ["ABNMOX-CV-457", "Amoxycillin 400mg + Clavulanic Acid 57mg", "Dry Syrup", "Dry Syrup", "30 ML", "Antibiotic dry syrup."],
      ["FIXOBEN-DS", "Cefixime 100mg", "Dry Syrup", "Dry Syrup", "30 ML", "Antibiotic dry syrup."],
      ["ABNSVIT-L", "Multivitamin & Multimineral Drop", "Drops", "Drops", "30 ML", "Pediatric multivitamin drops."],
      ["ABNTONE", "Ondansetron 2mg", "Drops", "Drops", "30 ML", "Anti-emetic drops."],
      ["ABNDAC-GEL", "Diclofenac Gel", "Ointment", "Ointment", "30 GM", "Topical pain relief gel."],
      ["KETOABN", "Ketoconazole 2%", "Ointment", "Ointment", "15 GM", "Antifungal cream."],
      ["ABNLIV-DS", "Herbal Liver Tonic", "Herbal", "Herbal", "225 ML", "Ayurvedic liver tonic."],
      ["MINDSET", "Complete Mind Health Solution", "Herbal", "Herbal", "200 ML", "Ayurvedic mind tonic."],
      ["ABNSVIT-L", "Lycopene 6% + Multivitamin & Multimineral", "Liquid", "Liquid", "200 ML", "Nutritional liquid."],
      ["COFRIBS-AM", "Terbutaline 1.25mg + Ambroxol 15mg + Guaiphenesin", "Liquid", "Liquid", "60 ML", "Cough syrup."],
      ["ABNCEFT-250", "Ceftriaxone 250mg", "Injection", "Injection", "1x1 Vial", "Antibiotic injection."],
      ["MEROABN-1GM", "Meropenem 1gm", "Injection", "Injection", "1x1 Vial", "Broad-spectrum antibiotic injection."],
      ["ABNCIVO-ORS", "ORS Drink", "Energy Drink", "Energy Drink", "200 ML", "Oral rehydration solution."],
    ];

    const insertStmt = db.prepare(
      "INSERT INTO products (name, composition, dosage_form, category, packing, description) VALUES (?, ?, ?, ?, ?, ?)"
    );

    const insertMany = db.transaction((products) => {
      for (const p of products) insertStmt.run(...p);
    });
    insertMany(seedProducts);

    console.log(`✅ Seeded ${seedProducts.length} products.`);
  } else {
    console.log(`ℹ️  Products already seeded (${productCount} found).`);
  }
} catch (err) {
  console.error("❌ Product seeding failed:", err.message);
}
// ==========================================

// === AUTO-SEED CATEGORIES ON FIRST STARTUP ===
try {
  const catCount = db.prepare("SELECT COUNT(*) as c FROM categories").get().c;

  if (catCount === 0) {
    console.log("🌱 Seeding categories...");

    const seedCategories = [
      ["Tablets",     "💊", 1],
      ["Capsules",    "💊", 2],
      ["Liquid",      "🧴", 3],
      ["Dry Syrup",   "🥤", 4],
      ["Drops",       "💧", 5],
      ["Injection",   "💉", 6],
      ["Ointment",    "🧴", 7],
      ["Herbal",      "🌿", 8],
      ["Energy Drink","🥤", 9],
    ];

    const insertCat = db.prepare(
      "INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)"
    );

    const insertCats = db.transaction((cats) => {
      for (const c of cats) insertCat.run(...c);
    });
    insertCats(seedCategories);

    console.log(`✅ Seeded ${seedCategories.length} categories.`);
  } else {
    console.log(`ℹ️  Categories already seeded (${catCount} found).`);
  }
} catch (err) {
  console.error("❌ Category seeding failed:", err.message);
}
// ============================================

// Behind Render/Railway/any reverse proxy, requests arrive from the proxy's
// IP unless we trust the X-Forwarded-For header — required for rate
// limiting (and req.ip generally) to see the real client, not the proxy.
app.set("trust proxy", 1);

// Standard security headers (X-Content-Type-Options, X-Frame-Options,
// Referrer-Policy, HSTS, and it removes X-Powered-By). Content-Security-Policy
// is left off: this app serves its own bundled JS/CSS from one origin, so a
// strict CSP mostly just risks breaking the Vite build for little extra
// protection here — worth revisiting if third-party scripts are ever added.
app.use(helmet({contentSecurityPolicy:false}));

// Supports one or more comma-separated origins in CORS_ORIGIN, e.g.
// "https://abencivo.com,https://www.abencivo.com". Falls back to the local
// Vite dev port so `npm run dev` keeps working without extra setup.
const allowedOrigins=(process.env.CORS_ORIGIN||"http://localhost:5173").split(",").map(o=>o.trim());
app.use(cors({origin:allowedOrigins}));
app.use(express.json({limit:"200kb"}));
fs.mkdirSync("uploads",{recursive:true});
// Uploaded images need to render inside <img> tags on the frontend, which
// now lives on a different origin (even locally: 5173 vs 4000 counts as
// different). helmet's default Cross-Origin-Resource-Policy of
// "same-origin" would otherwise make the browser silently refuse to load
// them as an <img src> — this opens that up just for this one path. The
// rest of the API keeps the stricter default (not that it matters much for
// JSON: browsers only enforce CORP on no-cors resource loads like <img>/
// <script>, not on cors-mode fetch() calls, which are already gated by the
// CORS middleware above).
app.use("/uploads",(req,res,next)=>{res.setHeader("Cross-Origin-Resource-Policy","cross-origin");next()},express.static("uploads",{dotfiles:"deny"}));

// Wraps an async route handler so a thrown/rejected error reaches the
// central error handler below instead of crashing the process or leaking
// an unhandled-rejection stack trace.
const ah=fn=>(req,res,next)=>fn(req,res,next).catch(next);

// Login brute-force protection: 5 attempts per 15 minutes per IP.
const loginLimiter=rateLimit({windowMs:15*60*1000,max:5,standardHeaders:true,legacyHeaders:false,message:{message:"Too many login attempts. Please try again in 15 minutes."}});
// Public enquiry form: generous enough for a real visitor, tight enough to blunt spam bots.
const enquiryLimiter=rateLimit({windowMs:60*60*1000,max:20,standardHeaders:true,legacyHeaders:false,message:{message:"Too many enquiries from this network. Please try again later."}});
// Broad safety net across the whole API.
const apiLimiter=rateLimit({windowMs:15*60*1000,max:300,standardHeaders:true,legacyHeaders:false});
app.use("/api",apiLimiter);

app.get("/api/health",(req,res)=>res.json({ok:true,service:"Abencivo Biotech API"}));
app.post("/api/auth/login",loginLimiter,(req,res)=>{
 const {email,password}=req.body||{}, a=db.prepare("SELECT * FROM admins WHERE email=?").get(email);
 if(!a||!bcrypt.compareSync(password||"",a.password_hash))return res.status(401).json({message:"Invalid email or password"});
 const token=jwt.sign({id:a.id,email:a.email},process.env.JWT_SECRET,{expiresIn:"8h"});
 res.json({token});
});
app.get("/api/products",(req,res)=>res.json(db.prepare("SELECT * FROM products WHERE active=1 ORDER BY id DESC").all()));
app.get("/api/products/:id",(req,res)=>{const p=db.prepare("SELECT * FROM products WHERE id=? AND active=1").get(req.params.id);p?res.json(p):res.status(404).json({message:"Not found"})});

// === PUBLIC CATEGORIES ENDPOINT ===
app.get("/api/categories",(req,res)=>res.json(db.prepare("SELECT * FROM categories WHERE active=1 ORDER BY sort_order ASC, id ASC").all()));
// ==================================

app.post("/api/enquiries",enquiryLimiter,ah(async(req,res)=>{
 const {errors,data}=validateEnquiry(req.body||{});
 if(errors.length)return res.status(400).json({message:errors[0]});
 const {name,phone,email,city,type,message}=data;
 const enquiryType=type||"General";
 const person=recipientFor(enquiryType); // the specific team member who owns this enquiry type
 const result=db.prepare("INSERT INTO enquiries(name,phone,email,city,type,message,assigned_to) VALUES(?,?,?,?,?,?,?)")
   .run(name,phone,email||"",city||"",enquiryType,message,person.name);

 let emailed=false;
 if(process.env.SMTP_HOST&&person.email){
   try{
     const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE)==="true",auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});

     // 1) Notify the specific responsible person.
     await transporter.sendMail({
       from:process.env.MAIL_FROM||process.env.SMTP_USER,
       to:person.email,
       subject:`[${enquiryType}] New enquiry #${result.lastInsertRowid} — ${name}`,
       text:`Hi ${person.name},\n\nA new ${enquiryType} enquiry needs your attention.\n\nName: ${name}\nPhone: ${phone}\nEmail: ${email||"Not provided"}\nCity: ${city||"Not provided"}\n\nMessage:\n${message}\n\n— Assigned to you as the ${person.name} for this enquiry type. Update its status from the admin dashboard once you've followed up.`
     });

     // 2) Optional courtesy confirmation to the customer, only if they gave an email.
     if(email){
       await transporter.sendMail({
         from:process.env.MAIL_FROM||process.env.SMTP_USER,
         to:email,
         subject:`We received your enquiry — ${process.env.MAIL_FROM_NAME||"Abencivo Biotech"}`,
         text:`Hi ${name},\n\nThanks for reaching out. Your ${enquiryType} enquiry has been received and assigned to our ${person.name}, who will contact you shortly at ${phone}.\n\nYour message:\n${message}\n\nRegards,\nAbencivo Biotech`
       });
     }
     emailed=true;
     db.prepare("UPDATE enquiries SET emailed=1 WHERE id=?").run(result.lastInsertRowid);
   }catch(e){console.error("Email error:",e.message)}
 } else {
   // SMTP not configured — still make it obvious in the server log who owns this lead.
   console.log(`New ${enquiryType} enquiry #${result.lastInsertRowid} saved. Assigned to: ${person.name}. Configure SMTP in .env to email them automatically.`);
 }
 res.status(201).json({message:emailed?`Enquiry submitted. ${person.name} has been notified.`:"Enquiry submitted successfully.",id:result.lastInsertRowid});
}));
app.get("/api/admin/products",auth,(req,res)=>res.json(db.prepare("SELECT * FROM products ORDER BY id DESC").all()));
app.post("/api/admin/products",auth,(req,res)=>{
 const {errors,data:p}=validateProduct(req.body||{});
 if(errors.length)return res.status(400).json({message:errors[0]});
 const r=db.prepare("INSERT INTO products(name,composition,dosage_form,category,image_url,description) VALUES(?,?,?,?,?,?)").run(p.name,p.composition,p.dosage_form,p.category,p.image_url,p.description);
 db.prepare("INSERT INTO audit_logs(admin_id,action,entity,entity_id) VALUES(?,?,?,?)").run(req.user.id,"CREATE","product",r.lastInsertRowid);
 res.status(201).json({id:r.lastInsertRowid});
});
app.put("/api/admin/products/:id",auth,(req,res)=>{
 const {errors,data:p}=validateProduct(req.body||{});
 if(errors.length)return res.status(400).json({message:errors[0]});
 db.prepare("UPDATE products SET name=?,composition=?,dosage_form=?,category=?,image_url=?,description=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(p.name,p.composition,p.dosage_form,p.category,p.image_url,p.description,p.active,req.params.id);
 db.prepare("INSERT INTO audit_logs(admin_id,action,entity,entity_id) VALUES(?,?,?,?)").run(req.user.id,"UPDATE","product",req.params.id);
 res.json({ok:true});
});
app.delete("/api/admin/products/:id",auth,(req,res)=>{db.prepare("UPDATE products SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(req.params.id);db.prepare("INSERT INTO audit_logs(admin_id,action,entity,entity_id) VALUES(?,?,?,?)").run(req.user.id,"DELETE","product",req.params.id);res.json({ok:true})});
app.get("/api/admin/enquiries",auth,(req,res)=>res.json(db.prepare("SELECT * FROM enquiries ORDER BY id DESC").all()));
app.patch("/api/admin/enquiries/:id",auth,(req,res)=>{
 const {errors,data}=validateStatus(req.body||{});
 if(errors.length)return res.status(400).json({message:errors[0]});
 db.prepare("UPDATE enquiries SET status=? WHERE id=?").run(data.status,req.params.id);
 db.prepare("INSERT INTO audit_logs(admin_id,action,entity,entity_id) VALUES(?,?,?,?)").run(req.user.id,"STATUS","enquiry",req.params.id);
 res.json({ok:true});
});
app.get("/api/admin/audit-logs",auth,(req,res)=>res.json(db.prepare("SELECT * FROM audit_logs ORDER BY id DESC LIMIT 500").all()));

// === ADMIN CATEGORIES ROUTES ===
app.get("/api/admin/categories",auth,(req,res)=>res.json(db.prepare("SELECT * FROM categories ORDER BY sort_order ASC, id ASC").all()));

app.post("/api/admin/categories",auth,(req,res)=>{
  const {name,icon,icon_url,sort_order}=req.body||{};
  if(!name)return res.status(400).json({message:"Name is required"});
  const r=db.prepare("INSERT INTO categories(name,icon,icon_url,sort_order) VALUES(?,?,?,?)").run(name,icon||"💊",icon_url||"",sort_order||0);
  db.prepare("INSERT INTO audit_logs(admin_id,action,entity,entity_id) VALUES(?,?,?,?)").run(req.user.id,"CREATE","category",r.lastInsertRowid);
  res.status(201).json({id:r.lastInsertRowid});
});

app.put("/api/admin/categories/:id",auth,(req,res)=>{
  const {name,icon,icon_url,sort_order,active}=req.body||{};
  db.prepare("UPDATE categories SET name=?,icon=?,icon_url=?,sort_order=?,active=? WHERE id=?").run(name,icon||"💊",icon_url||"",sort_order||0,active??1,req.params.id);
  db.prepare("INSERT INTO audit_logs(admin_id,action,entity,entity_id) VALUES(?,?,?,?)").run(req.user.id,"UPDATE","category",req.params.id);
  res.json({ok:true});
});

app.delete("/api/admin/categories/:id",auth,(req,res)=>{
  db.prepare("UPDATE categories SET active=0 WHERE id=?").run(req.params.id);
  db.prepare("INSERT INTO audit_logs(admin_id,action,entity,entity_id) VALUES(?,?,?,?)").run(req.user.id,"DELETE","category",req.params.id);
  res.json({ok:true});
});
// ===============================

const upload=multer({dest:"uploads/",limits:{fileSize:5*1024*1024}});
// SVG is deliberately excluded — an uploaded SVG can carry an embedded
// <script>, which a browser will execute if the file is opened directly.
const ALLOWED_UPLOADS={".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".pdf":"application/pdf"};
app.post("/api/admin/upload",auth,upload.single("file"),(req,res)=>{
 if(!req.file)return res.status(400).json({message:"File required"});
 const ext=path.extname(req.file.originalname).toLowerCase();
 const expectedMime=ALLOWED_UPLOADS[ext];
 // Extension AND the browser-reported MIME type must both check out — an
 // easy bar to clear for a genuine image, but it stops a trivial rename
 // (e.g. malware.exe -> photo.jpg) from sailing through on extension alone.
 if(!expectedMime||req.file.mimetype!==expectedMime){
   fs.unlinkSync(req.file.path);
   return res.status(400).json({message:"File type not allowed. Use JPG, PNG, WEBP or PDF."});
 }
 const newName=`${Date.now()}-${req.file.filename}${ext}`;
 fs.renameSync(req.file.path,path.join("uploads",newName));
 res.json({url:`/uploads/${newName}`});
});

// Centralized error handler — catches anything ah() forwarded, Multer
// errors (e.g. file too large), and anything else that slips through.
// The client only ever sees a generic message; the real detail is logged
// server-side only, never in the HTTP response.
app.use((err,req,res,next)=>{
 console.error(err);
 if(err && err.name==="MulterError"){
   const msg=err.code==="LIMIT_FILE_SIZE"?"File is too large (5MB max).":"Upload failed.";
   return res.status(400).json({message:msg});
 }
 res.status(err && err.status || 500).json({message:process.env.NODE_ENV==="production"?"Something went wrong. Please try again.":(err && err.message)||"Server error"});
});

app.listen(port,()=>console.log(`API running on http://localhost:${port}`));