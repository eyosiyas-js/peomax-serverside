const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  ID: {
    type: String,
    required: true,
  },
  availableSpots: {
    type: Number,
    default: 1,
  },
  totalSpots: {
    type: Number,
    default: 1,
  },
  totalBooks: {
    type: Number,
    default: 1,
  },
  date: {
    type: String,
    required: true,
  },
  isFullDay: {
    type: Boolean,
    default: false,
  },
  eventStart: {
    type: String,
    required: true,
    trim: true,
  },
  eventEnd: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
  },
  premiumPrice: {
    type: Number,
    required: true,
  },
  managerID: {
    type: String,
    required: true,
  },
  eventID: {
    type: String,
    require: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Event = mongoose.model("Event", eventSchema);

module.exports = Event;
