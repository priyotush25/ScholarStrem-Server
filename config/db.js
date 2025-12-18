const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    
    const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ba8zkp0.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;

    // নতুন Mongoose version এ আর কোন extra options লাগবে না
    await mongoose.connect(uri);

    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("MongoDB Connection Failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
