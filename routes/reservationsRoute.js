const express = require("express");
const router = express.Router();
const Reservation = require("../models/Reservation");
const User = require("../models/User");
const findPlace = require("../utils/findPlace");
const fetchAll = require("../utils/fetchAll");
const checkAuthorization = require("../utils/checkAuthorization");
const acceptMail = require("../utils/acceptMail");
const rejectMail = require("../utils/rejectMail");
const employeeChecker = require("../middleware/employeeChecker");

router.get("/", employeeChecker, async (req, res) => {
  try {
    const { ID, category } = req.query;

    if (!ID || !category)
      return res.status(400).send({ error: "ID/category is missing" });

    const place = await findPlace(ID, category);

    if (!place) return res.status(400).send({ error: `${category} not found` });

    const isAuthorized = checkAuthorization(req.user.userID, place);
    if (!isAuthorized)
      return res.status(403).send({ error: "Unauthorized access" });

    const count = parseInt(req.query.count) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * count;
    const reservationsCount = await Reservation.countDocuments({
      ID: ID,
      status: "pending",
    });
    const totalPages = Math.ceil(reservationsCount / count);
    const reservations = await Reservation.find({ ID: ID, status: "pending" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(count);

    res.send({
      page,
      totalPages,
      reservationsCount,
      reservations,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Error getting reservations" });
  }
});

router.get("/all", employeeChecker, async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 20;
    const page = parseInt(req.query.page) || 1;

    const all = await fetchAll(req.user.userID);

    const startIndex = (page - 1) * count;

    const matchQuery = { ID: { $in: all.map((item) => item.ID) } };
    if (
      req.query.status &&
      (req.query.status == "pending" ||
        req.query.status == "accepted" ||
        req.query.status == "rejected" ||
        req.query.status == "attended")
    ) {
      matchQuery.status = req.query.status;
    }

    const matchStage = { $match: matchQuery };

    const sortStage = { $sort: { createdAt: -1 } };
    const skipStage = { $skip: startIndex };
    const limitStage = { $limit: count };

    const [reservations, totalCount] = await Promise.all([
      Reservation.aggregate([matchStage, sortStage, skipStage, limitStage]),
      Reservation.aggregate([matchStage, { $count: "totalCount" }]),
    ]);

    const totalPages = Math.ceil(totalCount[0]?.totalCount / count) || 1;

    res.send({
      page,
      totalPages,
      reservationsCount: totalCount[0]?.totalCount || 0,
      reservations,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Error getting reservations" });
  }
});

router.get("/:id", employeeChecker, async (req, res) => {
  try {
    const reservation_data = await Reservation.findOne({
      reservationID: req.params.id,
    });

    if (!reservation_data)
      return res
        .status(404)
        .send({ error: `No reservation with ID: ${req.params.id}` });

    const user = await User.findOne(
      { userID: reservation_data.userID },
      { password: 0 }
    );

    if (!user) return res.status(400).send({ error: "User not found" });

    const reservation = Object.assign(
      {},
      reservation_data.toObject(),
      user.toObject()
    );

    res.send(reservation);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Error getting reservations" });
  }
});

router.post("/accept", employeeChecker, async (req, res) => {
  try {
    const { reservationID, ID, category } = req.body;

    if (!reservationID || !ID || !category)
      return res
        .status(400)
        .send({ error: "Please fill all the required info" });

    const place = await findPlace(ID, category);

    if (!place) return res.status(400).send({ error: `${category} not found` });

    const isAuthorized = checkAuthorization(req.user.userID, place);
    if (!isAuthorized)
      return res.status(403).send({ error: "Unauthorized action" });

    const reservation = await Reservation.findOne({
      reservationID: reservationID,
    });
    if (!reservation)
      return res
        .status(404)
        .send({ error: `No reservation with ID: ${reservationID}` });

    if (
      reservation.status == "accepted" ||
      reservation.status == "rejected" ||
      reservation.status == "attended"
    )
      return res
        .status(400)
        .send({ error: `Reservation already ${reservation.status}` });

    reservation.status = "accepted";
    await reservation.save();

    const user = await User.findOne({ userID: reservation.userID });
    console.log(user.email);
    acceptMail(
      user.firstName,
      user.email,
      reservation.reservationID,
      place,
      reservation.time,
      reservation.date,
      reservation.people
    );

    res.send({ message: "Acceptance email sent" });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: "Couldn't accept reservation" });
  }
});

router.post("/reject", employeeChecker, async (req, res) => {
  try {
    const { reservationID, ID, category } = req.body;

    if (!reservationID || !ID || !category)
      return res
        .status(400)
        .send({ error: "Please fill all the required info" });

    const place = await findPlace(ID, category);

    if (!place) return res.status(400).send({ error: `${category} not found` });

    const isAuthorized = checkAuthorization(req.user.userID, place);
    if (!isAuthorized)
      return res.status(403).send({ error: "Unauthorized action" });

    const reservation = await Reservation.findOne({
      reservationID: reservationID,
    });
    if (!reservation)
      return res
        .status(404)
        .send({ error: `No reservation with ID: ${reservationID}` });

    if (
      reservation.status == "accepted" ||
      reservation.status == "rejected" ||
      reservation.status == "attended"
    )
      return res
        .status(400)
        .send({ error: `Reservation already ${reservation.status}` });

    reservation.status = "rejected";
    await reservation.save();

    const user = await User.findOne({ userID: reservation.userID });
    rejectMail(user.firstName, user.email);

    res.send({ message: "Rejection email sent" });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: "Couldn't reject reservation" });
  }
});

router.post("/attended", employeeChecker, async (req, res) => {
  try {
    const { reservationID, ID, category } = req.body;

    if (!reservationID || !ID || !category)
      return res
        .status(400)
        .send({ error: "Please fill all the required info" });

    const place = await findPlace(ID, category);

    if (!place) return res.status(400).send({ error: `${category} not found` });

    const isAuthorized = checkAuthorization(req.user.userID, place);
    if (!isAuthorized)
      return res.status(403).send({ error: "Unauthorized action" });

    const reservation = await Reservation.findOne({
      reservationID: reservationID,
    });
    if (!reservation)
      return res
        .status(404)
        .send({ error: `No reservation with ID: ${reservationID}` });

    if (reservation.status == "attended" || reservation.status == "rejected")
      return res
        .status(400)
        .send({ error: "Reservation already marked as attended" });

    reservation.status = "attended";
    await reservation.save();

    // const user = await User.findOne({ userID: reservation.userID });
    // rejectMail(user.firstName, user.email);

    res.send({ message: "Reservation attended" });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: "Couldn't mark reservation as attended" });
  }
});

module.exports = router;
