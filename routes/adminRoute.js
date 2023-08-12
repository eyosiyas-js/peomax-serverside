const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const User = require("../models/User.js");
const Bar = require("../models/Bar");
const Club = require("../models/Club");
const Hotel = require("../models/Hotel");
const Restaurant = require("../models/Restaurant");
const Reservation = require("../models/Reservation.js");
const Token = require("../models/Token.js");
const { validateLoginData } = require("../utils/validator.js");
const adminChecker = require("../middleware/adminChecker.js");
const findPlace = require("../utils/findPlace.js");
const fetchAll = require("../utils/fetchAll.js");
const router = express.Router();

const dotenv = require("dotenv");
dotenv.config();

function splitArray(sortedArray, separator) {
  const prevArray = [];
  const postArray = [];

  for (let i = 0; i < sortedArray.length; i++) {
    const value = sortedArray[i];
    if (value.rank <= separator) {
      prevArray.push(value);
    } else {
      postArray.push(value);
    }
  }

  return [prevArray, postArray];
}

router.post("/login", async (req, res) => {
  try {
    const valid = await validateLoginData(req.body);
    if (!valid.success) return res.status(400).send({ error: valid.message });

    const { email, password } = req.body;
    const user = await User.findOne({ email: email, role: "admin" });
    if (!user) {
      res.status(404).send({ error: "Admin not found." });
    } else {
      const userData = {
        password: user.password,
        email: user.email,
        userID: user.userID,
        role: "admin",
      };

      const userPassword = user.password;
      const isMatch = await bcrypt.compare(password, userPassword);

      if (!isMatch) res.status(400).send({ error: "password incorrect!" });

      delete userData.password;

      const token1 = await jwt.sign(
        userData,
        process.env.access_token_secret_key,
        {
          expiresIn: "30d",
        }
      );

      const token2 = await jwt.sign(
        userData,
        process.env.refresh_token_secret_key,
        {
          expiresIn: "60d",
        }
      );

      const token = `Bearer ${token1}`;
      const refresh_token = `Bearer ${token2}`;

      const newRefreshToken = new Token({
        userID: userData.userID,
        token: refresh_token,
      });
      await newRefreshToken.save();

      res.send({ token, refresh_token, userData });
    }
  } catch (error) {
    res.status(500).send("Could not login to admin");
    console.log(error);
  }
});

router.post("/approve", adminChecker, async (req, res) => {
  try {
    const { ID, category } = req.body;
    if (!ID || !category)
      return res.status(400).send({ error: "ID/category missing" });

    const place = await findPlace(ID, category);
    if (!place)
      return res.status(400).send({ error: `No ${category} with ID: ${ID}` });

    place.status = "approved";
    await place.save();

    res.send({ message: `${category} approved` });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: "Could not approve submission" });
  }
});

router.post("/reject", adminChecker, async (req, res) => {
  try {
    const { ID, category } = req.body;
    if (!ID || !category)
      return res.status(400).send({ error: "ID/category missing" });

    const place = await findPlace(ID, category);
    if (!place)
      return res.status(400).send({ error: `No ${category} with ID: ${ID}` });

    place.status = "rejected";
    await place.save();

    res.send({ message: `${category} rejected` });
  } catch (error) {
    console.log(error);
    res.status(400).send({ error: "Could not reject submission" });
  }
});

