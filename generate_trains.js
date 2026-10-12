const fs = require('fs');

const baseTrains = [
  {
    trainNumber: '12345',
    trainName: 'Howrah - New Delhi Rajdhani',
    start: { name: 'Howrah', lat: 22.5855, lng: 88.3426 },
    end: { name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
    intermediate: ['Asansol', 'Dhanbad', 'Parasnath', 'Gaya', 'Dehri On Sone', 'Bhabua Road', 'Pt. DD Upadhyaya', 'Prayagraj Jn', 'Kanpur Central', 'Ghaziabad']
  },
  {
    trainNumber: '12951',
    trainName: 'Mumbai - New Delhi Rajdhani',
    start: { name: 'Mumbai Central', lat: 19.0760, lng: 72.8777 },
    end: { name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
    intermediate: ['Borivali', 'Surat', 'Bharuch', 'Vadodara', 'Ratlam', 'Nagda', 'Kota', 'Sawai Madhopur', 'Mathura', 'Faridabad']
  },
  {
    trainNumber: '12004',
    trainName: 'New Delhi - Lucknow Swarna Shatabdi',
    start: { name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
    end: { name: 'Lucknow', lat: 26.8467, lng: 80.9462 },
    intermediate: ['Ghaziabad', 'Aligarh Jn', 'Tundla', 'Etawah', 'Phaphund', 'Kanpur Central', 'Unnao', 'Aishbagh', 'Lucknow City', 'Lucknow NR']
  },
  {
    trainNumber: '12627',
    trainName: 'Karnataka Express',
    start: { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
    end: { name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
    intermediate: ['Yelahanka', 'Hindupur', 'Dharmavaram', 'Anantapur', 'Guntakal', 'Raichur', 'Wadi', 'Solapur', 'Daund', 'Ahmednagar', 'Belapur', 'Kopargaon', 'Manmad', 'Bhusaval', 'Burhanpur', 'Khandwa', 'Itarsi', 'Bhopal', 'Bina', 'Jhansi', 'Gwalior', 'Agra Cantt', 'Mathura']
  },
  {
    trainNumber: '12841',
    trainName: 'Coromandel Express',
    start: { name: 'Howrah', lat: 22.5855, lng: 88.3426 },
    end: { name: 'Chennai Central', lat: 13.0827, lng: 80.2707 },
    intermediate: ['Santragachi', 'Kharagpur', 'Balasore', 'Bhadrak', 'Jajpur K Road', 'Cuttack', 'Bhubaneswar', 'Khurda Road', 'Brahmapur', 'Palasa', 'Srikakulam', 'Vizianagaram', 'Visakhapatnam', 'Rajahmundry', 'Eluru', 'Vijayawada', 'Ongole', 'Nellore']
  },
  {
    trainNumber: '12615',
    trainName: 'Grand Trunk Express',
    start: { name: 'Chennai Central', lat: 13.0827, lng: 80.2707 },
    end: { name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
    intermediate: ['Gudur', 'Nellore', 'Ongole', 'Chirala', 'Bapatla', 'Tenali', 'Vijayawada', 'Khammam', 'Warangal', 'Ramagundam', 'Manchiryal', 'Sirpur Kaghaznagar', 'Balharshah', 'Chandrapur', 'Sevagram', 'Nagpur', 'Pandhurna', 'Betul', 'Itarsi', 'Hoshangabad', 'Bhopal', 'Vidisha', 'Bina', 'Jhansi', 'Gwalior', 'Morena', 'Dholpur', 'Agra Cantt', 'Mathura', 'Faridabad']
  },
  {
    trainNumber: '12723',
    trainName: 'Telangana Express',
    start: { name: 'Hyderabad Decan', lat: 17.3850, lng: 78.4867 },
    end: { name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
    intermediate: ['Secunderabad', 'Kazipet', 'Ramagundam', 'Manchiryal', 'Bellampalli', 'Sirpur Kaghaznagar', 'Balharshah', 'Chandrapur', 'Sevagram', 'Nagpur', 'Pandhurna', 'Betul', 'Itarsi', 'Bhopal', 'Bina', 'Jhansi', 'Gwalior', 'Agra Cantt', 'Mathura']
  },
  {
    trainNumber: '11019',
    trainName: 'Konark Express',
    start: { name: 'Mumbai CSMT', lat: 18.9400, lng: 72.8353 },
    end: { name: 'Bhubaneswar', lat: 20.2961, lng: 85.8245 },
    intermediate: ['Dadar', 'Kalyan', 'Lonavala', 'Pune', 'Daund', 'Kurduvadi', 'Solapur', 'Kalaburagi', 'Wadi', 'Seram', 'Tandur', 'Vikarabad', 'Secunderabad', 'Kazipet', 'Warangal', 'Mahbubabad', 'Khammam', 'Vijayawada', 'Eluru', 'Rajahmundry', 'Visakhapatnam', 'Vizianagaram', 'Srikakulam', 'Palasa', 'Brahmapur', 'Khurda Road']
  },
  {
    trainNumber: '12137',
    trainName: 'Punjab Mail',
    start: { name: 'Mumbai CSMT', lat: 18.9400, lng: 72.8353 },
    end: { name: 'Firozpur Cantt', lat: 30.9231, lng: 74.6108 },
    intermediate: ['Dadar', 'Kalyan', 'Kasara', 'Igatpuri', 'Nashik Road', 'Manmad', 'Jalgaon', 'Bhusaval', 'Burhanpur', 'Khandwa', 'Harda', 'Itarsi', 'Hoshangabad', 'Bhopal', 'Vidisha', 'Ganj Basoda', 'Bina', 'Lalitpur', 'Jhansi', 'Datia', 'Dabra', 'Gwalior', 'Morena', 'Dholpur', 'Agra Cantt', 'Raja Ki Mandi', 'Mathura', 'Faridabad', 'Hazrat Nizamuddin', 'New Delhi', 'Rohtak', 'Jind', 'Jakhal', 'Bhatinda', 'Faridkot']
  },
  {
    trainNumber: '12431',
    trainName: 'Trivandrum Rajdhani',
    start: { name: 'Trivandrum Central', lat: 8.5241, lng: 76.9366 },
    end: { name: 'Hazrat Nizamuddin', lat: 28.5888, lng: 77.2526 },
    intermediate: ['Kollam', 'Alappuzha', 'Ernakulam Jn', 'Thrissur', 'Shoranur', 'Kozhikode', 'Kannur', 'Kasaragod', 'Mangaluru Jn', 'Udupi', 'Karwar', 'Madgaon', 'Ratnagiri', 'Panvel', 'Vasai Road', 'Surat', 'Vadodara', 'Ratlam', 'Kota']
  },
  {
    trainNumber: '12903',
    trainName: 'Golden Temple Mail',
    start: { name: 'Mumbai Central', lat: 19.0760, lng: 72.8777 },
    end: { name: 'Amritsar', lat: 31.6340, lng: 74.8723 },
    intermediate: ['Borivali', 'Surat', 'Vadodara', 'Ratlam', 'Nagda', 'Shamgarh', 'Bhawani Mandi', 'Ramganj Mandi', 'Kota', 'Sawai Madhopur', 'Gangapur City', 'Hindaun City', 'Bayana', 'Bharatpur', 'Mathura', 'Faridabad', 'Hazrat Nizamuddin', 'New Delhi', 'Ghaziabad', 'Meerut City', 'Muzaffarnagar', 'Saharanpur', 'Ambala Cantt', 'Ludhiana', 'Jalandhar City', 'Beas']
  },
  {
    trainNumber: '12309',
    trainName: 'Patna Rajdhani',
    start: { name: 'Rajendra Nagar T', lat: 25.5999, lng: 85.1668 },
    end: { name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
    intermediate: ['Patna Jn', 'Danapur', 'Ara', 'Buxar', 'Pt. DD Upadhyaya', 'Prayagraj Jn', 'Kanpur Central', 'Aligarh Jn', 'Ghaziabad', 'Tilak Bridge']
  },
  {
    trainNumber: '12007',
    trainName: 'Chennai Mysore Shatabdi',
    start: { name: 'Chennai Central', lat: 13.0827, lng: 80.2707 },
    end: { name: 'Mysore', lat: 12.2958, lng: 76.6394 },
    intermediate: ['Arakkonam', 'Katpadi', 'Jolarpettai', 'Bangarapet', 'Krishnarajapuram', 'Bangalore Cantt', 'KSR Bangalore', 'Kengeri', 'Bidadi', 'Ramanagaram', 'Channapatna', 'Maddur', 'Mandya', 'Pandavapura']
  },
  {
    trainNumber: '11077',
    trainName: 'Jhelum Express',
    start: { name: 'Pune', lat: 18.5204, lng: 73.8567 },
    end: { name: 'Jammu Tawi', lat: 32.7266, lng: 74.8570 },
    intermediate: ['Uruli', 'Daund', 'Ahmednagar', 'Belapur', 'Kopargaon', 'Manmad', 'Chalisgaon', 'Jalgaon', 'Bhusaval', 'Burhanpur', 'Khandwa', 'Harda', 'Itarsi', 'Hoshangabad', 'Bhopal', 'Vidisha', 'Ganj Basoda', 'Bina', 'Lalitpur', 'Jhansi', 'Datia', 'Dabra', 'Gwalior', 'Morena', 'Dholpur', 'Agra Cantt', 'Raja Ki Mandi', 'Mathura', 'Faridabad', 'Hazrat Nizamuddin', 'New Delhi', 'Subzi Mandi', 'Sonipat', 'Panipat', 'Karnal', 'Kurukshetra', 'Ambala Cantt', 'Sirhind', 'Khanna', 'Ludhiana', 'Phagwara', 'Jalandhar Cantt', 'Dasuya', 'Mukerian', 'Pathankot Cantt', 'Kathua', 'Samba']
  },
  {
    trainNumber: '12423',
    trainName: 'Dibrugarh Rajdhani',
    start: { name: 'Dibrugarh', lat: 27.4728, lng: 94.9120 },
    end: { name: 'New Delhi', lat: 28.6139, lng: 77.2090 },
    intermediate: ['New Tinsukia', 'Mariani', 'Dimapur', 'Diphu', 'Lumding', 'Chaparmukh', 'Guwahati', 'New Bongaigaon', 'Kokrajhar', 'New Alipurduar', 'New Cooch Behar', 'New Jalpaiguri', 'Kishanganj', 'Katihar', 'Naugachia', 'Barauni', 'Hajipur', 'Chhapra', 'Ballia', 'Ghazipur City', 'Varanasi', 'Pt. DD Upadhyaya', 'Prayagraj Jn', 'Kanpur Central', 'Aligarh Jn']
  },
  {
    trainNumber: '12915',
    trainName: 'Ashram Express',
    start: { name: 'Ahmedabad', lat: 23.0225, lng: 72.5714 },
    end: { name: 'Old Delhi', lat: 28.6616, lng: 77.2281 },
    intermediate: ['Sabarmati', 'Mahesana', 'Unjha', 'Palanpur', 'Abu Road', 'Falna', 'Beawar', 'Ajmer', 'Jaipur', 'Dausa', 'Bandikui', 'Alwar', 'Khairthal', 'Rewari', 'Pataudi Road', 'Gurgaon', 'Delhi Cantt']
  },
  {
    trainNumber: '12805',
    trainName: 'Janmabhoomi Express',
    start: { name: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
    end: { name: 'Secunderabad', lat: 17.4399, lng: 78.4983 },
    intermediate: ['Duvvada', 'Anakapalle', 'Tuni', 'Annavaram', 'Samalkot', 'Rajahmundry', 'Tadepalligudem', 'Eluru', 'Vijayawada', 'Tenali', 'Guntur', 'Sattenapalle', 'Piduguralla', 'Nadikude', 'Miryalaguda', 'Nalgonda', 'Ramannapet']
  },
  {
    trainNumber: '12245',
    trainName: 'Howrah Yesvantpur Duronto',
    start: { name: 'Howrah', lat: 22.5855, lng: 88.3426 },
    end: { name: 'Yesvantpur', lat: 13.0285, lng: 77.5409 },
    intermediate: ['Bhubaneswar', 'Khurda Road', 'Vizianagaram', 'Visakhapatnam', 'Vijayawada', 'Renigunta', 'Tirupati', 'Katpadi', 'Jolarpettai', 'Krishnarajapuram']
  },
  {
    trainNumber: '12213',
    trainName: 'Yesvantpur Delhi Duronto',
    start: { name: 'Yesvantpur', lat: 13.0285, lng: 77.5409 },
    end: { name: 'Delhi Sarai Rohilla', lat: 28.6659, lng: 77.1837 },
    intermediate: ['Guntakal', 'Secunderabad', 'Balharshah', 'Nagpur', 'Itarsi', 'Bhopal', 'Jhansi', 'Gwalior', 'Agra Cantt', 'New Delhi']
  },
  {
    trainNumber: '22691',
    trainName: 'Rajdhani Express',
    start: { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
    end: { name: 'Hazrat Nizamuddin', lat: 28.5888, lng: 77.2526 },
    intermediate: ['Sri Sathya Sai Prashanthi Nilayam', 'Dharmavaram', 'Anantapur', 'Guntakal', 'Raichur', 'Sedam', 'Secunderabad', 'Kazipet', 'Balharshah', 'Nagpur', 'Itarsi', 'Bhopal', 'Jhansi', 'Gwalior', 'Agra Cantt']
  }
];

// Linear interpolation for mock coordinates
function interpolate(lat1, lon1, lat2, lon2, fraction) {
  return {
    lat: lat1 + (lat2 - lat1) * fraction,
    lng: lon1 + (lon2 - lon1) * fraction
  };
}

const finalTrains = baseTrains.map(train => {
  const stations = [{ name: train.start.name, coords: { lat: train.start.lat, lng: train.start.lng } }];
  
  const totalIntermediate = train.intermediate.length;
  train.intermediate.forEach((st, idx) => {
    // Distribute them roughly evenly along the line between start and end
    const fraction = (idx + 1) / (totalIntermediate + 1);
    const coords = interpolate(train.start.lat, train.start.lng, train.end.lat, train.end.lng, fraction);
    stations.push({ name: st, coords: { lat: parseFloat(coords.lat.toFixed(4)), lng: parseFloat(coords.lng.toFixed(4)) } });
  });

  stations.push({ name: train.end.name, coords: { lat: train.end.lat, lng: train.end.lng } });
  
  return {
    trainNumber: train.trainNumber,
    trainName: train.trainName,
    stations,
    currentLocation: { 
      lat: stations[1].coords.lat, 
      lng: stations[1].coords.lng, 
      station: stations[1].name 
    },
    delayMinutes: train.delayMinutes
  };
});

const code = `const express = require('express');
const router = express.Router();

const mockTrains = ${JSON.stringify(finalTrains, null, 2)};

router.get('/search', (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ msg: 'Please provide a search query' });
  const lowercaseQuery = query.toLowerCase();
  const results = mockTrains.filter(
    (t) => t.trainNumber.includes(lowercaseQuery) || t.trainName.toLowerCase().includes(lowercaseQuery)
  );
  res.json(results);
});

router.get('/status/:trainNumber', (req, res) => {
  const { trainNumber } = req.params;
  const train = mockTrains.find(t => t.trainNumber === trainNumber);
  if (!train) return res.status(404).json({ msg: 'Train not found' });
  res.json({
    trainNumber: train.trainNumber,
    trainName: train.trainName,
    currentLocation: train.currentLocation,
    delayMinutes: train.delayMinutes,
    etaString: \\\`Arriving shortly (Mock ETA with \\\${train.delayMinutes} mins delay)\\\`
  });
});

module.exports = router;
`;

fs.writeFileSync('backend/routes/trains.js', code);
console.log('Successfully generated trains.js with 10+ stations per train.');
