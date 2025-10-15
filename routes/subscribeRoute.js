const express = require("express");
const Subscriber = require("../models/Subscriber");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
dotenv.config();

// Nodemailer transporter config
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  },
});

// @route POST /api/subscribe
// @desc Handle newsletter subscription
// @access Private (since you used protect)
router.post("/", protect, async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    // Check if email is already subscribed
    let subscriber = await Subscriber.findOne({ email });

    if (subscriber) {
      return res.status(400).json({ message: "Email is already subscribed" });
    }

    // Create new subscriber
    subscriber = new Subscriber({ email });
    await subscriber.save();

    // Send confirmation email
    await transporter.sendMail({
      from: `"Fancy Shop" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🎉 Subscription Successful!",
      html: `
        <h2>Welcome to Fancy Shop!</h2>
        <p>Thank you for subscribing to our newsletter. 🎁</p>
        <p>You’ll now be the first to know about our new products, offers, and events.</p>
        <br/>
        <small>If this wasn’t you, please ignore this email.</small>
      `,
    });

    res.status(201).json({
      message: "Successfully subscribed to the newsletter! Confirmation email sent.",
    });
  } catch (error) {
    console.error("Subscription Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
