import mongoose from "mongoose";

let isConnected = false;

const connectDB = async (): Promise<void> => {
  if (isConnected) return;
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI as string);
    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error: any) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
