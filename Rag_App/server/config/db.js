import mongoose from "mongoose";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Database connection successful");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

export default connectDB;
