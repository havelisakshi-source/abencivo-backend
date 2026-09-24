import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

let client;
let db;

export async function connectDB() {
  if (db) return db; // Return the existing connection if already connected

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is not set in environment variables!");
    process.exit(1);
  }

  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('abencivo_db'); // The database name inside your cluster
    console.log('✅ Connected to MongoDB Atlas successfully!');
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

export function getDB() {
  if (!db) {
    throw new Error("Database not initialized. Call connectDB first.");
  }
  return db;
}