// we need a router from express, so create express, import model,

const express = require("express");
const User = require("../models/User");

//const User = require("../models/User");
const router = express.Router();
const crypto = require("crypto");
const nodemailer = require("nodemailer")

const jwt = require("jsonwebtoken");
const { protect } = require("../middleware/authMiddleware");
let registerOtpStore = {};

// @route POST /api/users/register
// @desc Register a new user
// @access Public

router.post("/register", async (req, res) => {
  console.log("Request received at /register"); // Log when the route is hit
  console.log("Request body:", req.body); // Log the incoming request body
  const { name, email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User Already exists" });

    user = new User({ name, email, password });
    console.log(user, "user");
    //return;
    await user.save(); //it saves the data into mongodb datbase as a User Collection

    //create JWT payload
    const payload = { user: { id: user._id, role: user.role } };

    //Sign and return the token along with the user data
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "45h" },
      (err, token) => {
        if (err) throw err;

        //Send the user and token in response and create a JWT token
        res.status(201).json({
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          token,
        });
      }
    );
  } catch (error) {
    console.log(error);
    res.status(500).send("Server Error");
  }
});

// @route POST /api/users/login
// @desc Authenticate user
// @access Public

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({
        message: "User doesn't exist!",
      });

    const isMatch = await user.matchPassword(password);

    if (!isMatch)
      return res.status(400).json({ message: "Invalid Credentials" });

    //create JWT payload
    const payload = { user: { id: user._id, role: user.role } };

    //Sign and return the token along with the user data
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "45h" },
      (err, token) => {
        if (err) throw err;

        //Send the user and token in response and create a JWT token
        res.status(201).json({
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          token,
        });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
});

router.get("/profile", protect, async (req, res) => {
  res.json(req.user);
});

//  Forgot Password - Send OTP
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP & expiry (10 minutes)
    user.resetPasswordToken = otp;
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
    await user.save();

    // Send email with OTP
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Your Password Reset OTP",
      text: `Your OTP is: ${otp}. It will expire in 10 minutes.`,
    });

    res.json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify OTP
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({
      email,
      resetPasswordToken: otp,
      resetPasswordExpire: { $gt: Date.now() }, // not expired
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    res.json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//Reset Password
router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    const user = await User.findOne({
      email,
      resetPasswordToken: otp,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Update password
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route POST /api/users/register/send-otp
// @desc Send OTP before registering
// @access Public
router.post("/register/send-otp", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with user data (expire in 10 min)
    registerOtpStore[email] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      data: { name, email, password },
    };

    // Send OTP email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify your email - Rabbit",
      text: `Your OTP is: ${otp}. It expires in 10 minutes.`,
    });

    res.json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("Register Send OTP Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// @route POST /api/users/register/verify-otp
// @desc Verify OTP and complete registration
// @access Public
router.post("/register/verify-otp", async (req, res) => {
  const { email, otp } = req.body;

  try {
    const entry = registerOtpStore[email];
    if (!entry) return res.status(400).json({ message: "No OTP requested" });

    if (entry.expiresAt < Date.now()) {
      delete registerOtpStore[email];
      return res.status(400).json({ message: "OTP expired" });
    }

    if (entry.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // OTP valid → create user
    const { name, password } = entry.data;
    let user = new User({ name, email, password });
    await user.save();

    // Clean up OTP store
    delete registerOtpStore[email];

    // Create JWT payload
    const payload = { user: { id: user._id, role: user.role } };

    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: "45h" },
      (err, token) => {
        if (err) throw err;
        res.status(201).json({
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
          token,
        });
      }
    );
  } catch (error) {
    console.error("Register Verify OTP Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
