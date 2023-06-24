const express = require("express");
const Bar = require("../models/Bar");
const Event = require("../models/Event");
const managerChecker = require("../middleware/managerChecker");
const { uid } = require("uid");

const multer = require("multer");
const { unlinkSync, existsSync, mkdirSync } = require("fs");
const { join } = require("path");
const uploadFile = require("../utils/upload");

const storage = join(process.cwd(), "./uploads");
const formats = require("../utils/formats");

if (!existsSync(storage)) {
  mkdirSync(storage);
}

const uploads = multer({ dest: storage });

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 20;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * count;
    const barsCount = await Bar.countDocuments({});
    const totalPages = Math.ceil(barsCount / count);
    const bars = await Bar.find({}).skip(skip).limit(count);
    res.send({
      page,
      totalPages,
      barsCount,
      bars,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Error getting bars" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const bar = await Bar.findOne({
      ID: req.params.id,
    });
    res.send(bar.toObject());
  } catch (error) {
    console.error(error);
    res.status(500).send({
      error: `Couldn't find a bar with the ID: ${req.params.id}`,
    });
  }
});

router.get("/:id/related", async (req, res) => {
  try {
    const bar = await Bar.findOne({
      ID: req.params.id,
    });

    if (!bar)
      return res.status(400).send({ error: `No bar found with ID:  ${ID}` });

    const related_bars = await Bar.find({
      $and: [
        { ID: { $ne: bar.ID } },
        {
          $or: [
            { name: { $regex: new RegExp(bar.name, "i") } },
            { managerID: bar.managerID },
            {
              location: {
                $regex: new RegExp(bar.location, "i"),
              },
            },
            { rating: { $regex: new RegExp(bar.rating, "i") } },
          ],
        },
      ],
    });

    if (related_bars.length == 0)
      return res.status(400).send({ error: "No related bars found" });
    res.send(related_bars);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Error finding related bars" });
  }
});

router.post(
  "/create",
  managerChecker,
  uploads.array("images", 10),
  async (req, res) => {
    try {
      const files = await req.files;
      let hasInvalidFile = false;
      const images = await Promise.all(
        files.map(async (file) => {
          const { path, filename, mimetype } = file;
          if (!formats.includes(mimetype)) {
            unlinkSync(path);
            hasInvalidFile = true;
            return;
          } else {
            const response = await uploadFile(path, filename, mimetype);
            if (response.status !== "error") return response.url;
            if (response.status !== "error") return "none";
          }
        })
      );

      if (hasInvalidFile)
        return res.status(400).send({ error: "Invalid file type detected" });

      files.map((file) => unlinkSync(file.path));

      const {
        name,
        description,
        location,
        tables,
        availableSpots,
        totalSpots,
        openingTime,
        closingTime,
        numReviews,
        totalBooks,

        crossStreet,
        neighborhood,
        cuisines,
        diningStyle,
        dressCode,
        parkingDetails,
        publicTransit,
        paymentOptions,
        additional,
        phoneNumber,
        website,
      } = req.body;

      const managerID = req.user.userID;

      const bar = new Bar({
        name: name,
        description: description,
        location: location,
        branches: req.body.branches ? req.body.branches : [],
        image: images[0],
        images: images,
        rating: req.body.rating ? req.body.rating : 0,
        tables: tables,
        managerID: managerID,
        availableSpots: availableSpots,
        totalSpots: totalSpots,
        totalSpots: totalBooks,
        openingTime: openingTime,
        closingTime: closingTime,
        numReviews: numReviews,
        totalBooks: totalBooks,
        ID: uid(16),

        crossStreet: crossStreet,
        neighborhood: neighborhood,
        cuisines: cuisines,
        diningStyle: diningStyle,
        dressCode: dressCode,
        parkingDetails: parkingDetails,
        publicTransit: publicTransit,
        paymentOptions: paymentOptions,
        additional: additional,
        phoneNumber: phoneNumber,
        website: website,
      });

      await bar.save();

      res.send(bar);
    } catch (error) {
      res.status(500).send({ error: "Error adding bar" });
      console.log(error);
    }
  }
);

