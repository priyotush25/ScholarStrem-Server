const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const port = process.env.PORT || 3000;
const crypto = require("crypto");

// ================= FIREBASE SERVICE ACCOUNT =================
const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FIREBASE_KEY, "base64").toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(cors());

// ================= USER ID GENERATOR =================
function generateUserId() {
  const prefix = "SS";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
  const random = crypto.randomBytes(1).toString("hex").toUpperCase();
  return `${prefix}-${date}-${random}`;
}

// ================= VERIFY FIREBASE USER =================
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
    console.log(err);
    return res.status(401).send({ message: "unauthorized access" });
  }
};

// ================= MONGODB SETUP =================
const uri = `mongodb+srv://${process.env.MONGO_DB_USER}:${process.env.MONGO_DB_PASS}@${process.env.MONGO_DB_URI}`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  await client.connect();

  const db = client.db("scholar-stream");
  const userCollection = db.collection("users");
  const scholarshipsCollection = db.collection("scholarships");
  const applicationsCollection = db.collection("applications");
  const paymentCollection = db.collection("payments");
  const reviewsCollection = db.collection("reviews");

  // ================= ROLE VERIFICATION =================
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

  // ================= USERS =================
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
    const searchText = req.query.searchText;
    const query = {};

    if (searchText) {
      query.$or = [
        { displayName: { $regex: searchText, $options: "i" } },
        { email: { $regex: searchText, $options: "i" } },
      ];
    }

    const result = await userCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  });

  app.get("/users/:email", verifyFirebaseToken, async (req, res) => {
    const result = await userCollection.findOne({ email: req.params.email });
    res.send(result);
  });

  app.get("/users/:email/role", verifyFirebaseToken, async (req, res) => {
    const user = await userCollection.findOne({ email: req.params.email });
    res.send({ role: user?.role || "user" });
  });

  app.patch("/users/:id/role", verifyFirebaseToken, async (req, res) => {
    const result = await userCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { role: req.body.role } }
    );
    res.send(result);
  });

  app.delete("/users/:id", verifyFirebaseToken, verifyAdmin, async (req, res) => {
    const result = await userCollection.deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.send(result);
  });

  // ================= SCHOLARSHIPS =================
  app.get("/scholarships", verifyFirebaseToken, async (req, res) => {
    const {
      searchText,
      email,
      scholarshipCategory,
      subjectCategory,
      universityCountry,
      page = 1,
      limit = 12,
      sortType,
    } = req.query;

    const filterConditions = [];

    if (searchText) {
      filterConditions.push({
        $or: [
          { scholarshipName: { $regex: searchText, $options: "i" } },
          { universityName: { $regex: searchText, $options: "i" } },
          { degree: { $regex: searchText, $options: "i" } },
          { subjectCategory: { $regex: searchText, $options: "i" } },
          { scholarshipCategory: { $regex: searchText, $options: "i" } },
          { universityCountry: { $regex: searchText, $options: "i" } },
        ],
      });
    }

    if (scholarshipCategory)
      filterConditions.push({ scholarshipCategory });
    if (subjectCategory) filterConditions.push({ subjectCategory });
    if (universityCountry)
      filterConditions.push({ universityCountry });
    if (email) filterConditions.push({ senderEmail: email });

    const query = filterConditions.length ? { $and: filterConditions } : {};

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let sortOptions = { createdAt: -1 };
    if (sortType === "feesAsc") sortOptions = { applicationFees: 1 };
    if (sortType === "feesDesc") sortOptions = { applicationFees: -1 };
    if (sortType === "dateAsc") sortOptions = { scholarshipPostDate: 1 };
    if (sortType === "dateDesc") sortOptions = { scholarshipPostDate: -1 };

    const totalCount = await scholarshipsCollection.countDocuments(query);

    const result = await scholarshipsCollection
      .find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .toArray();

    res.send({
      data: result,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      pageSize: limitNum,
    });
  });

  app.get("/scholarships/top", async (req, res) => {
    const result = await scholarshipsCollection
      .find()
      .sort({ scholarshipPostDate: -1 })
      .limit(6)
      .toArray();
    res.send(result);
  });

  app.get("/scholarships/:id", verifyFirebaseToken, async (req, res) => {
    const result = await scholarshipsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });
    res.send(result);
  });

  app.post("/scholarships", verifyFirebaseToken, verifyAdmin, async (req, res) => {
    const scholarship = {
      ...req.body,
      createdAt: new Date(),
      scholarshipPostDate: new Date(),
    };
    const result = await scholarshipsCollection.insertOne(scholarship);
    res.send(result);
  });

  app.patch("/scholarships/:id", verifyFirebaseToken, verifyAdmin, async (req, res) => {
    const result = await scholarshipsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: req.body }
    );
    res.send(result);
  });

  app.delete("/scholarships/:id", verifyFirebaseToken, verifyAdmin, async (req, res) => {
    const result = await scholarshipsCollection.deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.send(result);
  });

  // ================= APPLICATIONS =================
  app.post("/apply-scholarships", verifyFirebaseToken, async (req, res) => {
    const applicationData = {
      ...req.body,
      userId: generateUserId(),
      applicationDate: new Date(),
    };
    const result = await applicationsCollection.insertOne(applicationData);
    res.send(result);
  });

  app.get("/applications", verifyFirebaseToken, async (req, res) => {
    const result = await applicationsCollection.find().toArray();
    res.send(result);
  });

  app.get("/applied-scholarships/:email", verifyFirebaseToken, async (req, res) => {
    if (req.decoded_email !== req.params.email) {
      return res.status(403).send({ message: "forbidden access" });
    }
    const result = await applicationsCollection
      .find({ userEmail: req.params.email })
      .toArray();
    res.send(result);
  });

  // ================= PAYMENTS =================
  app.post("/scholarship-payment-checkout", async (req, res) => {
    const info = req.body;
    const payment = parseInt(info.charge) * 100;

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "USD",
            unit_amount: payment,
            product_data: { name: info.universityName },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: info.studentEmail,
      metadata: {
        universityName: info.universityName,
        scholarshipId: info.scholarshipId,
        applicationId: info.applicationId,
      },
      success_url: `${process.env.SITE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/payment-cancelled`,
    });

    res.send({ url: session.url });
  });

  app.patch("/payment-success", verifyFirebaseToken, async (req, res) => {
    const session = await stripe.checkout.sessions.retrieve(req.query.session_id);

    const exist = await paymentCollection.findOne({
      transactionId: session.payment_intent,
    });

    if (exist) return res.send({ message: "already exist" });

    if (session.payment_status === "paid") {
      await applicationsCollection.updateOne(
        { _id: new ObjectId(session.metadata.applicationId) },
        { $set: { paymentStatus: "paid" } }
      );

      const payment = {
        amount: session.amount_total / 100,
        email: session.customer_email,
        scholarshipId: session.metadata.scholarshipId,
        universityName: session.metadata.universityName,
        transactionId: session.payment_intent,
        paymentStatus: session.payment_status,
        paidAt: new Date(),
      };

      const resultPayment = await paymentCollection.insertOne(payment);

      return res.send({ success: true, payment, resultPayment });
    }

    res.send({ success: false });
  });

  app.get("/payments", verifyFirebaseToken, async (req, res) => {
    if (req.query.email && req.query.email !== req.decoded_email) {
      return res.status(403).send({ message: "forbidden access" });
    }
    const result = await paymentCollection
      .find(req.query.email ? { email: req.query.email } : {})
      .sort({ paidAt: -1 })
      .toArray();
    res.send(result);
  });

  // ================= ANALYTICS =================
  app.get("/analytics/admin-stats", verifyFirebaseToken, verifyAdmin, async (req, res) => {
    const totalUsers = await userCollection.countDocuments();
    const totalScholarships = await scholarshipsCollection.countDocuments();
    const totalApplications = await applicationsCollection.countDocuments();

    const totalPayments = await paymentCollection
      .aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }])
      .toArray();

    res.send({
      totalUsers,
      totalScholarships,
      totalApplications,
      totalFees: totalPayments[0]?.total || 0,
    });
  });

  app.get("/analytics/student-stats/:email", verifyFirebaseToken, async (req, res) => {
    if (req.decoded_email !== req.params.email) {
      return res.status(403).send({ message: "forbidden access" });
    }

    const apps = await applicationsCollection
      .find({ userEmail: req.params.email })
      .toArray();

    res.send({
      totalApplied: apps.length,
      pending: apps.filter(a => !a.applicationStatus || a.applicationStatus === "pending").length,
      processing: apps.filter(a => a.applicationStatus === "processing").length,
      completed: apps.filter(a => a.applicationStatus === "completed").length,
      rejected: apps.filter(a => a.applicationStatus === "rejected").length,
    });
  });

  app.get("/analytics/chart-data", verifyFirebaseToken, verifyAdmin, async (req, res) => {
    const result = await applicationsCollection
      .aggregate([
        { $group: { _id: "$scholarshipCategory", count: { $sum: 1 } } },
      ])
      .toArray();

    res.send(result.map(i => ({ name: i._id || "Unknown", value: i.count })));
  });

  app.get("/analytics/moderator-stats", verifyFirebaseToken, verifyModerator, async (req, res) => {
    const apps = await applicationsCollection.find().toArray();
    res.send({
      totalApplied: apps.length,
      pending: apps.filter(a => !a.applicationStatus || a.applicationStatus === "pending").length,
      processing: apps.filter(a => a.applicationStatus === "processing").length,
      completed: apps.filter(a => a.applicationStatus === "completed").length,
    });
  });

  // ================= REVIEWS =================
  app.post("/reviews", verifyFirebaseToken, async (req, res) => {
    const result = await reviewsCollection.insertOne({
      ...req.body,
      createdAt: new Date(),
    });
    res.send(result);
  });

  app.get("/reviews/:email", verifyFirebaseToken, async (req, res) => {
    if (req.decoded_email !== req.params.email) {
      return res.status(403).send({ message: "forbidden access" });
    }
    const result = await reviewsCollection
      .find({ userEmail: req.params.email })
      .toArray();
    res.send(result);
  });

  app.get("/reviews/scholarship/:scholarshipId", verifyFirebaseToken, async (req, res) => {
    const result = await reviewsCollection
      .find({ scholarshipId: req.params.scholarshipId })
      .toArray();
    res.send(result);
  });

  app.get("/all-reviews", verifyFirebaseToken, verifyModerator, async (req, res) => {
    const result = await reviewsCollection.find().toArray();
    res.send(result);
  });

  app.delete("/reviews/:id", verifyFirebaseToken, async (req, res) => {
    const result = await reviewsCollection.deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.send(result);
  });

  app.patch("/reviews/:id", verifyFirebaseToken, async (req, res) => {
    const result = await reviewsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          ratingPoint: req.body.ratingPoint,
          reviewComment: req.body.reviewComment,
        },
      }
    );
    res.send(result);
  });
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Scholar Stream Server");
});

app.listen(port, () => {
  console.log("port running on", port);
});
