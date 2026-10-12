const sequelize = require('./config/database');
const Train = require('./models/Train');
const demoTrains = require('./data/demoTrains');

async function seedDemoTrains() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    await Train.sync({ alter: true });

    const records = demoTrains.map(t => ({
      trainNumber: t.trainNumber,
      trainName: t.trainName,
      fromStation: t.fromStation,
      toStation: t.toStation
    }));

    for (const record of records) {
      const [train, created] = await Train.findOrCreate({
        where: { trainNumber: record.trainNumber },
        defaults: record
      });

      if (!created) {
        await train.update(record);
      }
      console.log(`Synced train ${record.trainNumber}: ${record.trainName}`);
    }

    console.log('All 5 demo trains successfully synced to MySQL database!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding demo trains:', err.message);
    process.exit(1);
  }
}

seedDemoTrains();
