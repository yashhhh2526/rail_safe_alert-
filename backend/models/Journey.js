const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const Journey = sequelize.define('Journey', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  trainNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  trainName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  boardingStation: {
    type: DataTypes.STRING,
    allowNull: false
  },
  destinationStation: {
    type: DataTypes.STRING,
    allowNull: false
  },
  alertDistance: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5
  },
  status: {
    type: DataTypes.ENUM('upcoming', 'ongoing', 'completed', 'cancelled'),
    defaultValue: 'upcoming'
  }
}, {
  timestamps: true
});

// Relationships
User.hasMany(Journey, { foreignKey: 'userId' });
Journey.belongsTo(User, { foreignKey: 'userId' });

module.exports = Journey;
