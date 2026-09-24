import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'abencivo-biotech'; // Fallback to a default name if not set

let client;
let db;

export const connectDB = async () => {
  if (!uri) {
    throw new Error('Please add your MONGODB_URI to .env or Render Environment Variables');
  }

  // If already connected, return the existing connection
  if (db) return db;

  try {
    client = new MongoClient(uri, {
      tls: true,
      tlsAllowInvalidCertificates: true, // Fixes the SSL Alert 80
      tlsAllowInvalidHostnames: true,
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    db = client.db(dbName);
    console.log(`✅ MongoDB connected successfully to database: ${dbName}`);
    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1); // Stop the app if the DB fails to connect
  }
};

export const getDB = () => {
  if (!db) {
    throw new Error('Database not initialized. You must call connectDB() before getDB()');
  }
  return db;
};