const { Sequelize } = require('sequelize');
const config = require('./env');

// Support environment variables with local defaults
const sequelize = config.DATABASE_URL
  ? new Sequelize(config.DATABASE_URL, {
      dialect: 'mysql',
      logging: false,
      dialectOptions: {
        connectTimeout: 5000,
      },
      pool: {
        max: 5,
        min: 0,
        acquire: 10000,
        idle: 10000,
      },
    })
  : new Sequelize(
      config.DB_NAME,
      config.DB_USER,
      config.DB_PASSWORD,
      {
        host: config.DB_HOST,
        port: config.DB_PORT,
        dialect: 'mysql',
        logging: false,
        dialectOptions: {
          connectTimeout: 5000,
        },
        pool: {
          max: 5,
          min: 0,
          acquire: 10000,
          idle: 10000,
        },
      }
    );

module.exports = sequelize;

