const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/env');
const auth = require('../middleware/auth');

const router = express.Router();

// Resilient in-memory user store when database is in demo/fallback mode
const mockUsers = new Map();

// Seed a default demo account so immediate login works seamlessly
(async () => {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('securepass123', salt);
  mockUsers.set('yash@example.com', {
    id: 1,
    name: 'Yashwanth Chodipalli',
    email: 'yash@example.com',
    password: hash,
    phone: '9876543210'
  });
})();

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

    let existingUser = null;
    try {
      existingUser = await User.findOne({ where: { email: cleanEmail } });
    } catch (dbErr) {
      console.warn('Database lookup notice, checking in-memory demo store:', dbErr.message);
      existingUser = mockUsers.get(cleanEmail) || null;
    }

    if (existingUser) {
      return res.status(400).json({ success: false, msg: 'An account with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let userRecord = null;
    try {
      const user = await User.create({
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        phone: cleanPhone
      });
      userRecord = { id: user.id, name: user.name, email: user.email, phone: user.phone };
    } catch (dbErr) {
      console.warn('Database save notice, persisting in in-memory demo store:', dbErr.message);
      const newId = mockUsers.size + 1;
      const memUser = {
        id: newId,
        name: cleanName,
        email: cleanEmail,
        password: hashedPassword,
        phone: cleanPhone
      };
      mockUsers.set(cleanEmail, memUser);
      userRecord = { id: memUser.id, name: memUser.name, email: memUser.email, phone: memUser.phone };
    }

    const payload = { user: { id: userRecord.id } };
    const token = jwt.sign(payload, config.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      token,
      user: userRecord
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
    let user = null;

    try {
      user = await User.findOne({ where: { email: cleanEmail } });
    } catch (dbErr) {
      console.warn('Database lookup notice, checking in-memory demo store:', dbErr.message);
      user = mockUsers.get(cleanEmail) || null;
    }

    if (!user) {
      // If user not in mock store, return clear 400 invalid credentials
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
    let user = null;
    try {
      user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password'] }
      });
    } catch (dbErr) {
      for (const u of mockUsers.values()) {
        if (u.id === req.user.id) {
          user = { id: u.id, name: u.name, email: u.email, phone: u.phone };
          break;
        }
      }
    }

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
    let user = null;
    try {
      user = await User.findByPk(req.user.id);
      if (user) {
        if (name && typeof name === 'string' && name.trim()) user.name = name.trim();
        if (phone !== undefined) user.phone = phone ? String(phone).trim() : null;
        await user.save();
      }
    } catch (dbErr) {
      for (const u of mockUsers.values()) {
        if (u.id === req.user.id) {
          if (name && typeof name === 'string' && name.trim()) u.name = name.trim();
          if (phone !== undefined) u.phone = phone ? String(phone).trim() : null;
          user = u;
          break;
        }
      }
    }

    if (!user) {
      return res.status(404).json({ success: false, msg: 'User profile not found' });
    }

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
