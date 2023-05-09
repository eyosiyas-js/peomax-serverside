const express = require("express");
const Restaurant = require("../models/Restaurant");
const adminChecker = require("../middleware/adminChecker");
const { uid } = require("uid");

const multer = require("multer");
const {
  readFileSync,
  unlinkSync,
  rmSync,
  existsSync,
  mkdirSync,
} = require("fs");
const { join } = require("path");
// const uploadFile = require("../utils/upload.js");

const storage = join(process.cwd(), "./uploads");
const formats = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/bmp",
  "image/webp",
  "image/tiff",
  "image/svg+xml",
  "image/x-icon",
];

if (!existsSync(storage)) {
  mkdirSync(storage);
}

const uploads = multer({ dest: storage });

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const restaurants = await Restaurant.find({});
    res.send(restaurants);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Error getting restaurants" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      restaurantID: req.params.id,
    });
    res.send(restaurant.toObject());
  } catch (error) {
    console.error(error);
    res.status(500).send({
      error: `Couldn't find a restaurant with the ID: ${req.params.id}`,
    });
  }
});

router.get("/:id/related", async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      restaurantID: req.params.id,
    });

    if (!restaurant)
      return res
        .status(400)
        .send({ error: `No restaurant found with ID:  ${restaurantID}` });

    const related_restaurants = await Restaurant.find({
      $and: [
        { restaurantID: { $ne: restaurant.restaurantID } },
        {
          $or: [
            { name: { $regex: new RegExp(restaurant.name, "i") } },
            {
              location: {
                $regex: new RegExp(restaurant.location, "i"),
              },
            },
            { rating: { $regex: new RegExp(restaurant.rating, "i") } },
          ],
        },
      ],
    });

    if (related_restaurants.length == 0)
      return res.status(400).send({ error: "No related restaurants found" });
    res.send(related_restaurants);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Error finding related restaurants" });
  }
});

router.post("/create", uploads.array("images", 5), async (req, res) => {
  try {
    const files = await req.files;
    let hasInvalidFile = false;
    const dataUrls = await Promise.all(
      files.map(async (file) => {
        const { path, mimetype } = file;
        const buffer = readFileSync(path);
        const base64 = buffer.toString("base64");
        unlinkSync(path);
        return `data:${mimetype};base64,${base64}`;
      })
    );

    res.send({ dataUrls });
  } catch (error) {
    res.status(500).send({ error: "Error uploading images" });
    console.log(error);
  }
});

router.post("/add", async (req, res) => {
  try {
    const {
      name,
      description,
      location,
      image,
      images,
      rating,
      tables,
      availableSpots,
      totalSpots,
      openingTime,
      closingTime,
      numReviews,
      totalBooks,
    } = req.body;

    const restaurant = new Restaurant({
      name: name,
      description: description,
      location: location,
      branches: req.body.branches ? req.body.branches : [],
      image: image,
      images: images,
      rating: rating,
      tables: tables,
      availableSpots: availableSpots,
      totalSpots: totalSpots,
      totalSpots: totalBooks,
      openingTime: openingTime,
      closingTime: closingTime,
      numReviews: numReviews,
      totalBooks: totalBooks,
      restaurantID: uid(16),
    });

    await restaurant.save();

    res.send(restaurant.toObject());
  } catch (error) {
    res.status(500).send({ error: "Error updating restaurant" });
    console.log(error);
  }
});

router.put("/:id/edit", adminChecker, async (req, res) => {
  try {
    const {
      name,
      description,
      location,
      image,
      images,
      rating,
      tables,
      availableSpots,
      totalSpots,
      openingTime,
      closingTime,
      numReviews,
      totalBooks,
    } = req.body;
    let restaurant = await Restaurant.findOne({ restaurantID: req.params.id });

    if (!restaurant) {
      return res.status(404).send({ error: "restaurant not found" });
    }

    restaurant.name = name;
    restaurant.description = description;
    restaurant.location = location;
    restaurant.image = image;
    restaurant.images = images;
    restaurant.rating = rating;
    restaurant.tables = tables;
    restaurant.availableSpots = availableSpots;
    restaurant.totalSpots = totalSpots;
    restaurant.totalSpots = totalBooks;
    restaurant.openingTime = openingTime;
    restaurant.closingTime = closingTime;
    restaurant.numReviews = numReviews;
    restaurant.totalBooks = totalBooks;

    await restaurant.save();

    res.send(restaurant.toObject());
  } catch (error) {
    res.status(500).send({ error: "Error updating restaurant" });
    console.log(error);
  }
});

router.delete("/:id/delete", adminChecker, async (req, res) => {
  try {
    const restaurant = await Restaurant.findOne({
      restaurantID: req.params.id,
    });

    if (!restaurant) {
      return res.status(404).send("restaurant not found");
    }

    await restaurant.remove();

    res.send({
      message: `restaurant with ID ${req.params.id} has been deleted`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Error deleting restaurant" });
  }
});

module.exports = router;
