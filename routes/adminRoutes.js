const express = require("express");
const User = require("../models/User");
const { protect, admin } = require("../middleware/authMiddleware");
const nodemailer = require("nodemailer");

const router = express.Router();

// 🔹 Temporary in-memory store for OTPs
let adminRegisterOtpStore = {};

// ==========================
// 📍 GET ALL USERS
// ==========================
router.get("/", protect, admin, async (req, res) => {
  try {
    const users = await User.find({}, "-password");
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// ==========================
// 📍 STEP 1: ADMIN SENDS OTP FOR NEW USER
// ==========================
router.post("/send-otp", protect, admin, async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP + user data in memory for 10 mins
    adminRegisterOtpStore[email] = {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 min
      data: { name, email, password, role },
    };

    // Send email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"Rabbit Admin" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Account Verification - Rabbit",
      text: `Hello ${name},\n\nYou’ve been invited by an admin to join Rabbit.\nYour OTP is: ${otp}\nThis code will expire in 10 minutes.\n\nRegards,\nRabbit Team`,
    });

    res.json({ message: "OTP sent successfully to user email" });
  } catch (error) {
    console.error("Admin Send OTP Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// ==========================
// 📍 STEP 2: ADMIN VERIFIES OTP AND CREATES USER
// ==========================
router.post("/verify-otp", protect, admin, async (req, res) => {
  const { email, otp } = req.body;

  try {
    const entry = adminRegisterOtpStore[email];
    if (!entry) {
      return res.status(400).json({ message: "No OTP found for this email" });
    }

    // Check expiry
    if (entry.expiresAt < Date.now()) {
      delete adminRegisterOtpStore[email];
      return res.status(400).json({ message: "OTP expired" });
    }

    // Check OTP match
    if (entry.otp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Create user after OTP verification
    const { name, password, role } = entry.data;
    const newUser = new User({ name, email, password, role: role || "customer" });
    await newUser.save();

    // Clean up
    delete adminRegisterOtpStore[email];

    res.status(201).json({
      message: "User created successfully after OTP verification",
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Admin Verify OTP Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// ==========================
// 📍 UPDATE USER (Role, Name, Email)
// ==========================
router.put("/:id", protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = req.body.name || user.name;
    user.email = req.body.email || user.email;
    user.role = req.body.role || user.role;

    const updatedUser = await user.save();
    res.json({ message: "User updated successfully", user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// ==========================
// 📍 DELETE USER
// ==========================
router.delete("/:id", protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      await user.deleteOne();
      res.json({ message: "User deleted successfully" });
    } else {
      res.status(404).json({ message: "User not found" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
