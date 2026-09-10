import mongoose from "mongoose";

const connectToMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB for Order service");
  } catch (error) {
    console.error("MongoDB Connection Error in Order service:", error);
    process.exit(1);
  }
};

export default connectToMongoDB;
