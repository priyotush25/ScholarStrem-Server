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




app.post("/users", async (req, res) => {
  const user = req.body;
  user.role = "student";
  user.createdAt = new Date();

  const exist = await userCollection.findOne({ email: user.email });
  if (exist) return res.send({ message: "user exist" });

  const result = await userCollection.insertOne(user);
  res.send(result);
});

app.get("/users", async (req, res) => {
  const result = await userCollection.find().toArray();
  res.send(result);
});

app.get("/users/:email", verifyFirebaseToken, async (req, res) => {
  const result = await userCollection.findOne({ email: req.params.email });
  res.send(result);
});



app.post("/scholarships", verifyFirebaseToken, verifyAdmin, async (req, res) => {
  const data = req.body;
  data.createdAt = new Date();
  const result = await scholarshipsCollection.insertOne(data);
  res.send(result);
});

app.get("/scholarships/:id", verifyFirebaseToken, async (req, res) => {
  const result = await scholarshipsCollection.findOne({
    _id: new ObjectId(req.params.id),
  });
  res.send(result);
});


const stripe = require("stripe")(process.env.STRIPE_SECRET);

app.post("/scholarship-payment-checkout", async (req, res) => {
  const info = req.body;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    customer_email: info.studentEmail,
    line_items: [
      {
        price_data: {
          currency: "USD",
          unit_amount: parseInt(info.charge) * 100,
          product_data: { name: info.universityName },
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.SITE_URL}/payment-success`,
    cancel_url: `${process.env.SITE_URL}/payment-cancelled`,
  });

  res.send({ url: session.url });
});




app.post("/apply-scholarships", verifyFirebaseToken, async (req, res) => {
  const data = req.body;
  data.userId = generateUserId();
  data.applicationDate = new Date();

  const result = await applicationsCollection.insertOne(data);
  res.send(result);
});








app.get("/", (req, res) => {
  res.send("Scholar Stream Server");
});

app.listen(port, () => {
  console.log("port running on", port);
});
