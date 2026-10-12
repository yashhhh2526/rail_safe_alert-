const express = require('express');
const config = require('../config/env');
const router = express.Router();
const { Op } = require('sequelize');
const Train = require('../models/Train');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const demoTrains = require('../data/demoTrains');
const { processTrainRouteDistances } = require('../services/railwayDistanceService');

function toIsoIST(timeStr, baseDateStr = null) {
  if (!timeStr) return null;
  if (timeStr.includes('T')) return timeStr;

  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return timeStr;
  let [_, hours, mins, ampm] = match;
  hours = parseInt(hours, 10);
  mins = parseInt(mins, 10);
  if (ampm) {
    if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
  }
  const now = new Date();
  const istDateString = baseDateStr || now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const pad = (n) => String(n).padStart(2, '0');
  return `${istDateString}T${pad(hours)}:${pad(mins)}:00+05:30`;
}

function getDemoTrainLiveData(trainNumber) {
  const cleanNum = String(trainNumber || '').trim();
  const dt = demoTrains.find(t => String(t.trainNumber).trim() === cleanNum);
  if (!dt) return null;

  const now = new Date();
  const todayIST = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const nowTime = now.getTime();

  const stations = dt.stations.map((st, idx) => {
    const schedArrIso = toIsoIST(st.scheduledArrival, todayIST);
    const schedDepIso = toIsoIST(st.scheduledDeparture, todayIST);
    const delayMin = st.delayMinutes !== undefined ? st.delayMinutes : (dt.delayMinutes || 0);

    let expArrIso = toIsoIST(st.expectedArrival, todayIST);
    let expDepIso = toIsoIST(st.expectedDeparture, todayIST);

    if (!expArrIso && schedArrIso) {
      const d = new Date(schedArrIso);
      if (!isNaN(d.getTime())) {
        expArrIso = new Date(d.getTime() + delayMin * 60000).toISOString();
      }
    }
    if (!expDepIso && schedDepIso) {
      const d = new Date(schedDepIso);
      if (!isNaN(d.getTime())) {
        expDepIso = new Date(d.getTime() + delayMin * 60000).toISOString();
      }
    }

    // Determine station status dynamically against current clock
    let status = 'UPCOMING';
    const depTime = schedDepIso ? new Date(schedDepIso).getTime() : null;
    const arrTime = schedArrIso ? new Date(schedArrIso).getTime() : depTime;

    if (depTime !== null) {
      const depWithDelay = depTime + (delayMin * 60000);
      const arrWithDelay = (arrTime !== null ? arrTime : depTime) + (delayMin * 60000);

      if (nowTime > depWithDelay) {
        status = 'PASSED';
      } else if (nowTime >= arrWithDelay && nowTime <= depWithDelay) {
        status = 'CURRENT';
      } else {
        status = 'UPCOMING';
      }
    }

    return {
      sequence: idx + 1,
      name: st.name,
      code: st.code,
      isHalt: st.isHalt !== false,
      locationType: st.locationType || 'station',
      scheduledArrival: schedArrIso,
      scheduledDeparture: schedDepIso,
      expectedArrival: expArrIso,
      expectedDeparture: expDepIso,
      actualArrival: status === 'PASSED' ? expArrIso : null,
      actualDeparture: status === 'PASSED' ? expDepIso : null,
      delayMinutes: delayMin,
      distanceFromOrigin: st.distanceFromOrigin !== undefined ? st.distanceFromOrigin : (st.cumulativeDistanceKm || 0),
      cumulativeDistanceKm: st.cumulativeDistanceKm !== undefined ? st.cumulativeDistanceKm : (st.distanceFromOrigin || 0),
      distanceFromPrevious: st.distanceFromPrevious !== undefined ? st.distanceFromPrevious : (st.distanceFromPreviousKm || 0),
      distanceFromPreviousKm: st.distanceFromPreviousKm !== undefined ? st.distanceFromPreviousKm : (st.distanceFromPrevious || 0),
      distanceRemaining: st.distanceRemaining !== undefined ? st.distanceRemaining : 0,
      distanceRemainingKm: st.distanceRemainingKm !== undefined ? st.distanceRemainingKm : (st.distanceRemaining || 0),
      status: status,
      expectedPlatform: st.expectedPlatform,
      latitude: st.coords ? st.coords.lat : null,
      longitude: st.coords ? st.coords.lng : null,
      coords: st.coords
    };
  });

  // Dynamically resolve currentStation and nextStation from station progression
  let dynamicCurrentStation = dt.currentStation;
  let dynamicNextStation = dt.nextStation;

  const currentIdx = stations.findIndex(s => s.status === 'CURRENT');
  if (currentIdx !== -1) {
    dynamicCurrentStation = { name: stations[currentIdx].name, code: stations[currentIdx].code };
    const nextSt = stations[currentIdx + 1];
    dynamicNextStation = nextSt ? { name: nextSt.name, code: nextSt.code } : null;
  } else {
    const upcomingIdx = stations.findIndex(s => s.status === 'UPCOMING');
    if (upcomingIdx === 0) {
      dynamicCurrentStation = { name: stations[0].name, code: stations[0].code };
      dynamicNextStation = stations[1] ? { name: stations[1].name, code: stations[1].code } : null;
    } else if (upcomingIdx > 0) {
      const prevSt = stations[upcomingIdx - 1];
      const nextSt = stations[upcomingIdx];
      dynamicCurrentStation = { name: `Between ${prevSt.name} and ${nextSt.name}`, code: prevSt.code };
      dynamicNextStation = { name: nextSt.name, code: nextSt.code };
    } else {
      const lastSt = stations[stations.length - 1];
      dynamicCurrentStation = { name: `Completed at ${lastSt.name}`, code: lastSt.code };
      dynamicNextStation = null;
    }
  }

  return {
    trainNumber: dt.trainNumber,
    trainName: dt.trainName,
    currentStation: dynamicCurrentStation,
    nextStation: dynamicNextStation,
    delayMinutes: dt.delayMinutes || 0,
    speedKmh: dt.speedKmh || 80,
    lastUpdatedAt: now.toISOString(),
    stations: stations
  };
}

