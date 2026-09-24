import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'abencivo-biotech';

let client;
let db;

export const connectDB = async () => {
  if (!uri) {
    throw new Error('Please add your MONGODB_URI to .env or Render Environment Variables');
  }

  if (db) return db;

  try {
    client = new MongoClient(uri, {
      tls: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true,
      autoSelectFamily: false, // <--- CRITICAL FIX for Render network compatibility
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    db = client.db(dbName);
    console.log(`✅ MongoDB connected successfully to database: ${dbName}`);
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

export const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized. You must call connectDB() before getDB()');
  }
  return db;
};