const jwt = require('jsonwebtoken');
const config = require('../config/env');

module.exports = function (req, res, next) {
  // Get token from Authorization header (Bearer <token>) or x-auth-token
  let token = req.header('x-auth-token');
  const authHeader = req.header('Authorization');

  if (!token && authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = authHeader.trim();
    }
  }

  // Check if no token provided
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      msg: 'No authentication token provided, authorization denied' 
    });
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    return res.status(401).json({ 
      success: false, 
      msg: 'Authentication token is invalid or has expired' 
    });
  }
};