// Load stations JSON and build coordinate map
const stationCoordsMap = new Map();
try {
  const stationsPath = path.join(__dirname, '../data/stations.json');
  if (fs.existsSync(stationsPath)) {
    const stationData = JSON.parse(fs.readFileSync(stationsPath, 'utf8'));
    if (stationData && stationData.features) {
      for (const feature of stationData.features) {
        if (feature.properties && feature.properties.code && feature.geometry && feature.geometry.coordinates) {
          stationCoordsMap.set(feature.properties.code, {
            lat: feature.geometry.coordinates[1],
            lng: feature.geometry.coordinates[0]
          });
        }
      }
    }
  }
} catch (err) {
  console.error("Error loading stations.json for coordinates:", err.message);
}

// Load bundled train dataset for production availability
let bundledTrains = [];
try {
  const allTrainsPath = path.join(__dirname, '../data/allTrains.json');
  if (fs.existsSync(allTrainsPath)) {
    bundledTrains = JSON.parse(fs.readFileSync(allTrainsPath, 'utf8'));
  }
} catch (err) {
  console.warn('Could not load allTrains.json:', err.message);
}

// Load mock trains dataset from data/mockTrains.json
let mockTrains = [];
try {
  const mockTrainsPath = path.join(__dirname, '../data/mockTrains.json');
  if (fs.existsSync(mockTrainsPath)) {
    mockTrains = JSON.parse(fs.readFileSync(mockTrainsPath, 'utf8'));
  }
} catch (err) {
  console.warn('Could not load mockTrains.json:', err.message);
}

