const express = require('express');
const Journey = require('../models/Journey');
const auth = require('../middleware/auth');

const router = express.Router();

// Create a new journey
router.post('/', auth, async (req, res) => {
  try {
    const { trainNumber, trainName, boardingStation, destinationStation, alertDistance, status } = req.body || {};

    if (!trainNumber || !boardingStation || !destinationStation) {
      return res.status(400).json({ 
        success: false, 
        msg: 'Train number, boarding station, and destination station are required' 
      });
    }

    const journey = await Journey.create({
      userId: req.user.id,
      trainNumber: String(trainNumber).trim(),
      trainName: trainName ? String(trainName).trim() : null,
      boardingStation: String(boardingStation).trim(),
      destinationStation: String(destinationStation).trim(),
      alertDistance: typeof alertDistance === 'number' ? alertDistance : (parseInt(alertDistance, 10) || 5),
      status: status || 'ongoing'
    });

    res.status(201).json({ success: true, journey });
  } catch (err) {
    console.error('Journey creation error:', err.message);
    res.status(500).json({ success: false, msg: 'Server error saving journey details' });
  }
});

// Get user journeys
router.get('/', auth, async (req, res) => {
  try {
    const journeys = await Journey.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, journeys });
  } catch (err) {
    console.error('Journey list error:', err.message);
    res.status(500).json({ success: false, msg: 'Server error retrieving journeys' });
  }
});

// Update journey status (e.g., 'completed', 'cancelled')
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body || {};
    const validStatuses = ['upcoming', 'ongoing', 'completed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        msg: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const journey = await Journey.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!journey) {
      return res.status(404).json({ success: false, msg: 'Journey not found' });
    }

    journey.status = status;
    await journey.save();

    res.json({ success: true, journey });
  } catch (err) {
    console.error('Journey update error:', err.message);
    res.status(500).json({ success: false, msg: 'Server error updating journey' });
  }
});

// Delete a journey
router.delete('/:id', auth, async (req, res) => {
  try {
    const journey = await Journey.findOne({
      where: { id: req.params.id, userId: req.user.id }
    });

    if (!journey) {
      return res.status(404).json({ success: false, msg: 'Journey not found' });
    }

    await journey.destroy();
    res.json({ success: true, msg: 'Journey removed successfully' });
  } catch (err) {
    console.error('Journey delete error:', err.message);
    res.status(500).json({ success: false, msg: 'Server error deleting journey' });
  }
});

module.exports = router;