router.put(
  "/:id/edit",
  managerChecker,
  uploads.array("images", 10),
  async (req, res) => {
    async function update(req, res, images) {
      const urls = images || [];
      const {
        name,
        description,
        location,
        tables,
        availableSpots,
        totalSpots,
        openingTime,
        closingTime,
        numReviews,
        totalBooks,

        crossStreet,
        neighborhood,
        cuisines,
        diningStyle,
        dressCode,
        parkingDetails,
        publicTransit,
        paymentOptions,
        additional,
        phoneNumber,
        website,
      } = req.body;

      const bar = await Bar.findOne({
        ID: req.params.id,
      });

      if (!bar)
        return res
          .status(403)
          .send({ error: `No bar with ID: ${req.params.id} found` });

      if (bar.managerID !== req.user.userID)
        return res.status(403).send({ error: "Unauthorized" });

      bar.name = name ?? bar.name;
      bar.description = description ?? bar.description;
      bar.location = location ?? bar.location;
      bar.branches = req.body.branches || [];
      bar.image = urls.length !== 0 ? urls[0] : bar.image;
      bar.images = urls.length !== 0 ? urls : bar.images;
      bar.rating = req.body.rating || 0;
      bar.tables = tables ?? bar.tables;
      bar.availableSpots = availableSpots ?? bar.availableSpots;
      bar.totalSpots = totalSpots ?? bar.totalSpots;
      bar.totalBooks = totalBooks ?? bar.totalSpots;
      bar.openingTime = openingTime ?? bar.openingTime;
      bar.closingTime = closingTime ?? bar.closingTime;
      bar.numReviews = numReviews ?? bar.numReviews;
      bar.totalBooks = totalBooks ?? bar.totalBooks;

      bar.crossStreet = crossStreet ?? bar.crossStreet;
      bar.neighborhood = neighborhood ?? bar.neighborhood;
      bar.cuisines = cuisines ?? bar.cuisines;
      bar.diningStyle = diningStyle ?? bar.diningStyle;
      bar.dressCode = dressCode ?? bar.dressCode;
      bar.parkingDetails = parkingDetails ?? bar.parkingDetails;
      bar.publicTransit = publicTransit ?? bar.publicTransit;
      bar.paymentOptions = paymentOptions ?? bar.paymentOptions;
      bar.additional = additional ?? bar.additional;
      bar.phoneNumber = phoneNumber ?? bar.phoneNumber;
      bar.website = website ?? bar.website;

      await bar.save();

      res.send(bar.toObject());
    }

    try {
      if (req.query.files == "true") {
        const files = await req.files;
        let hasInvalidFile = false;
        urls = await Promise.all(
          files.map(async (file) => {
            const { path, filename, mimetype } = file;
            if (!formats.includes(mimetype)) {
              unlinkSync(path);
              hasInvalidFile = true;
              return "none";
            } else {
              const response = await uploadFile(path, filename, mimetype);
              if (response.status !== "error") return response.url;
              if (response.status !== "error") return "none";
            }
          })
        );

        if (hasInvalidFile) {
          return res.status(400).send({ error: "Invalid file type" });
        }

        files.map((file) => unlinkSync(file.path));
        update(req, res, urls);
      } else {
        update(req, res);
      }
    } catch (error) {
      res.status(500).send({ error: "Error updating bar" });
      console.log(error);
    }
  }
);

router.delete("/:id/delete", managerChecker, async (req, res) => {
  try {
    const bar = await Bar.findOne({
      ID: req.params.id,
    });

    if (!bar) return res.status(404).send("bar not found");

    if (bar.managerID !== req.user.userID)
      return res.status(403).send({ error: "Unauthorized" });

    await bar.remove();

    res.send({
      message: `bar with ID ${req.params.id} has been deleted`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Error deleting bar" });
  }
});

router.get("/:id/events", async (req, res) => {
  try {
    if (!req.params.id)
      return res.status(404).send({ error: "No id provided" });

    const events = await Event.find({
      ID: req.params.id,
      category: "bars",
    });

    res.send(events);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Error fetching events" });
  }
});

module.exports = router;
