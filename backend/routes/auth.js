const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/env');
const auth = require('../middleware/auth');

const router = express.Router();

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, msg: 'Name is required' });
    }
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, msg: 'A valid email address is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ success: false, msg: 'Password must be at least 6 characters long' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanPhone = phone ? String(phone).trim() : null;

    let existingUser = await User.findOne({ where: { email: cleanEmail } });
    if (existingUser) {
      return res.status(400).json({ success: false, msg: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      phone: cleanPhone
    });

    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ success: false, msg: 'Server error during registration' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ success: false, msg: 'Email and password are required' });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(400).json({ success: false, msg: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, msg: 'Invalid email or password' });
    }

    const payload = { user: { id: user.id } };
    const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, msg: 'Server error during login' });
  }
});

// Get Profile
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });
    if (!user) {
      return res.status(404).json({ success: false, msg: 'User profile not found' });
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error('Profile fetch error:', err.message);
    res.status(500).json({ success: false, msg: 'Server error fetching user profile' });
  }
});

// Update Profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, phone } = req.body || {};
    let user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, msg: 'User profile not found' });
    }

    if (name && typeof name === 'string' && name.trim()) {
      user.name = name.trim();
    }
    if (phone !== undefined) {
      user.phone = phone ? String(phone).trim() : null;
    }

    await user.save();

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone
      }
    });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ success: false, msg: 'Server error updating user profile' });
  }
});

module.exports = router;

