let express = require("express");
let cors = require("cors");
let { mongoose } = require("mongoose");
let User = require("./models/User");
let bcrypt = require("bcryptjs");
let app = express();
let jwt = require("jsonwebtoken");
let cookieParser = require("cookie-parser");
let multer = require("multer");
let uploadMiddleware = multer({ dest: "uploads/" });
let fs = require("fs");
let Post = require("./models/Post");
require("dotenv").config();

let salt = bcrypt.genSaltSync(10);
let secret = process.env.SECRET;

app.use(cors({ credentials: true, origin: "http://localhost:3000" }));
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(__dirname + "/uploads"));

mongoose.connect(process.env.MONGO_URL);
app.post("/register", async (req, res) => {
  try {
    let { username, password } = req.body;

    // Check if the username already exists
    let existingUser = await User.findOne({ username });

    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Create a new user
    let userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });

    res.json(userDoc);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    let { username, password } = req.body;

    // Find the user by username
    let userDoc = await User.findOne({ username });

    if (!userDoc) {
      return res.status(400).json({ message: "User not found" });
    }

    let passOk = bcrypt.compareSync(password, userDoc.password);

    if (passOk) {
      // Generate a JWT token
      jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
        if (err) throw err;
        res.cookie("token", token).json({
          message: "Logged in successfully",
          id: userDoc._id,
          username,
        });
      });
    } else {
      res.status(400).json({ message: "Wrong credentials" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/profile", (req, res) => {
  let { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) throw err;
    res.json(info);
  });
});

app.post("/logout", (req, res) => {
  res.cookie("token", "").json("Logged out successfully");
});

app.post("/post", uploadMiddleware.single("file"), async (req, res) => {
  let { originalname, path } = req.file;
  let parts = originalname.split(".");
  let ext = parts[parts.length - 1];
  let newPath = path + "." + ext;
  fs.renameSync(path, newPath);

  let { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;

    let { title, summary, content } = req.body;
    let postDoc = await Post.create({
      title,
      summary,
      content,
      cover: newPath,
      author: info.id,
    });

    res.json(postDoc);
  });
});

app.put("/post", uploadMiddleware.single("file"), async (req, res) => {
  let newPath = null;
  if (req.file) {
    let { originalname, path } = req.file;
    let parts = originalname.split(".");
    let ext = parts[parts.length - 1];
    newPath = path + "." + ext;
    fs.renameSync(path, newPath);
  }

  let { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) throw err;
    let { id, title, summary, content } = req.body;
    let postDoc = await Post.findById(id);
    let isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json("you are not the author");
    }
    await postDoc.updateOne({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDoc.cover,
    });
    res.json(postDoc);
  });
});

app.get("/post", async (req, res) => {
  res.json(
    await Post.find()
      .populate("author", ["username"])
      .sort({ createdAt: -1 })
      .limit(20)
  );
});

app.get("/post/:id", async (req, res) => {
  let { id } = req.params;
  let postDoc = await Post.findById(id).populate("author", ["username"]);
  res.json(postDoc);
});

app.listen(process.env.PORT, () => {
  try {
    console.log("Server is live at port 4000");
  } catch (error) {
    console.log(error);
  }
});
