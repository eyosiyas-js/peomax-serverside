const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  userID: {
    type: String,
    require: true,
  },
  code: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["email verification", "reset password"],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: "10m",
  },
});

const OTP = mongoose.model("OTP", otpSchema);

module.exports = OTP;
