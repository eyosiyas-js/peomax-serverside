const express = require('express')
const Hotel = require('../models/Hotel')
const Restaurant = require('../models/Restaurant')
const Bar = require('../models/Bar')
const Club = require('../models/Club')
const Event = require('../models/Event')
const {
  createDiningService,
  editDiningService,
} = require('../controllers/diningService')
const managerChecker = require('../middleware/managerChecker')
const moment = require('moment-timezone')

const multer = require('multer')
const { existsSync, mkdirSync } = require('fs')
const { join } = require('path')

const storage = join(process.cwd(), './uploads')

if (!existsSync(storage)) {
  mkdirSync(storage)
}

const uploads = multer({
  dest: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
})

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 20
    const page = parseInt(req.query.page) || 1
    const skip = (page - 1) * count
    const hotelsCount = await Hotel.countDocuments({ status: 'approved' })
    const totalPages = Math.ceil(hotelsCount / count)
    const hotels = await Hotel.find({ status: 'approved' })
      .skip(skip)
      .limit(count)
    res.send({
      page,
      totalPages,
      hotelsCount,
      hotels,
    })
  } catch (error) {
    console.error(error)
    res.status(500).send({ error: 'Error getting hotels' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const hotel = await Hotel.findOne({
      ID: req.params.id,
    })

    if (!hotel)
      return res
        .status(404)
        .send({ error: `No hotel with ID: ${req.params.id}` })

    res.send(hotel.toObject())
  } catch (error) {
    console.error(error)
    res.status(500).send({
      error: `Couldn't find a hotel with the ID: ${req.params.id}`,
    })
  }
})

router.get('/:id/restaurants', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 20
    const page = parseInt(req.query.page) || 1
    const skip = (page - 1) * count
    const hotel = await Hotel.findOne({ ID: req.params.id })
    if (!hotel)
      return res
        .status(404)
        .send({ error: `No hotel with ID: ${req.params.id}` })

    const restaurantsCount = await Restaurant.countDocuments({
      managerID: hotel.managerID,
      status: 'approved',
    })
    const totalPages = Math.ceil(restaurantsCount / count)
    const restaurants = await Restaurant.find({
      managerID: hotel.managerID,
      status: 'approved',
    })
      .skip(skip)
      .limit(count)
    res.send({
      page,
      totalPages,
      restaurantsCount,
      restaurants,
    })
  } catch (error) {
    console.error(error)
    res.status(500).send({ error: 'Error getting restaurants' })
  }
})

router.get('/:id/bars', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 20
    const page = parseInt(req.query.page) || 1
    const skip = (page - 1) * count
    const hotel = await Hotel.findOne({ ID: req.params.id })
    if (!hotel)
      return res
        .status(404)
        .send({ error: `No hotel with ID: ${req.params.id}` })

    const barsCount = await Bar.countDocuments({
      managerID: hotel.managerID,
      status: 'approved',
    })
    const totalPages = Math.ceil(barsCount / count)
    const bars = await Bar.find({
      managerID: hotel.managerID,
      status: 'approved',
    })
      .skip(skip)
      .limit(count)
    res.send({
      page,
      totalPages,
      barsCount,
      bars,
    })
  } catch (error) {
    console.error(error)
    res.status(500).send({ error: 'Error getting bars' })
  }
})

router.get('/:id/clubs', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 20
    const page = parseInt(req.query.page) || 1
    const skip = (page - 1) * count
    const hotel = await Hotel.findOne({ ID: req.params.id })
    if (!hotel)
      return res
        .status(404)
        .send({ error: `No hotel with ID: ${req.params.id}` })

    const clubsCount = await Club.countDocuments({
      managerID: hotel.managerID,
      status: 'approved',
    })
    const totalPages = Math.ceil(clubsCount / count)
    const clubs = await Club.find({
      managerID: hotel.managerID,
      status: 'approved',
    })
      .skip(skip)
      .limit(count)
    res.send({
      page,
      totalPages,
      clubsCount,
      clubs,
    })
  } catch (error) {
    console.error(error)
    res.status(500).send({ error: 'Error getting clubs' })
  }
})

router.get('/:id/related', async (req, res) => {
  try {
    const hotel = await Hotel.findOne({
      ID: req.params.id,
    })

    if (!hotel)
      return res.status(400).send({ error: `No hotel found with ID:  ${ID}` })

    const related_hotels = await Hotel.find({
      $and: [
        { ID: { $ne: hotel.ID } },
        {
          $or: [
            { name: { $regex: new RegExp(hotel.name, 'i') } },
            { managerID: hotel.managerID },
            {
              location: {
                $regex: new RegExp(hotel.location, 'i'),
              },
            },
            { rating: { $regex: new RegExp(hotel.rating, 'i') } },
          ],
        },
      ],
    })

    if (related_hotels.length == 0)
      return res.status(400).send({ error: 'No related hotels found' })
    res.send(related_hotels)
  } catch (error) {
    console.error(error)
    res.status(500).send({ error: 'Error finding related hotels' })
  }
})

router.post(
  '/create',
  managerChecker,
  uploads.array('images', 10),
  async (req, res) => {
    await createDiningService(req, res, Hotel)
  },
)

router.put(
  '/:id/edit',
  managerChecker,
  uploads.array('images', 10),
  async (req, res) => {
    await editDiningService(req, res, Hotel)
  },
)

router.delete('/:id/delete', managerChecker, async (req, res) => {
  try {
    const hotel = await Hotel.findOne({
      ID: req.params.id,
    })

    if (!hotel) return res.status(404).send('hotel not found')

    if (hotel.managerID !== req.user.userID)
      return res.status(403).send({ error: 'Unauthorized' })

    if (hotel.status == 'deleted')
      return res.status(400).send({ error: 'hotel is already removed' })

    hotel.status = 'deleted'
    await hotel.save()

    res.send({
      message: `hotel with ID ${req.params.id} has been deleted`,
    })
  } catch (error) {
    console.error(error)
    res.status(500).send({ error: 'Error deleting hotel' })
  }
})

router.get('/:id/events', async (req, res) => {
  try {
    if (!req.params.id) return res.status(404).send({ error: 'No id provided' })
    const currentDate = moment.tz('Africa/Nairobi') // Get current date in Nairobi timezone

    const events = await Event.find({
      ID: req.params.id,
      category: 'hotel',
      status: { $ne: 'deleted' },
    })
    const filteredEvents = events.filter((event) => {
      const eventDate = moment.tz(event.endDate, 'MM/DD/YYYY', 'Africa/Nairobi') // Assuming event.date is in MM/DD/YYYY format
      return eventDate.isSameOrAfter(currentDate, 'day') // Compare event date with current date
    })

    res.send(filteredEvents)
  } catch (error) {
    console.error(error)
    res.status(500).send({ error: 'Error fetching events' })
  }
})

router.get('/:id/programs', async (req, res) => {
  try {
    if (!req.params.id) return res.status(404).send({ error: 'No id provided' })

    const events = await Event.find({
      ID: req.params.id,
      category: 'hotel',
      program: true,
      status: { $ne: 'deleted' },
    })

    res.send(events)
  } catch (error) {
    console.error(error)
    res.status(500).send({ error: 'Error fetching events' })
  }
})

module.exports = router
