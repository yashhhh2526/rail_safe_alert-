import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Make sure this matches your actual backend IP
const API_URL = 'http://172.16.96.162:5000/api/trains';

export default function TrainDetailsScreen({ route, navigation }) {
  const { train } = route.params;
  const [alarmType, setAlarmType] = useState('distance');
  const [alertDistance, setAlertDistance] = useState(10);
  const [alertTime, setAlertTime] = useState(15);
  
  const [displayStations, setDisplayStations] = useState(train.stations || []);
  const [selectedDestinationIndex, setSelectedDestinationIndex] = useState(
    train.stations ? train.stations.length - 1 : 0
  );
  
  const [liveData, setLiveData] = useState(null);
  const [loadingLive, setLoadingLive] = useState(true);
  const [liveError, setLiveError] = useState(null);

  useEffect(() => {
    const fetchLiveData = async () => {
      try {
        setLoadingLive(true);
        const res = await fetch(`${API_URL}/${train.trainNumber}/live`);
        const json = await res.json();
        if (json.success && json.data) {
          setLiveData(json.data);
        } else {
          setLiveError('Invalid live data format');
        }
      } catch (err) {
        setLiveError(err.message);
      } finally {
        setLoadingLive(false);
      }
    };
    fetchLiveData();
  }, [train.trainNumber]);

  useEffect(() => {
    if (liveData?.stations && liveData.stations.length > 0) {
      let stationsToDisplay = [...liveData.stations];
      
      if (train.toStation) {
         const destIndex = stationsToDisplay.findIndex(s => 
           s.name.toLowerCase().includes(train.toStation.toLowerCase()) || 
           s.code === train.toStation
         );
         if (destIndex !== -1) {
             stationsToDisplay = stationsToDisplay.slice(0, destIndex + 1);
             stationsToDisplay[stationsToDisplay.length - 1].status = 'DESTINATION';
         }
      }

      setDisplayStations(stationsToDisplay);
      setSelectedDestinationIndex(stationsToDisplay.length - 1);
    }
  }, [liveData]);

  const formatTime = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleSetAlarm = () => {
    const selectedDestination = displayStations[selectedDestinationIndex];
    if (!selectedDestination) {
      Alert.alert('Error', 'Please select a valid destination station.');
      return;
    }
    navigation.navigate('ActiveAlarm', { 
      train: { ...train, stations: displayStations }, 
      alarmType, 
      alertValue: alarmType === 'distance' ? alertDistance : alertTime, 
      destination: selectedDestination,
      liveData
    });
  };

  let displayLocation = 'Unavailable';
  let displayNextHalt = 'N/A';
  
  if (liveData) {
    if (liveData.currentStation?.name) {
      displayLocation = liveData.currentStation.name;
    } else if (liveData.stations) {
      const passedStns = liveData.stations.filter(s => s.status === 'PASSED');
      if (passedStns.length > 0) {
        displayLocation = `Departed ${passedStns[passedStns.length - 1].name}`;
      } else {
        displayLocation = train.currentLocation?.station || 'Origin';
      }
    }
    
    if (liveData.nextStation?.name) {
      displayNextHalt = liveData.nextStation.name;
    }
  } else {
    displayLocation = train.currentLocation?.station || 'Unavailable';
  }

  const displayDelay = liveData?.delayMinutes ?? train.delayMinutes;
  const displaySpeed = liveData?.speedKmh ? `${Math.round(liveData.speedKmh)} km/h` : 'N/A';
  const lastUpdated = liveData?.lastUpdatedAt ? new Date(liveData.lastUpdatedAt).toLocaleTimeString() : 'N/A';

  let distanceRemaining = null;
  const selectedDestination = displayStations[selectedDestinationIndex];
  if (liveData?.stations && selectedDestination) {
    const destNode = liveData.stations.find(s => s.code === selectedDestination.code || s.name === selectedDestination.name);
    const currentNode = liveData.stations.find(s => s.status === 'CURRENT' || s.status === 'NEXT');
    if (destNode && currentNode && destNode.cumulativeDistanceKm !== undefined && currentNode.cumulativeDistanceKm !== undefined) {
      const remaining = destNode.cumulativeDistanceKm - currentNode.cumulativeDistanceKm;
      distanceRemaining = Math.max(0, remaining).toFixed(1);
    }
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>{train.trainName}</Text>
      <Text style={styles.subtitle}>Train No: {train.trainNumber}</Text>

      {loadingLive ? (
        <View style={styles.infoCard}>
           <ActivityIndicator size="small" color="#50E3C2" />
           <Text style={styles.label}>Fetching live status...</Text>
        </View>
      ) : (
        <View style={styles.infoCard}>
          <View style={styles.row}>
            <View style={{flex: 1}}>
              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                <View style={[styles.liveIndicator, {backgroundColor: '#20C997', width: 8, height: 8, borderRadius: 4, marginRight: 5}]} />
                <Text style={styles.label}>LIVE Status</Text>
              </View>
              <Text style={styles.value}>
                {displayDelay > 0 ? `Delayed by ${displayDelay} mins` : 'On Time'}
              </Text>
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.label}>Speed</Text>
              <Text style={styles.value}>{displaySpeed}</Text>
            </View>
          </View>
          <View style={[styles.row, {marginTop: 15}]}>
            <View style={{flex: 1}}>
              <Text style={styles.label}>Current Location</Text>
              <Text style={styles.value}>{displayLocation}</Text>
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.label}>Next Halt</Text>
              <Text style={styles.value}>{displayNextHalt}</Text>
            </View>
          </View>
          <View style={[styles.row, {marginTop: 15}]}>
            <View style={{flex: 1}}>
              <Text style={styles.label}>Distance To Destination</Text>
              <Text style={[styles.value, {color: '#50E3C2'}]}>{distanceRemaining !== null ? `${distanceRemaining} km remaining` : 'Unavailable'}</Text>
            </View>
          </View>
          {!liveError && (
            <Text style={{color: '#aaa', fontSize: 11, marginTop: 15, textAlign: 'right'}}>
              LIVE • Updated: {lastUpdated}
            </Text>
          )}
          {liveError && (
            <Text style={{color: '#d93025', fontSize: 12, marginTop: 10}}>
              ⚠️ Live data unavailable
            </Text>
          )}
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.label}>Select Destination Station</Text>
        <View style={styles.timelineContainer}>
          {displayStations.length === 0 ? (
            <Text style={{color: '#888', fontStyle: 'italic', paddingVertical: 10, textAlign: 'center'}}>Station route unavailable</Text>
          ) : (
            displayStations.map((station, index) => {
              const isSelected = index === selectedDestinationIndex;
              const isPast = station.status === 'PASSED';
              const isCurrent = station.status === 'CURRENT';
              
              return (
                <TouchableOpacity 
                  key={index} 
                  style={[styles.timelineNode, isSelected && styles.timelineNodeSelected]}
                  onPress={() => setSelectedDestinationIndex(index)}
                >
                  {/* The vertical line */}
                  {index !== displayStations.length - 1 && (
                    <View style={[styles.timelineLine, isPast ? styles.timelineLinePast : {}]} />
                  )}
                  {index !== displayStations.length - 1 && displayStations[index + 1]?.distanceFromPreviousKm > 0 && (
                     <Text style={styles.distanceText}>{displayStations[index + 1].distanceFromPreviousKm} km</Text>
                  )}
                  
                  {/* The dot or icon */}
                  <View style={styles.timelineIconContainer}>
                    {isCurrent ? (
                      <View style={styles.currentTrainIcon}>
                        <Ionicons name="train" size={14} color="#fff" />
                      </View>
                    ) : (
                      <View style={[styles.timelineDot, isPast ? styles.timelineDotPast : {}, isSelected ? styles.timelineDotSelected : {}]} />
                    )}
                  </View>

                  {/* Station Info */}
                  <View style={styles.timelineContent}>
                    <View style={styles.stationRow}>
                      <View>
                        <Text style={[styles.stationName, isCurrent && styles.stationNameCurrent, isSelected && styles.stationNameSelected]}>
                          {station.name || station} {station.code ? `(${station.code})` : ''}
                        </Text>
                        {station.expectedPlatform && (
                          <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                            Platform: {station.expectedPlatform}
                          </Text>
                        )}
                      </View>
                      <Text style={[styles.statusBadge, isCurrent && styles.statusBadgeCurrent, station.status === 'DESTINATION' && styles.statusBadgeDestination]}>
                        {station.status || (isCurrent ? 'CURRENT' : '')}
                      </Text>
                    </View>
                    
                    {(station.scheduledArrival || station.scheduledDeparture) && (
                      <View style={styles.timeRow}>
                        <View style={styles.timeBlock}>
                          <Text style={styles.timeLabel}>Scheduled</Text>
                          <Text style={styles.timeValue}>
                            {formatTime(station.scheduledArrival || station.scheduledDeparture)}
                          </Text>
                        </View>
                        <View style={styles.timeBlock}>
                          <Text style={styles.timeLabel}>Expected</Text>
                          <Text style={styles.timeValue}>
                            {formatTime(station.expectedArrival || station.expectedDeparture)}
                          </Text>
                        </View>
                        <View style={styles.timeBlock}>
                          <Text style={styles.timeLabel}>Delay</Text>
                          <Text style={[styles.timeValue, {color: station.delayMinutes > 0 ? '#d93025' : '#00C851'}]}>
                            {station.delayMinutes > 0 ? `+${station.delayMinutes} min` : 'On time'}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.label}>Alarm Type</Text>
        <View style={styles.row}>
          <TouchableOpacity 
            style={[styles.toggleBtn, alarmType === 'distance' && styles.toggleBtnActive]}
            onPress={() => setAlarmType('distance')}
          >
            <Text style={styles.toggleText}>Distance</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.toggleBtn, alarmType === 'time' && styles.toggleBtnActive]}
            onPress={() => setAlarmType('time')}
          >
            <Text style={styles.toggleText}>Time (ETA)</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.label}>
          Target {alarmType === 'distance' ? 'Distance' : 'Time'} before Arrival
        </Text>
        <View style={styles.row}>
          {(alarmType === 'distance' ? [30, 20, 10] : [30, 15]).map((val) => (
            <TouchableOpacity 
              key={val}
              style={[
                styles.valBtn, 
                (alarmType === 'distance' ? alertDistance === val : alertTime === val) && styles.toggleBtnActive
              ]}
              onPress={() => alarmType === 'distance' ? setAlertDistance(val) : setAlertTime(val)}
            >
              <Text style={styles.toggleText}>{val} {alarmType === 'distance' ? 'km before' : 'mins before'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.actionButton} onPress={handleSetAlarm}>
        <Text style={styles.actionButtonText}>🔔 START JOURNEY ALERT</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#50E3C2',
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  label: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 10,
  },
  value: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  timelineContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  timelineNode: {
    flexDirection: 'row',
    minHeight: 50,
    padding: 10,
    borderRadius: 8,
  },
  timelineNodeSelected: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  timelineLine: {
    position: 'absolute',
    left: 21, // 10 padding + 11 (center of icon space)
    top: 30, // Starts below the dot
    bottom: -15, // Extends to next node
    width: 4,
    backgroundColor: '#D3E3FD',
    zIndex: 1,
  },
  timelineLinePast: {
    backgroundColor: '#4A90E2', // Darker blue for completed track
  },
  timelineIconContainer: {
    width: 26,
    alignItems: 'center',
    marginRight: 10,
    zIndex: 2,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#D3E3FD',
    marginTop: 5,
    borderWidth: 2,
    borderColor: '#fff',
  },
  timelineDotPast: {
    backgroundColor: '#4A90E2',
  },
  timelineDotSelected: {
    backgroundColor: '#4A90E2',
    transform: [{ scale: 1.3 }],
  },
  currentTrainIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -1,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 3,
  },
  timelineContent: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  stationName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  stationNameCurrent: {
    fontWeight: 'bold',
    color: '#000',
  },
  stationNameSelected: {
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  stationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#888',
    backgroundColor: '#eee',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden'
  },
  statusBadgeCurrent: {
    color: '#fff',
    backgroundColor: '#2196F3',
  },
  statusBadgeDestination: {
    color: '#fff',
    backgroundColor: '#4A90E2',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    backgroundColor: '#f9f9f9',
    padding: 6,
    borderRadius: 6,
  },
  timeBlock: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 10,
    color: '#888',
  },
  timeValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  distanceText: {
    position: 'absolute',
    left: 10,
    top: 45,
    fontSize: 10,
    color: '#888',
    backgroundColor: '#fff',
    paddingHorizontal: 2,
    zIndex: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toggleBtn: {
    flex: 1,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  toggleText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  valBtn: {
    flex: 1,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: '#50E3C2',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    marginBottom: 40,
  },
  actionButtonText: {
    color: '#0f2027',
    fontWeight: 'bold',
    fontSize: 18,
  }
});
