const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Train = sequelize.define('Train', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  trainNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  trainName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fromStation: {
    type: DataTypes.STRING,
    allowNull: true
  },
  toStation: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true
});

module.exports = Train;