router.get('/search', async (req, res) => {
  const rawQuery = req.query.query;
  if (!rawQuery) return res.status(400).json({ msg: 'Please provide a search query' });

  // 1. Thoroughly normalize query: convert to string, remove quotes and whitespace
  const cleanSearchTerm = String(rawQuery).replace(/^["']|["']$/g, '').trim();
  const normalizedQuery = cleanSearchTerm.toLowerCase();

  if (!normalizedQuery) return res.json([]);

  const results = [];
  const addedTrainNumbers = new Set();

  const isMatch = (t) => {
    const tNum = String(t.trainNumber || '').trim();
    const tNumLower = tNum.toLowerCase();
    const tNameLower = String(t.trainName || '').toLowerCase().trim();
    const fromLower = String(t.fromStation || '').toLowerCase().trim();
    const toLower = String(t.toStation || '').toLowerCase().trim();
    const fromCodeLower = String(t.fromStationCode || '').toLowerCase().trim();
    const toCodeLower = String(t.toStationCode || '').toLowerCase().trim();

    return (
      tNum === cleanSearchTerm ||
      tNumLower === normalizedQuery ||
      tNumLower.includes(normalizedQuery) ||
      cleanSearchTerm.includes(tNum) ||
      tNameLower.includes(normalizedQuery) ||
      fromLower.includes(normalizedQuery) ||
      toLower.includes(normalizedQuery) ||
      fromCodeLower.includes(normalizedQuery) ||
      toCodeLower.includes(normalizedQuery)
    );
  };

  // 1. Check Demo Trains first (highest priority: complete stations, route distances & GPS)
  const matchingDemoTrains = demoTrains.filter(isMatch);
  for (const t of matchingDemoTrains) {
    results.push({
      trainNumber: t.trainNumber,
      trainName: t.trainName,
      fromStation: t.fromStation,
      toStation: t.toStation,
      stations: t.stations.map(s => ({
        name: s.name,
        code: s.code,
        scheduledArrival: s.scheduledArrival,
        scheduledDeparture: s.scheduledDeparture,
        expectedArrival: s.expectedArrival,
        expectedDeparture: s.expectedDeparture,
        delayMinutes: s.delayMinutes,
        cumulativeDistanceKm: s.cumulativeDistanceKm,
        distanceFromPreviousKm: s.distanceFromPreviousKm,
        distanceFromOrigin: s.distanceFromOrigin,
        distanceRemainingKm: s.distanceRemainingKm,
        distanceRemaining: s.distanceRemaining,
        status: s.status,
        expectedPlatform: s.expectedPlatform,
        coords: s.coords
      })),
      currentLocation: t.currentLocation,
      delayMinutes: t.delayMinutes,
      expectedPlatform: t.expectedPlatform,
      departureTime: t.departureTime,
      arrivalTime: t.arrivalTime,
      duration: t.duration,
      fare: t.fare,
      runningDays: t.runningDays,
      isNotRunningToday: t.isNotRunningToday
    });
    addedTrainNumbers.add(t.trainNumber);
  }

  // 2. Check bundled trains dataset (1,160+ trains from timetable)
  const matchingBundledTrains = bundledTrains.filter(t => !addedTrainNumbers.has(t.trainNumber) && isMatch(t));
  for (const t of matchingBundledTrains) {
    const startStation = t.fromStation || 'Start Station';
    const endStation = t.toStation || 'End Station';
    const baseStns = [
      { name: startStation, code: startStation.substring(0, 4).toUpperCase(), status: 'PASSED', coords: null },
      { name: endStation, code: endStation.substring(0, 4).toUpperCase(), status: 'DESTINATION', coords: null }
    ];
    const processedStns = processTrainRouteDistances(baseStns, `${t.trainNumber} (Bundled)`);

    results.push({
      trainNumber: t.trainNumber,
      trainName: t.trainName || `${startStation} to ${endStation}`,
      fromStation: t.fromStation,
      toStation: t.toStation,
      stations: processedStns,
      currentLocation: {
        lat: null,
        lng: null,
        station: startStation
      },
      delayMinutes: 0,
      expectedPlatform: Math.floor(Math.random() * 8) + 1,
      departureTime: '08:00 AM',
      arrivalTime: '08:00 PM',
      duration: '12h 00m',
      fare: 1450,
      runningDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
      isNotRunningToday: false
    });
    addedTrainNumbers.add(t.trainNumber);
    if (results.length >= 30) break;
  }

  // 3. Check mockTrains array
  const matchingMockTrains = mockTrains.filter(t => !addedTrainNumbers.has(t.trainNumber) && isMatch(t));
  for (const t of matchingMockTrains) {
    const processedStns = processTrainRouteDistances(t.stations || [], `${t.trainNumber} (Mock)`);
    results.push({
      trainNumber: t.trainNumber,
      trainName: t.trainName,
      fromStation: processedStns && processedStns[0] ? processedStns[0].name : 'Origin',
      toStation: processedStns && processedStns.length > 0 ? processedStns[processedStns.length - 1].name : 'Destination',
      stations: processedStns,
      currentLocation: t.currentLocation,
      delayMinutes: t.delayMinutes || 0,
      expectedPlatform: Math.floor(Math.random() * 8) + 1,
      departureTime: '08:00 AM',
      arrivalTime: '08:00 PM',
      duration: '12h 00m',
      fare: 1450,
      runningDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
      isNotRunningToday: false
    });
    addedTrainNumbers.add(t.trainNumber);
  }

  // 4. Fallback to MySQL DB lookup if available
  try {
    const dbResults = await Train.findAll({
      where: {
        [Op.or]: [
          { trainNumber: { [Op.like]: `%${cleanSearchTerm}%` } },
          { trainName: { [Op.like]: `%${cleanSearchTerm}%` } }
        ]
      },
      limit: 20
    });

    for (const train of dbResults) {
      if (!addedTrainNumbers.has(train.trainNumber)) {
        const startStation = train.fromStation || 'Start Station';
        const endStation = train.toStation || 'End Station';
        const baseStns = [
          { name: startStation, code: startStation.substring(0, 4).toUpperCase(), status: 'PASSED', coords: null },
          { name: endStation, code: endStation.substring(0, 4).toUpperCase(), status: 'DESTINATION', coords: null }
        ];
        const processedStns = processTrainRouteDistances(baseStns, `${train.trainNumber} (DB)`);

        results.push({
          trainNumber: train.trainNumber,
          trainName: train.trainName || startStation + ' to ' + endStation,
          fromStation: train.fromStation,
          toStation: train.toStation,
          stations: processedStns,
          currentLocation: {
            lat: null,
            lng: null,
            station: startStation
          },
          delayMinutes: Math.floor(Math.random() * 30),
          expectedPlatform: Math.floor(Math.random() * 8) + 1,
          departureTime: '10:00 AM',
          arrivalTime: '06:30 PM',
          duration: '8h 30m',
          fare: 1200,
          runningDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
          isNotRunningToday: false
        });
        addedTrainNumbers.add(train.trainNumber);
      }
    }
  } catch (error) {
    // Non-fatal fallback
  }

  res.json(results);
});

router.get('/status/:trainNumber', async (req, res) => {
  const { trainNumber } = req.params;
  
  // 1. Check demo trains
  const demoTrain = demoTrains.find(t => t.trainNumber === trainNumber);
  if (demoTrain) {
    return res.json({
      trainNumber: demoTrain.trainNumber,
      trainName: demoTrain.trainName,
      currentLocation: demoTrain.currentLocation,
      delayMinutes: demoTrain.delayMinutes,
      etaString: `Arriving shortly (${demoTrain.delayMinutes > 0 ? demoTrain.delayMinutes + ' mins delay' : 'On Time'})`
    });
  }

  // 2. Check mockTrains
  let train = mockTrains.find(t => t.trainNumber === trainNumber);
  if (!train) {
    try {
      const dbTrain = await Train.findOne({ where: { trainNumber } });
      if (!dbTrain) return res.status(404).json({ msg: 'Train not found' });
      
      const startStation = dbTrain.fromStation || 'Start Station';
      const endStation = dbTrain.toStation || 'End Station';
      const delayMinutes = Math.floor(Math.random() * 30);

      train = {
        trainNumber: dbTrain.trainNumber,
        trainName: dbTrain.trainName || startStation + ' to ' + endStation,
        currentLocation: {
          lat: null,
          lng: null,
          station: startStation
        },
        delayMinutes: delayMinutes
      };
    } catch (err) {
      return res.status(500).json({ msg: 'Server error' });
    }
  }

  res.json({
    trainNumber: train.trainNumber,
    trainName: train.trainName,
    currentLocation: train.currentLocation,
    delayMinutes: train.delayMinutes,
    etaString: `Arriving shortly (Mock ETA with ${train.delayMinutes} mins delay)`
  });
});

router.get('/searchByRoute', async (req, res) => {
  const { from, to } = req.query;
  
  if (!from || !to) {
    return res.status(400).json({ msg: 'Please provide from and to stations' });
  }

  const fromLower = from.toLowerCase().trim();
  const toLower = to.toLowerCase().trim();
  const results = [];
  const addedTrainNumbers = new Set();

  // 1. Check demo trains
  for (const dt of demoTrains) {
    const fromMatches = 
      dt.fromStation.toLowerCase().includes(fromLower) ||
      (dt.fromStationCode && dt.fromStationCode.toLowerCase() === fromLower) ||
      dt.stations.some(s => s.name.toLowerCase().includes(fromLower) || (s.code && s.code.toLowerCase() === fromLower));
      
    const toMatches = 
      dt.toStation.toLowerCase().includes(toLower) ||
      (dt.toStationCode && dt.toStationCode.toLowerCase() === toLower) ||
      dt.stations.some(s => s.name.toLowerCase().includes(toLower) || (s.code && s.code.toLowerCase() === toLower));

    if (fromMatches && toMatches) {
      results.push({
        trainNumber: dt.trainNumber,
        trainName: dt.trainName,
        fromStation: dt.fromStation,
        toStation: dt.toStation,
        departureTime: dt.departureTime,
        arrivalTime: dt.arrivalTime,
        duration: dt.duration,
        fare: dt.fare,
        runningDays: dt.runningDays,
        isNotRunningToday: dt.isNotRunningToday,
        expectedPlatform: dt.expectedPlatform,
        stations: dt.stations,
        currentLocation: dt.currentLocation,
        delayMinutes: dt.delayMinutes
      });
      addedTrainNumbers.add(dt.trainNumber);
    }
  }

  // 2. Query DB
  try {
    const dbResults = await Train.findAll({
      where: {
        fromStation: { [Op.like]: `%${from}%` },
        toStation: { [Op.like]: `%${to}%` }
      },
      limit: 20
    });

    for (const train of dbResults) {
      if (!addedTrainNumbers.has(train.trainNumber)) {
        results.push({
          trainNumber: train.trainNumber,
          trainName: train.trainName || train.fromStation + ' to ' + train.toStation,
          fromStation: train.fromStation,
          toStation: train.toStation,
          departureTime: '02:00 PM',
          arrivalTime: '03:20 PM',
          duration: '2d 1hr 20min',
          fare: Math.floor(Math.random() * 2000 + 1000),
          runningDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
          isNotRunningToday: false,
          expectedPlatform: Math.floor(Math.random() * 8) + 1
        });
        addedTrainNumbers.add(train.trainNumber);
      }
    }
  } catch (error) {
    console.error('Search by route DB error:', error.message);
  }

  res.json(results);
});

router.get('/:trainNumber/live', async (req, res) => {
  const { trainNumber } = req.params;
  const cleanTrainNumber = String(trainNumber || '').trim();

  // 1. Prioritize real-time railway telemetry via RailRadar API
  const apiKey = config.RAILRADAR_API_KEY;

  if (apiKey) {
    try {
      const response = await axios.get(`https://api.railradar.in/v1/trains/${encodeURIComponent(cleanTrainNumber)}/live`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'x-api-key': apiKey
        },
        timeout: 9000
      });

      const liveData = response.data?.data;
      if (liveData) {
        const currLoc = liveData.currentLocation;
        const prevHalt = liveData.previousHalt;
        const nextHalt = liveData.nextHalt;

        let displayLocationName = 'Live unavailable';
        let statusMode = 'running';
        let currentDist = currLoc?.distanceFromOriginKm || prevHalt?.distance || 0;

        if (currLoc) {
          const locName = currLoc.stationName || currLoc.stationCode || '';
          const locCode = currLoc.stationCode || '';
          if (currLoc.status === 'at-station') {
            displayLocationName = locCode ? `${locName} (${locCode})` : locName;
            statusMode = 'CURRENT';
          } else {
            const fromName = prevHalt?.stationName || locName;
            const toName = nextHalt?.stationName || 'Next Station';
            displayLocationName = `Between ${fromName} and ${toName}`;
            statusMode = 'DEPARTED';
          }
        } else if (prevHalt && nextHalt) {
          displayLocationName = `Between ${prevHalt.stationName} and ${nextHalt.stationName}`;
          statusMode = 'DEPARTED';
        }

        const routeItems = liveData.route || [];
        const totalReceived = routeItems.length;
        const haltingCount = routeItems.filter(r => r.isHalt === true).length;
        const nonHaltingCount = routeItems.filter(r => r.isHalt === false).length;
        console.log(`[RailRadar] Train ${cleanTrainNumber} Route Entries Received: ${totalReceived} (Halting: ${haltingCount}, Non-halting: ${nonHaltingCount})`);

        let transformedStations = [];
        let prevDistance = 0;

        routeItems.forEach((r, i) => {
          const distance = typeof r.distance === 'number' ? r.distance : (parseFloat(r.distance) || 0);
          const distFromPrev = Math.max(0, distance - prevDistance);
          prevDistance = distance;

          const currentStationCode = r.stationCode || '';
          const coords = (r.lat && r.lng)
            ? { lat: Number(r.lat), lng: Number(r.lng) }
            : (stationCoordsMap.get(currentStationCode) || null);

          const isHalt = r.isHalt !== false;
          let locationType = 'station';
          if (!isHalt) {
            locationType = 'non-halting';
          } else if (r.stationName && /halt/i.test(r.stationName)) {
            locationType = 'halt';
          }

          const schedArr = r.scheduledArrival || null;
          const schedDep = r.scheduledDeparture || null;
          const actArr = r.actualArrival || null;
          const actDep = r.actualDeparture || null;
          const delayMin = typeof r.delayArrival === 'number' 
            ? r.delayArrival 
            : (typeof r.delayDeparture === 'number' ? r.delayDeparture : (liveData.delayMinutes || 0));

          let expArr = actArr || r.expectedArrival || null;
          let expDep = actDep || r.expectedDeparture || null;

          if (!expArr && schedArr) {
            const schedDate = new Date(schedArr);
            if (!isNaN(schedDate.getTime())) {
              expArr = new Date(schedDate.getTime() + (delayMin * 60 * 1000)).toISOString();
            }
          }
          if (!expDep && schedDep) {
            const schedDate = new Date(schedDep);
            if (!isNaN(schedDate.getTime())) {
              expDep = new Date(schedDate.getTime() + (delayMin * 60 * 1000)).toISOString();
            }
          }

          let stStatus = "UPCOMING";
          if (r.status === 'departed' || actArr || actDep) {
            stStatus = "PASSED";
          } else if (r.status === 'at-station') {
            stStatus = "CURRENT";
          } else if (currLoc?.sequence && r.sequence && r.sequence < currLoc.sequence) {
            stStatus = "PASSED";
          } else if (currLoc?.distanceFromOriginKm > 0 && distance < currLoc.distanceFromOriginKm) {
            stStatus = "PASSED";
          } else if (currLoc?.sequence && r.sequence && r.sequence === currLoc.sequence) {
            stStatus = currLoc.status === 'at-station' ? "CURRENT" : "PASSED";
          } else if (nextHalt && (r.stationCode === nextHalt.stationCode || r.sequence === nextHalt.sequence)) {
            stStatus = "NEXT";
          }

          transformedStations.push({
            sequence: r.sequence !== undefined ? r.sequence : (i + 1),
            name: r.stationName || currentStationCode,
            code: currentStationCode,
            isHalt: isHalt,
            locationType: locationType,
            scheduledArrival: schedArr,
            scheduledDeparture: schedDep,
            expectedArrival: expArr,
            expectedDeparture: expDep,
            actualArrival: actArr,
            actualDeparture: actDep,
            delayArrival: r.delayArrival !== undefined ? r.delayArrival : null,
            delayDeparture: r.delayDeparture !== undefined ? r.delayDeparture : null,
            delayMinutes: delayMin,
            cumulativeDistanceKm: distance,
            distanceFromPreviousKm: Number(distFromPrev.toFixed(1)),
            status: stStatus,
            latitude: coords ? coords.lat : null,
            longitude: coords ? coords.lng : null,
            coords: coords,
            platform: isHalt ? (r.platform || null) : null,
            expectedPlatform: isHalt ? (r.platform || null) : null,
            speedToNextStationKmph: r.speedToNextStationKmph || null
          });
        });

        if (transformedStations.length > 0) {
          transformedStations[transformedStations.length - 1].status = "DESTINATION";
        }

        const validatedRoute = transformedStations.length > 0 
          ? processTrainRouteDistances(transformedStations, `${liveData.trainNumber} (RailRadar Live)`)
          : [];
        console.log(`[RailRadar] Train ${cleanTrainNumber} Route Entries Displayed: ${validatedRoute.length}`);

        const cleanData = {
          trainNumber: liveData.trainNumber || cleanTrainNumber,
          trainName: liveData.trainName || 'Express',
          isLive: liveData.isLive !== false,
          currentLocationName: displayLocationName,
          currentStation: {
            name: displayLocationName,
            code: currLoc?.stationCode || '',
            status: statusMode,
            cumulativeDistanceKm: currentDist
          },
          nextStation: nextHalt ? {
            name: nextHalt.stationCode ? `${nextHalt.stationName} (${nextHalt.stationCode})` : nextHalt.stationName,
            code: nextHalt.stationCode
          } : null,
          previousStation: prevHalt ? {
            name: prevHalt.stationCode ? `${prevHalt.stationName} (${prevHalt.stationCode})` : prevHalt.stationName,
            code: prevHalt.stationCode
          } : null,
          delayMinutes: currLoc?.delayMinutes ?? liveData.delayMinutes ?? 0,
          speedKmh: currLoc?.speedKmh || liveData.train?.avgSpeed || 80,
          currentDistanceKm: currentDist,
          stations: validatedRoute,
          lastUpdatedAt: liveData.lastUpdatedAt || new Date().toISOString()
        };

        return res.json({ success: true, data: cleanData });
      }
    } catch (error) {
      console.warn(`RailRadar API notice for ${cleanTrainNumber}:`, error.message);
    }
  }

  // 2. Demo presentation fallback if explicitly defined
  const demoLiveData = getDemoTrainLiveData(cleanTrainNumber);
  if (demoLiveData) {
    return res.json({ success: true, data: demoLiveData });
  }

  // If live telemetry is genuinely unavailable, report it without faking live location (Requirement 17)
  return res.status(404).json({
    success: false,
    msg: `Live telemetry currently unavailable for train ${cleanTrainNumber} (external railway service did not report active running status)`,
    liveAvailable: false
  });
});

module.exports = router;
