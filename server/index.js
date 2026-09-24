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
import { connectDB, getDB } from "./db.js"; // Updated import
import {auth} from "./auth.js";
import {recipientFor} from "./team.js";
import {validateEnquiry, validateProduct, validateStatus} from "./validate.js";

dotenv.config();
const app = express();
const port = process.env.PORT || 4000;

// Connect to MongoDB and then start the server
async function startServer() {
  const db = await connectDB();

  // === FORCE CREATE ADMIN ACCOUNT ON STARTUP ===
  const adminEmail = "admin@abencivobiotech.com";
  const adminPassword = "AbencivoAdmin2026!";
  try {
    const existingAdmin = await db.collection('admins').findOne({ email: adminEmail });
    if (!existingAdmin) {
      const hash = bcrypt.hashSync(adminPassword, 10);
      await db.collection('admins').insertOne({ email: adminEmail, password_hash: hash });
      console.log("✅ ADMIN ACCOUNT CREATED SUCCESSFULLY!");
    } else {
      console.log("✅ ADMIN ACCOUNT ALREADY EXISTS.");
    }
  } catch (err) {
    console.error("❌ FAILED TO CREATE ADMIN:", err.message);
  }

  // === AUTO-SEED PRODUCTS ON FIRST STARTUP ===
  try {
    const productCount = await db.collection('products').countDocuments();
    if (productCount === 0) {
      console.log("🌱 Seeding products...");

      const seedProducts = [
        { name: "ETOABN-TH", composition: "Etoricoxib 60mg + Thiocolchicoside 4mg", dosage_form: "Tablet", category: "Tablets", packing: "10x10 Alu-Alu", description: "Premium pain relief formulation.", active: 1, image_url: "" },
        { name: "ETOABN-120", composition: "Etoricoxib 120mg", dosage_form: "Tablet", category: "Tablets", packing: "10x10 Alu-Alu", description: "High strength Etoricoxib tablet.", active: 1, image_url: "" },
        { name: "UROABN-300", composition: "Ursodeoxycholic acid 300mg", dosage_form: "Tablet", category: "Tablets", packing: "10x1x10 Alu", description: "Liver support formulation.", active: 1, image_url: "" },
        { name: "ABC-500", composition: "Levofloxacin 500mg", dosage_form: "Tablet", category: "Tablets", packing: "10x10 Alu-Alu", description: "Broad-spectrum antibiotic.", active: 1, image_url: "" },
        { name: "ABCNET-FX", composition: "Montelukast 10mg + Fexofenadine 120mg", dosage_form: "Tablet", category: "Tablets", packing: "10x10 Alu-Alu", description: "Anti-allergic combination.", active: 1, image_url: "" },
        { name: "ABNZID-600", composition: "Linezolid 600mg", dosage_form: "Tablet", category: "Tablets", packing: "10x1x10 Alu", description: "Antibiotic tablet.", active: 1, image_url: "" },
        { name: "PENCIV-DSR", composition: "Pantoprazole 40mg + Domperidone 30mg", dosage_form: "Capsule", category: "Capsules", packing: "10x10 Alu-Alu", description: "PPI combination capsule.", active: 1, image_url: "" },
        { name: "REBCIV-DSR", composition: "Rabeprazole 20mg + Domperidone 30mg", dosage_form: "Capsule", category: "Capsules", packing: "10x10 Alu-Alu", description: "PPI combination capsule.", active: 1, image_url: "" },
        { name: "ABNRAB-LSR", composition: "Rabeprazole 20mg + Levosulpride 75mg", dosage_form: "Capsule", category: "Capsules", packing: "10x10 Alu-Alu", description: "Gastro capsule.", active: 1, image_url: "" },
        { name: "ESOABN-DSR", composition: "Esomeprazole 40mg + Domperidone 30mg", dosage_form: "Capsule", category: "Capsules", packing: "10x10 Alu-Alu", description: "PPI capsule.", active: 1, image_url: "" },
        { name: "ABNMOX-CV-457", composition: "Amoxycillin 400mg + Clavulanic Acid 57mg", dosage_form: "Dry Syrup", category: "Dry Syrup", packing: "30 ML", description: "Antibiotic dry syrup.", active: 1, image_url: "" },
        { name: "FIXOBEN-DS", composition: "Cefixime 100mg", dosage_form: "Dry Syrup", category: "Dry Syrup", packing: "30 ML", description: "Antibiotic dry syrup.", active: 1, image_url: "" },
        { name: "ABNSVIT-L", composition: "Multivitamin & Multimineral Drop", dosage_form: "Drops", category: "Drops", packing: "30 ML", description: "Pediatric multivitamin drops.", active: 1, image_url: "" },
        { name: "ABNTONE", composition: "Ondansetron 2mg", dosage_form: "Drops", category: "Drops", packing: "30 ML", description: "Anti-emetic drops.", active: 1, image_url: "" },
        { name: "ABNDAC-GEL", composition: "Diclofenac Gel", dosage_form: "Ointment", category: "Ointment", packing: "30 GM", description: "Topical pain relief gel.", active: 1, image_url: "" },
        { name: "KETOABN", composition: "Ketoconazole 2%", dosage_form: "Ointment", category: "Ointment", packing: "15 GM", description: "Antifungal cream.", active: 1, image_url: "" },
        { name: "ABNLIV-DS", composition: "Herbal Liver Tonic", dosage_form: "Herbal", category: "Herbal", packing: "225 ML", description: "Ayurvedic liver tonic.", active: 1, image_url: "" },
        { name: "MINDSET", composition: "Complete Mind Health Solution", dosage_form: "Herbal", category: "Herbal", packing: "200 ML", description: "Ayurvedic mind tonic.", active: 1, image_url: "" },
        { name: "ABNSVIT-L", composition: "Lycopene 6% + Multivitamin & Multimineral", dosage_form: "Liquid", category: "Liquid", packing: "200 ML", description: "Nutritional liquid.", active: 1, image_url: "" },
        { name: "COFRIBS-AM", composition: "Terbutaline 1.25mg + Ambroxol 15mg + Guaiphenesin", dosage_form: "Liquid", category: "Liquid", packing: "60 ML", description: "Cough syrup.", active: 1, image_url: "" },
        { name: "ABNCEFT-250", composition: "Ceftriaxone 250mg", dosage_form: "Injection", category: "Injection", packing: "1x1 Vial", description: "Antibiotic injection.", active: 1, image_url: "" },
        { name: "MEROABN-1GM", composition: "Meropenem 1gm", dosage_form: "Injection", category: "Injection", packing: "1x1 Vial", description: "Broad-spectrum antibiotic injection.", active: 1, image_url: "" },
        { name: "ABNCIVO-ORS", composition: "ORS Drink", dosage_form: "Energy Drink", category: "Energy Drink", packing: "200 ML", description: "Oral rehydration solution.", active: 1, image_url: "" },
      ];
      await db.collection('products').insertMany(seedProducts);
      console.log(`✅ Seeded ${seedProducts.length} products.`);
    }
  } catch (err) {
    console.error("❌ Product seeding failed:", err.message);
  }

  // === AUTO-SEED CATEGORIES ON FIRST STARTUP ===
  try {
    const catCount = await db.collection('categories').countDocuments();
    if (catCount === 0) {
      console.log("🌱 Seeding categories...");
      const seedCategories = [
        { name: "Tablets", icon: "💊", sort_order: 1, active: 1 },
        { name: "Capsules", icon: "💊", sort_order: 2, active: 1 },
        { name: "Liquid", icon: "🧴", sort_order: 3, active: 1 },
        { name: "Dry Syrup", icon: "🥤", sort_order: 4, active: 1 },
        { name: "Drops", icon: "💧", sort_order: 5, active: 1 },
        { name: "Injection", icon: "💉", sort_order: 6, active: 1 },
        { name: "Ointment", icon: "🧴", sort_order: 7, active: 1 },
        { name: "Herbal", icon: "🌿", sort_order: 8, active: 1 },
        { name: "Energy Drink", icon: "🥤", sort_order: 9, active: 1 },
      ];
      await db.collection('categories').insertMany(seedCategories);
      console.log(`✅ Seeded ${seedCategories.length} categories.`);
    }
  } catch (err) {
    console.error("❌ Category seeding failed:", err.message);
  }
  // ============================================

  // Middleware
  app.set("trust proxy", 1);
  app.use(helmet({contentSecurityPolicy:false}));
  const allowedOrigins=(process.env.CORS_ORIGIN||"http://localhost:5173").split(",").map(o=>o.trim());
  app.use(cors({origin:allowedOrigins}));
  app.use(express.json({limit:"200kb"}));
  fs.mkdirSync("uploads",{recursive:true});
  app.use("/uploads",(req,res,next)=>{res.setHeader("Cross-Origin-Resource-Policy","cross-origin");next()},express.static("uploads",{dotfiles:"deny"}));

  const ah=fn=>(req,res,next)=>fn(req,res,next).catch(next);
  const loginLimiter=rateLimit({windowMs:15*60*1000,max:5,standardHeaders:true,legacyHeaders:false,message:{message:"Too many login attempts. Please try again in 15 minutes."}});
  const enquiryLimiter=rateLimit({windowMs:60*60*1000,max:20,standardHeaders:true,legacyHeaders:false,message:{message:"Too many enquiries from this network. Please try again later."}});
  const apiLimiter=rateLimit({windowMs:15*60*1000,max:300,standardHeaders:true,legacyHeaders:false});
  app.use("/api",apiLimiter);

  // === ROUTES ===
  app.get("/api/health",(req,res)=>res.json({ok:true,service:"Abencivo Biotech API"}));

  app.post("/api/auth/login",loginLimiter,ah(async (req,res)=>{
    const {email,password}=req.body||{};
    const a=await db.collection('admins').findOne({email});
    if(!a||!bcrypt.compareSync(password||"",a.password_hash))return res.status(401).json({message:"Invalid email or password"});
    const token=jwt.sign({id:a._id.toString(),email:a.email},process.env.JWT_SECRET,{expiresIn:"8h"});
    res.json({token});
  }));

  app.get("/api/products",ah(async (req,res)=>{
    const products = await db.collection('products').find({active:1}).sort({_id:-1}).toArray();
    res.json(products.map(p => ({...p, id: p._id.toString()})));
  }));

  app.get("/api/products/:id",ah(async (req,res)=>{
    const p = await db.collection('products').findOne({_id: new ObjectId(req.params.id), active:1});
    p ? res.json({...p, id: p._id.toString()}) : res.status(404).json({message:"Not found"});
  }));

  app.get("/api/categories",ah(async (req,res)=>{
    const cats = await db.collection('categories').find({active:1}).sort({sort_order:1, _id:1}).toArray();
    res.json(cats.map(c => ({...c, id: c._id.toString()})));
  }));

  app.post("/api/enquiries",enquiryLimiter,ah(async(req,res)=>{
    const {errors,data}=validateEnquiry(req.body||{});
    if(errors.length)return res.status(400).json({message:errors[0]});
    const {name,phone,email,city,type,message}=data;
    const enquiryType=type||"General";
    const person=recipientFor(enquiryType);
    
    const newEnquiry = {
      name, phone, email: email||"", city: city||"", type: enquiryType, message, 
      assigned_to: person.name, status: "New", created_at: new Date(), emailed: 0
    };
    
    const result = await db.collection('enquiries').insertOne(newEnquiry);
    const enquiryId = result.insertedId.toString();

    let emailed=false;
    if(process.env.SMTP_HOST&&person.email){
      try{
        const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE)==="true",auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
        await transporter.sendMail({
          from:process.env.MAIL_FROM||process.env.SMTP_USER, to:person.email,
          subject:`[${enquiryType}] New enquiry #${enquiryId} — ${name}`,
          text:`Hi ${person.name},\n\nA new ${enquiryType} enquiry needs your attention.\n\nName: ${name}\nPhone: ${phone}\nEmail: ${email||"Not provided"}\nCity: ${city||"Not provided"}\n\nMessage:\n${message}\n\n— Assigned to you as the ${person.name} for this enquiry type.`
        });
        if(email){
          await transporter.sendMail({
            from:process.env.MAIL_FROM||process.env.SMTP_USER, to:email,
            subject:`We received your enquiry — ${process.env.MAIL_FROM_NAME||"Abencivo Biotech"}`,
            text:`Hi ${name},\n\nThanks for reaching out. Your ${enquiryType} enquiry has been received and assigned to our ${person.name}.\n\nRegards,\nAbencivo Biotech`
          });
        }
        emailed=true;
        await db.collection('enquiries').updateOne({_id: result.insertedId}, {$set: {emailed: 1}});
      }catch(e){console.error("Email error:",e.message)}
    } else {
      console.log(`New ${enquiryType} enquiry #${enquiryId} saved. Assigned to: ${person.name}.`);
    }
    res.status(201).json({message:emailed?`Enquiry submitted. ${person.name} has been notified.`:"Enquiry submitted successfully.",id:enquiryId});
  }));

  // === ADMIN ROUTES ===
  app.get("/api/admin/products",auth,ah(async (req,res)=>{
    const products = await db.collection('products').find().sort({_id:-1}).toArray();
    res.json(products.map(p => ({...p, id: p._id.toString()})));
  }));

  app.post("/api/admin/products",auth,ah(async (req,res)=>{
    const {errors,data:p}=validateProduct(req.body||{});
    if(errors.length)return res.status(400).json({message:errors[0]});
    
    const newProduct = {...p, active:1, created_at: new Date()};
    const result = await db.collection('products').insertOne(newProduct);
    
    await db.collection('audit_logs').insertOne({admin_id: req.user.id, action: "CREATE", entity: "product", entity_id: result.insertedId.toString(), created_at: new Date()});
    res.status(201).json({id:result.insertedId.toString()});
  }));

  app.put("/api/admin/products/:id",auth,ah(async (req,res)=>{
    const {errors,data:p}=validateProduct(req.body||{});
    if(errors.length)return res.status(400).json({message:errors[0]});
    
    await db.collection('products').updateOne(
      {_id: new ObjectId(req.params.id)},
      {$set: {...p, updated_at: new Date()}}
    );
    await db.collection('audit_logs').insertOne({admin_id: req.user.id, action: "UPDATE", entity: "product", entity_id: req.params.id, created_at: new Date()});
    res.json({ok:true});
  }));

  app.delete("/api/admin/products/:id",auth,ah(async (req,res)=>{
    await db.collection('products').updateOne(
      {_id: new ObjectId(req.params.id)},
      {$set: {active: 0, updated_at: new Date()}}
    );
    await db.collection('audit_logs').insertOne({admin_id: req.user.id, action: "DELETE", entity: "product", entity_id: req.params.id, created_at: new Date()});
    res.json({ok:true});
  }));

  app.get("/api/admin/enquiries",auth,ah(async (req,res)=>{
    const enquiries = await db.collection('enquiries').find().sort({created_at:-1}).toArray();
    res.json(enquiries.map(e => ({...e, id: e._id.toString()})));
  }));

  app.patch("/api/admin/enquiries/:id",auth,ah(async (req,res)=>{
    const {errors,data}=validateStatus(req.body||{});
    if(errors.length)return res.status(400).json({message:errors[0]});
    
    await db.collection('enquiries').updateOne(
      {_id: new ObjectId(req.params.id)},
      {$set: {status: data.status}}
    );
    await db.collection('audit_logs').insertOne({admin_id: req.user.id, action: "STATUS", entity: "enquiry", entity_id: req.params.id, created_at: new Date()});
    res.json({ok:true});
  }));

  app.get("/api/admin/audit-logs",auth,ah(async (req,res)=>{
    const logs = await db.collection('audit_logs').find().sort({created_at:-1}).limit(500).toArray();
    res.json(logs.map(l => ({...l, id: l._id.toString()})));
  }));

  // === ADMIN CATEGORIES ROUTES ===
  app.get("/api/admin/categories",auth,ah(async (req,res)=>{
    const cats = await db.collection('categories').find().sort({sort_order:1, _id:1}).toArray();
    res.json(cats.map(c => ({...c, id: c._id.toString()})));
  }));

  app.post("/api/admin/categories",auth,ah(async (req,res)=>{
    const {name,icon,icon_url,sort_order}=req.body||{};
    if(!name)return res.status(400).json({message:"Name is required"});
    
    const newCat = {name, icon: icon||"💊", icon_url: icon_url||"", sort_order: sort_order||0, active: 1, created_at: new Date()};
    const result = await db.collection('categories').insertOne(newCat);
    
    await db.collection('audit_logs').insertOne({admin_id: req.user.id, action: "CREATE", entity: "category", entity_id: result.insertedId.toString(), created_at: new Date()});
    res.status(201).json({id:result.insertedId.toString()});
  }));

  app.put("/api/admin/categories/:id",auth,ah(async (req,res)=>{
    const {name,icon,icon_url,sort_order,active}=req.body||{};
    await db.collection('categories').updateOne(
      {_id: new ObjectId(req.params.id)},
      {$set: {name, icon: icon||"💊", icon_url: icon_url||"", sort_order: sort_order||0, active: active??1}}
    );
    await db.collection('audit_logs').insertOne({admin_id: req.user.id, action: "UPDATE", entity: "category", entity_id: req.params.id, created_at: new Date()});
    res.json({ok:true});
  }));

  app.delete("/api/admin/categories/:id",auth,ah(async (req,res)=>{
    await db.collection('categories').updateOne(
      {_id: new ObjectId(req.params.id)},
      {$set: {active: 0}}
    );
    await db.collection('audit_logs').insertOne({admin_id: req.user.id, action: "DELETE", entity: "category", entity_id: req.params.id, created_at: new Date()});
    res.json({ok:true});
  }));

  // === UPLOAD ROUTE ===
  const upload=multer({dest:"uploads/",limits:{fileSize:5*1024*1024}});
  const ALLOWED_UPLOADS={".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",".webp":"image/webp",".pdf":"application/pdf"};
  
  app.post("/api/admin/upload",auth,upload.single("file"),(req,res)=>{
    if(!req.file)return res.status(400).json({message:"File required"});
    const ext=path.extname(req.file.originalname).toLowerCase();
    const expectedMime=ALLOWED_UPLOADS[ext];
    if(!expectedMime||req.file.mimetype!==expectedMime){
      fs.unlinkSync(req.file.path);
      return res.status(400).json({message:"File type not allowed. Use JPG, PNG, WEBP or PDF."});
    }
    const newName=`${Date.now()}-${req.file.filename}${ext}`;
    fs.renameSync(req.file.path,path.join("uploads",newName));
    res.json({url:`/uploads/${newName}`});
  });

  app.use((err,req,res,next)=>{
    console.error(err);
    if(err && err.name==="MulterError"){
      const msg=err.code==="LIMIT_FILE_SIZE"?"File is too large (5MB max).":"Upload failed.";
      return res.status(400).json({message:msg});
    }
    res.status(err && err.status || 500).json({message:process.env.NODE_ENV==="production"?"Something went wrong. Please try again.":(err && err.message)||"Server error"});
  });

  app.listen(port,()=>console.log(`API running on http://localhost:${port}`));
}

// Start the server by calling the async function
startServer().catch(err => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});