const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());


const admin = require("firebase-admin");

const decoded = Buffer.from(process.env.FIREBASE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});




const uri = `mongodb+srv://${process.env.MONGO_DB_USER}:${process.env.MONGO_DB_PASS}@${process.env.MONGO_DB_URI}`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});





const verifyFirebaseToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};


const verifyAdmin = async (req, res, next) => {
  const email = req.decoded_email;
  const user = await userCollection.findOne({ email });
  if (!user || !["admin", "super-admin"].includes(user.role)) {
    return res.status(403).send({ message: "Forbidden access" });
  }
  next();
};

const verifyModerator = async (req, res, next) => {
  const email = req.decoded_email;
  const user = await userCollection.findOne({ email });
  if (!user || !["moderator", "super-admin"].includes(user.role)) {
    return res.status(403).send({ message: "Forbidden access" });
  }
  next();
};






const crypto = require("crypto");

function generateUserId() {
  const prefix = "SS";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(1).toString("hex").toUpperCase();
  return `${prefix}-${date}-${random}`;
}



const crypto = require("crypto");

function generateUserId() {
  const prefix = "SS";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomBytes(1).toString("hex").toUpperCase();
  return `${prefix}-${date}-${random}`;
}




app.get("/", (req, res) => {
  res.send("Scholar Stream Server");
});

app.listen(port, () => {
  console.log("port running on", port);
});