router.get("/totals", adminChecker, async (req, res) => {
  try {
    function getReservationsByMonth(reservations) {
      const reservationsByMonth = Array(12).fill(0);
      for (let i = 0; i < reservations.length; i++) {
        const reservation = reservations[i];
        const createdAt = new Date(reservation.createdAt);
        const month = createdAt.getUTCMonth();
        reservationsByMonth[month]++;
      }
      return reservationsByMonth;
    }

    const reservations = await Reservation.find({});
    const perMonth = getReservationsByMonth(reservations);

    res.send({
      users: {
        total: await User.countDocuments({}),
        banned: await User.countDocuments({ isBanned: true }),
        clients: await User.countDocuments({ role: "client" }),
        managers: await User.countDocuments({ role: "manager" }),
        supervisors: await User.countDocuments({ role: "supervisor" }),
        employees: await User.countDocuments({ role: "employee" }),
      },
      bars: {
        total: await Bar.countDocuments({}),
        pending: await Bar.countDocuments({ status: "pending" }),
        approved: await Bar.countDocuments({ status: "approved" }),
        rejected: await Bar.countDocuments({ status: "rejected" }),
      },
      clubs: {
        total: await Club.countDocuments({}),
        pending: await Club.countDocuments({ status: "pending" }),
        approved: await Club.countDocuments({ status: "approved" }),
        rejected: await Club.countDocuments({ status: "rejected" }),
      },
      hotels: {
        total: await Hotel.countDocuments({}),
        pending: await Hotel.countDocuments({ status: "pending" }),
        approved: await Hotel.countDocuments({ status: "approved" }),
        rejected: await Hotel.countDocuments({ status: "rejected" }),
      },
      restaurants: {
        total: await Restaurant.countDocuments({}),
        pending: await Restaurant.countDocuments({ status: "pending" }),
        approved: await Restaurant.countDocuments({ status: "approved" }),
        rejected: await Restaurant.countDocuments({ status: "rejected" }),
      },
      reservations: {
        total: await Reservation.countDocuments({}),
        pending: await Reservation.countDocuments({ status: "pending" }),
        accepted: await Reservation.countDocuments({ status: "accepted" }),
        rejected: await Reservation.countDocuments({ status: "rejected" }),
        perMonth,
      },
    });
  } catch (err) {
    console.log(err);
    res.status(400).send({ error: "Error getting total items" });
  }
});

router.get("/pending", adminChecker, async (req, res) => {
  try {
    const hotels = await Hotel.find({ status: "pending" });
    const restaurants = await Restaurant.find({ status: "pending" });
    const bars = await Bar.find({ status: "pending" });
    const clubs = await Club.find({ status: "pending" });
    const items = hotels.concat(restaurants, bars, clubs);

    const count = parseInt(req.query.count) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * count;
    const itemsCount = items.length;
    const totalPages = Math.ceil(itemsCount / count);

    const paginatedData = items.slice(skip, skip + count);

    res.send({
      page,
      totalPages,
      itemsCount,
      items: paginatedData,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: `Error` });
  }
});

router.get("/reservations/:id", adminChecker, async (req, res) => {
  try {
    const ID = req.params.id;
    const count = parseInt(req.query.count) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * count;
    const reservationsCount = await Reservation.countDocuments({
      ID,
    });
    const totalPages = Math.ceil(reservationsCount / count);
    const reservations = await Reservation.find({ ID })
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

router.post("/feature", adminChecker, async (req, res) => {
  try {
    const { ID, category } = req.query;

    if (!ID || !category)
      return res.status(400).send({ error: "ID/category is missing" });

    const place = await findPlace(ID, category);
    if (!place) return res.status(400).send({ error: `${category} not found` });

    if (place.isPremium)
      return res
        .status(400)
        .send({ error: `${place.name} is already set as premium` });

    place.isPremium = true;
    await place.save();

    res.send({
      message: `${place.name} is featured successfully`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Error getting reservations" });
  }
});

router.post("/rank", adminChecker, async (req, res) => {
  try {
    const { ID, category, rank } = req.body;

    if (!ID || !category || !rank)
      return res.status(400).send({ error: "ID/category/rank is missing" });

    if (isNaN(parseInt(rank)) || rank == 0) {
      return res.status(400).send({ error: "rank is invalid" });
    }

    const place = await findPlace(ID, category);
    if (!place) return res.status(400).send({ error: `${category} not found` });

    const all = await fetchAll();
    const sortedItems = all.sort((a, b) => a.rank - b.rank);

    const [prevArray, postArray] = splitArray(sortedItems, rank - 1);

    // let outputArray = postArray.filter((item) => item.ID !== place.ID);

    // for (let i = 0; i < outputArray.length; i++) {
    //   const item = outputArray[i];

    //   item.rank = item.rank + 1;
    //   await item.save();
    // }

    // place.rank = rank;
    // await place.save();

    res.send({
      message: `${place.name} is ranked ${rank}`,
      postArray,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Could not perform action" });
  }
});

module.exports = router;
