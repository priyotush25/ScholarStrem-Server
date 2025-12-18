const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  try {
    
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ke7g9qv.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`;

    await mongoose.connect(uri);

    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("MongoDB Connection Failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
