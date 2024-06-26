const express = require('express')
const Restaurant = require('../models/Restaurant')
const Hotel = require('../models/Hotel')
const Bar = require('../models/Bar')
const Club = require('../models/Club')
const optionalChecker = require('../middleware/optionalChecker')

const router = express.Router()

router.get('/', optionalChecker, async (req, res) => {
  try {
    if (req.user && req.user.role === 'admin') {
      const hotels = await Hotel.find({}).sort({ _rank: 1 })
      const restaurants = await Restaurant.find({}).sort({
        _rank: 1,
      })

      const bars = await Bar.find({}).sort({ _rank: 1 })
      const clubs = await Club.find({}).sort({ _rank: 1 })
      const items = hotels.concat(restaurants, bars, clubs)

      const sortedItems = items.sort((a, b) => a._rank - b._rank)

      const count = parseInt(req.query.count) || 20
      const page = parseInt(req.query.page) || 1
      const skip = (page - 1) * count
      const itemsCount = sortedItems.length
      const totalPages = Math.ceil(itemsCount / count)

      const paginatedData = sortedItems.slice(skip, skip + count)

      res.send({
        page,
        totalPages,
        itemsCount,
        items: paginatedData,
      })
    } else {
      const hotels = await Hotel.find({ status: 'approved' }).sort({
        _rank: 1,
      })
      const restaurants = await Restaurant.find({ status: 'approved' }).sort({
        _rank: 1,
      })
      const bars = await Bar.find({ status: 'approved' }).sort({ _rank: 1 })
      const clubs = await Club.find({ status: 'approved' }).sort({ _rank: 1 })
      const items = hotels.concat(restaurants, bars, clubs)
      const sortedItems = items.sort((a, b) => a._rank - b._rank)

      const count = parseInt(req.query.count) || 20
      const page = parseInt(req.query.page) || 1
      const skip = (page - 1) * count
      const itemsCount = sortedItems.length
      const totalPages = Math.ceil(itemsCount / count)

      const paginatedData = sortedItems.slice(skip, skip + count)

      res.send({
        page,
        totalPages,
        itemsCount,
        items: paginatedData,
      })
    }
  } catch (error) {
    console.log(error)
    res.status(400).send({ error: "Couldn't get all spots" })
  }
})

module.exports = router
