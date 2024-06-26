const express = require('express')
const Bar = require('../models/Bar')
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
    const barsCount = await Bar.countDocuments({ status: 'approved' })
    const totalPages = Math.ceil(barsCount / count)
    const bars = await Bar.find({ status: 'approved' }).skip(skip).limit(count)
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

router.get('/:id', async (req, res) => {
  try {
    const bar = await Bar.findOne({
      ID: req.params.id,
      status: 'approved',
    })

    if (!bar)
      return res.status(404).send({ error: `No bar with ID: ${req.params.id}` })

    res.send(bar.toObject())
  } catch (error) {
    console.error(error)
    res.status(500).send({
      error: `Couldn't find a bar with the ID: ${req.params.id}`,
    })
  }
})

router.get('/:id/related', async (req, res) => {
  try {
    const bar = await Bar.findOne({
      ID: req.params.id,
    })

    if (!bar)
      return res.status(400).send({ error: `No bar found with ID:  ${ID}` })

    const related_bars = await Bar.find({
      $and: [
        { ID: { $ne: bar.ID } },
        {
          $or: [
            { name: { $regex: new RegExp(bar.name, 'i') } },
            { managerID: bar.managerID },
            {
              location: {
                $regex: new RegExp(bar.location, 'i'),
              },
            },
            { rating: { $regex: new RegExp(bar.rating, 'i') } },
          ],
        },
      ],
    })

    if (related_bars.length == 0)
      return res.status(400).send({ error: 'No related bars found' })
    res.send(related_bars)
  } catch (error) {
    console.error(error)
    res.status(500).send({ error: 'Error finding related bars' })
  }
})

router.post(
  '/create',
  managerChecker,
  uploads.array('images', 10),
  async (req, res) => {
    await createDiningService(req, res, Bar)
  },
)

router.put(
  '/:id/edit',
  managerChecker,
  uploads.array('images', 10),
  async (req, res) => {
    await editDiningService(req, res, Bar)
  },
)

router.delete('/:id/delete', managerChecker, async (req, res) => {
  try {
    const bar = await Bar.findOne({
      ID: req.params.id,
    })

    if (!bar) return res.status(404).send('bar not found')

    if (bar.managerID !== req.user.userID)
      return res.status(403).send({ error: 'Unauthorized' })

    if (bar.status == 'deleted')
      return res.status(400).send({ error: 'bar is already removed' })

    bar.status = 'deleted'
    await bar.save()

    res.send({
      message: `bar with ID ${req.params.id} has been deleted`,
    })
  } catch (error) {
    console.error(error)
    res.status(500).send({ error: 'Error deleting bar' })
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
      category: 'bar',
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
