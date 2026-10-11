import mongoose from "mongoose";

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.connection.on("error", (error) => {
    console.error("MongoDB connection error:", error);
  });

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  console.log("Database connected");
}
