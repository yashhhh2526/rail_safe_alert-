const fs = require('fs');
const sequelize = require('./config/database');
const Train = require('./models/Train');

async function importTrains() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    await Train.sync({ alter: true }); // Make sure the table exists

    console.log('Reading text files...');
    const data1 = fs.readFileSync('train_data.txt', 'utf-8');
    const data2 = fs.readFileSync('train_data2.txt', 'utf-8');
    const allData = data1 + '\n' + data2;
    
    console.log('Parsing text...');
    const lines = allData.split('\n');
    
    const trainRecords = [];
    const uniqueTrains = new Set();

    // Line format: 10001/10002 Balaghat Jabalpur Satpura 58
    const lineRegex = /^(\d{5})(?:\/\d{5})?\s+(.+)$/;

    for (const line of lines) {
      const match = line.trim().match(lineRegex);
      if (match) {
        const trainNumber = match[1];
        let rest = match[2];
        
        // Remove trailing table number digits like " 58" or " 10,21"
        rest = rest.replace(/\s+[\d,\.]+$/, '').trim();
        
        if (!uniqueTrains.has(trainNumber)) {
          // A very rough parsing since it's hard to split "From", "To", "Name" perfectly 
          // without fixed widths. We'll just split by spaces and try to guess.
          // In OCR, sometimes places have spaces (e.g. "Mumbai CST").
          // For simplicity, we just store the remaining string in trainName 
          // unless there's a clear separation. We will store it all in trainName 
          // and let the search match against it.
          
          let parts = rest.split(/\s{2,}/);
          let fromStation = '';
          let toStation = '';
          let trainName = '';

          if (parts.length >= 3) {
             fromStation = parts[0];
             toStation = parts[1];
             trainName = parts.slice(2).join(' ');
          } else {
             // Fallback
             trainName = rest;
          }

          trainRecords.push({
            trainNumber,
            trainName: trainName.trim(),
            fromStation: fromStation.trim(),
            toStation: toStation.trim()
          });
          uniqueTrains.add(trainNumber);
        }
      }
    }

    console.log(`Found ${trainRecords.length} unique trains. Inserting into database...`);
    
    // Bulk insert, updating on duplicate trainNumber
    await Train.bulkCreate(trainRecords, { 
      updateOnDuplicate: ["trainName", "fromStation", "toStation"] 
    });
    
    console.log('Trains imported successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error importing trains:', error);
    process.exit(1);
  }
}

importTrains();
