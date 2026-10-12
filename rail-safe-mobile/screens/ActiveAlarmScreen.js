import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Animated, ScrollView, Linking, Vibration, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
// expo-notifications removed due to SDK 53 Expo Go crash
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
// Bypassing expo-av temporarily due to ExponentAV Native Module linking error
// import { Audio } from 'expo-av';

// Haversine formula to calculate distance in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error(error);
    return;
  }
  if (data) {
    const { locations } = data;
    // Real implementation would sync with live API or compare against target here.
    console.log('Received background location update:', locations);
  }
});

// Notification handler removed

export default function ActiveAlarmScreen({ route, navigation }) {
  const { train, alarmType, alertValue, destination, liveData } = route.params;
  
  let initialIndex = train?.stations?.findIndex(
    s => (s.name || s) === train.currentLocation?.station
  ) || 0;
  
  if (liveData?.currentLocation?.stationName) {
    const liveIndex = train?.stations?.findIndex(
      s => (s.name || s).toLowerCase() === liveData.currentLocation.stationName.toLowerCase()
    );
    if (liveIndex !== -1) initialIndex = liveIndex;
  }
  
  const [activeStationIndex, setActiveStationIndex] = useState(Math.max(0, initialIndex));
  
  const selectedDestinationIndex = train?.stations?.findIndex(
    s => (s.name || s) === (destination?.name || destination)
  );

  const [currentDist, setCurrentDist] = useState(null);
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  
  const pollingIntervalRef = useRef(null);
  const isRingingRef = useRef(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [liveDataState, setLiveDataState] = useState(liveData);
  const [networkError, setNetworkError] = useState(null);
  const retryCountRef = useRef(0);
  const MAX_RETRIES = 3;
  const API_URL = 'http://172.16.96.162:5000/api/trains';

  const fetchLiveStatus = async () => {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      setNetworkError('You are offline. Waiting for network...');
      return;
    }
    
    try {
      const response = await fetch(`${API_URL}/${train.trainNumber}/live`);
      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data) {
          setLiveDataState(json.data);
          calculateCurrentStatus(json.data);
          setNetworkError(null);
          retryCountRef.current = 0;
        }
      } else {
        throw new Error('API Error');
      }
    } catch (err) {
      console.error("Polling error", err);
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        setNetworkError(`Connection lost. Retrying... (${retryCountRef.current}/${MAX_RETRIES})`);
        setTimeout(fetchLiveStatus, 5000 * retryCountRef.current);
      } else {
        setNetworkError('Failed to sync live data. Using simulated data.');
      }
    }
  };

  useEffect(() => {
    (async () => {
      // Audio bypassed to prevent ExponentAV crash
      // await Audio.setAudioModeAsync({...});
      
      // Notifications bypassed for Expo Go
      
      const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
      const { status: backStatus } = await Location.requestBackgroundPermissionsAsync();
      if (locStatus !== 'granted') {
        Alert.alert('Permission needed', 'Please enable location tracking for the alarm to work!');
      } else if (backStatus === 'granted') {
        // Expo Go on Android does not support background location.
        // Use foreground tracking in Expo Go.
        // Background tracking is enabled in development/standalone builds.
        const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient';
        
        if (Platform.OS === 'android' && isExpoGo) {
          console.log('Running in Expo Go on Android: skipping background location to prevent warning. Using foreground polling only.');
        } else {
          // Start background location tracking for real-time background ETA polling
          Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 1000, // 1 km
            showsBackgroundLocationIndicator: true,
          });
        }
      }
      
      calculateCurrentStatus(liveData);
    })();

    pollingIntervalRef.current = setInterval(() => {
      if (!isAlarmRinging) {
        fetchLiveStatus();
      }
    }, 180000); // 3 minutes

    return () => {
      stopAlarm();
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [isAlarmRinging]);

  useEffect(() => {
    if (isAlarmRinging) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
          Animated.timing(fadeAnim, { toValue: 0, duration: 500, useNativeDriver: false })
        ])
      ).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [isAlarmRinging]);

  const playSpeechLoop = () => {
    if (!isRingingRef.current) return;

    Speech.speak(`Wake up! Your train is approaching ${destination.name || destination}.`, {
      rate: 0.9,
      pitch: 1.1,
      onDone: () => {
        // Wait 1 second and repeat
        setTimeout(playSpeechLoop, 1000);
      },
      onStopped: () => {
        // Stopped manually
      }
    });
  };

  const triggerAlarm = async () => {
    setIsAlarmRinging(true);
    isRingingRef.current = true;
    
    // Audio bypassed to prevent ExponentAV crash
    // 2. Vibrate Device (Haptics loop could be setup via interval, for now single heavy)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    // 3. Text-To-Speech (TTS) Looping infinitely
    playSpeechLoop();

    // 4. Notifications bypassed
  };

  const stopAlarm = async () => {
    setIsAlarmRinging(false);
    isRingingRef.current = false;
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    Speech.stop();
  };

  const handleStopPress = () => {
    stopAlarm();
    Alert.alert('Arrived', 'Alarm Stopped. You have arrived safely!');
    navigation.navigate('Home');
  };

  const handleCancel = () => {
    stopAlarm();
    navigation.navigate('Home');
  };

  const handleEmergencyCall = () => {
    Linking.openURL('tel:139');
  };

  const calculateCurrentStatus = (currentLiveData = liveDataState) => {
    let destNode = null;
    let currentNode = null;
    let remainingDistance = null;
    
    if (currentLiveData?.stations) {
      const targetCode = destination?.code || destination;
      const targetName = destination?.name || destination;
      
      destNode = currentLiveData.stations.find(s => s.code === targetCode || s.name === targetName);
      currentNode = currentLiveData.stations.find(s => s.status === 'CURRENT' || s.status === 'NEXT');
      
      if (destNode && currentNode && destNode.cumulativeDistanceKm !== undefined && currentNode.cumulativeDistanceKm !== undefined) {
         remainingDistance = Math.max(0, destNode.cumulativeDistanceKm - currentNode.cumulativeDistanceKm);
      }
    }
    
    if (remainingDistance === null && destination?.coords) {
      const destCoords = destination.coords;
      let currentIndex = activeStationIndex;
      if (currentLiveData?.currentStation?.name) {
        const liveIndex = (currentLiveData.stations || train?.stations || []).findIndex(
          s => (s.name || s).toLowerCase() === currentLiveData.currentStation.name.toLowerCase()
        );
        if (liveIndex !== -1) {
          currentIndex = liveIndex;
          setActiveStationIndex(liveIndex);
        }
      }
      const startStation = (currentLiveData?.stations || train.stations || [])[currentIndex];
      if (startStation && startStation.coords) {
         remainingDistance = calculateDistance(startStation.coords.lat, startStation.coords.lng, destCoords.lat, destCoords.lng);
      }
    }
    
    if (remainingDistance === null) {
      setCurrentDist(null);
      return;
    }
    
    let effectiveValue = remainingDistance;
    
    if (alarmType === 'time') {
      const speed = currentLiveData?.speedKmh || 60;
      const timeInHours = remainingDistance / (speed > 0 ? speed : 60);
      effectiveValue = timeInHours * 60;
      setCurrentDist(effectiveValue.toFixed(0));
    } else {
      setCurrentDist(remainingDistance.toFixed(1));
    }
    
    if (effectiveValue <= alertValue && remainingDistance > 0) {
      triggerAlarm();
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const backgroundColor = fadeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#0f2027', 'rgba(255, 75, 75, 0.4)']
  });

  const displayStartStation = train.userSelectedFrom || train.fromStation || (train.stations && (typeof train.stations[0] === 'string' ? train.stations[0] : train.stations[0]?.name)) || "Unavailable";
  const displayEndStation = typeof destination === 'string' ? destination : (destination?.name || destination?.code || "Unavailable");

  console.log("=== ACTIVE ALARM RENDER ===");
  console.log("TRAIN DATA:", train);
  console.log("LIVE DATA:", liveDataState);
  console.log("SELECTED DESTINATION:", destination);
  console.log("===========================");

  let displayETA = "ETA unavailable";
  let displayDelay = 0;
  let currentStationDisplay = "Unavailable";
  let nextStationDisplay = "Unavailable";
  
  if (liveDataState?.currentStation?.name) {
     currentStationDisplay = liveDataState.currentStation.name;
  } else if (train.currentLocation?.station) {
     currentStationDisplay = train.currentLocation.station;
  }
  
  if (liveDataState?.nextStation?.name) {
     nextStationDisplay = liveDataState.nextStation.name;
  }
  
  displayDelay = liveDataState?.delayMinutes !== undefined ? liveDataState.delayMinutes : (train.delayMinutes || 0);
  
  const destIndexInLive = liveDataState?.stations?.findIndex(s => s.code === (destination?.code || destination) || s.name === (destination?.name || destination));
  if (destIndexInLive !== undefined && destIndexInLive !== -1) {
     const destStationLive = liveDataState.stations[destIndexInLive];
     if (destStationLive.expectedArrival) {
         displayETA = formatTime(destStationLive.expectedArrival);
     } else if (destStationLive.scheduledArrival) {
         if (displayDelay > 0) {
             const schedDate = new Date(destStationLive.scheduledArrival);
             schedDate.setMinutes(schedDate.getMinutes() + displayDelay);
             displayETA = formatTime(schedDate.toISOString()) + " (Est)";
         } else {
             displayETA = formatTime(destStationLive.scheduledArrival) + " (Sched)";
         }
     }
  } else {
     if (alarmType === 'time' && currentDist !== null) {
        displayETA = `In ~${currentDist} mins (Est)`;
     } else if (alarmType === 'distance' && currentDist !== null) {
        const mins = (parseFloat(currentDist) / 60) * 60;
        displayETA = `In ~${Math.round(mins)} mins (Est)`;
     }
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor, padding: 0 }]}>
      {isAlarmRinging ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, width: '100%' }}>
          <Text style={{ fontSize: 60, marginBottom: 10 }}>🔔</Text>
          <Text style={[styles.title, { fontSize: 32, textAlign: 'center', marginBottom: 10 }]}>DESTINATION ALERT</Text>
          <Text style={{ fontSize: 18, color: '#fff', marginBottom: 30, textAlign: 'center' }}>Your destination is approaching.</Text>
          
          <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: 20, borderRadius: 15, marginBottom: 40, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
            <Text style={{ fontSize: 28, color: '#fff', fontWeight: 'bold', marginBottom: 5 }}>{displayEndStation}</Text>
            <Text style={{ fontSize: 16, color: '#ddd' }}>
              Approximately {currentDist} {alarmType === 'distance' ? 'km' : 'minutes'} away.
            </Text>
          </View>
          
          <TouchableOpacity style={[styles.stopButton, { width: '100%', elevation: 10, shadowColor: '#FF6B6B' }]} onPress={handleStopPress}>
            <Text style={styles.stopButtonText}>DISMISS</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flex: 1, width: '100%', padding: 20 }}>
          {networkError && (
            <View style={{ backgroundColor: 'rgba(255, 60, 60, 0.2)', padding: 10, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#FF6B6B' }}>
              <Text style={{ color: '#FF6B6B', fontWeight: 'bold', textAlign: 'center' }}>⚠️ {networkError}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <View style={{ backgroundColor: '#20C997', width: 10, height: 10, borderRadius: 5, marginRight: 8 }} />
            <Text style={{ color: '#20C997', fontSize: 18, fontWeight: 'bold' }}>Monitoring your journey</Text>
          </View>

          <Text style={{ fontSize: 18, color: '#fff', textAlign: 'center', marginBottom: 5 }}>{train.trainNumber} - {train.trainName}</Text>
          <Text style={{ fontSize: 16, color: '#50E3C2', textAlign: 'center', fontWeight: 'bold', marginBottom: 20 }}>
            Destination: {displayEndStation}
          </Text>

          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#aaa', textTransform: 'uppercase' }}>Start Station</Text>
                <Text style={{ fontSize: 14, color: '#fff', fontWeight: 'bold' }}>{displayStartStation}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 12, color: '#aaa', textTransform: 'uppercase' }}>End Station</Text>
                <Text style={{ fontSize: 14, color: '#50E3C2', fontWeight: 'bold' }}>{displayEndStation}</Text>
              </View>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#aaa', textTransform: 'uppercase' }}>Current Station</Text>
                <Text style={{ fontSize: 14, color: '#fff' }}>{currentStationDisplay}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 12, color: '#aaa', textTransform: 'uppercase' }}>Next Station</Text>
                <Text style={{ fontSize: 14, color: '#fff' }}>{nextStationDisplay}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#aaa', textTransform: 'uppercase' }}>Delay</Text>
                <Text style={{ fontSize: 14, color: displayDelay > 0 ? '#FF6B6B' : '#50E3C2' }}>
                  {displayDelay > 0 ? `+${displayDelay} mins` : 'On Time'}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 12, color: '#aaa', textTransform: 'uppercase' }}>Current ETA</Text>
                <Text style={{ fontSize: 14, color: '#fff', fontWeight: 'bold' }}>{displayETA}</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', marginBottom: 20 }}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 12, color: '#aaa', textTransform: 'uppercase' }}>Target Alert</Text>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>{alertValue} {alarmType === 'distance' ? 'km' : 'mins'}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={{ fontSize: 12, color: '#aaa', textTransform: 'uppercase' }}>{alarmType === 'distance' ? 'Current Dist' : 'Current Time'}</Text>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#4A90E2' }}>
                {currentDist !== null ? `${currentDist} ${alarmType === 'distance' ? 'km' : 'mins'}` : 'Unavailable'}
              </Text>
            </View>
          </View>

          <ScrollView style={styles.timelineContainerWrapper} contentContainerStyle={{ paddingVertical: 10 }}>
            {(liveDataState?.stations || train.stations)?.map((station, index) => {
              const isCurrent = index === activeStationIndex;
              const isPast = index < activeStationIndex;
              const isSelected = index === selectedDestinationIndex;
              
              return (
                <View 
                  key={index} 
                  style={[styles.timelineNode, isSelected && styles.timelineNodeSelected]}
                >
                  {index !== (liveDataState?.stations || train.stations).length - 1 && (
                    <View style={[styles.timelineLine, isPast ? styles.timelineLinePast : {}]} />
                  )}
                  
                  <View style={styles.timelineIconContainer}>
                    {isCurrent ? (
                      <View style={styles.currentTrainIcon}>
                        <Ionicons name="train" size={14} color="#fff" />
                      </View>
                    ) : (
                      <View style={[styles.timelineDot, isPast ? styles.timelineDotPast : {}, isSelected ? styles.timelineDotSelected : {}]} />
                    )}
                  </View>

                  <View style={styles.timelineContent}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingRight: 10 }}>
                      <Text style={[styles.stationName, isCurrent && styles.stationNameCurrent, isSelected && styles.stationNameSelected]}>
                        {station.name || station} {station.code ? `(${station.code})` : ''}
                      </Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 10, fontWeight: 'bold', color: station.status === 'CURRENT' ? '#2196F3' : station.status === 'PASSED' ? '#4A90E2' : '#888', backgroundColor: '#eee', paddingHorizontal: 4, borderRadius: 3, overflow: 'hidden' }}>
                          {station.status || (isCurrent ? 'CURRENT' : (isPast ? 'PASSED' : 'UPCOMING'))}
                        </Text>
                        {(station.delayMinutes !== undefined && station.delayMinutes !== null) && (
                          <Text style={{ fontSize: 12, fontWeight: 'bold', color: station.delayMinutes > 0 ? '#FF6B6B' : '#50E3C2', marginTop: 2 }}>
                            {station.delayMinutes > 0 ? `+${station.delayMinutes}m` : 'On Time'}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingRight: 10 }}>
                      <View>
                        {station.scheduledArrival && <Text style={{ fontSize: 11, color: '#666' }}>Sch Arr: {formatTime(station.scheduledArrival)}</Text>}
                        {station.scheduledDeparture && <Text style={{ fontSize: 11, color: '#666' }}>Sch Dep: {formatTime(station.scheduledDeparture)}</Text>}
                        {station.expectedArrival && <Text style={{ fontSize: 11, color: '#333' }}>Exp Arr: {formatTime(station.expectedArrival)}</Text>}
                        {station.expectedDeparture && <Text style={{ fontSize: 11, color: '#333' }}>Exp Dep: {formatTime(station.expectedDeparture)}</Text>}
                      </View>
                      <View style={{ alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                        {(station.distanceFromPreviousKm !== undefined && station.distanceFromPreviousKm !== null) && (
                          <Text style={{ fontSize: 11, color: '#666' }}>Dist: {station.distanceFromPreviousKm} km</Text>
                        )}
                        {isCurrent && (
                          <Text style={styles.stationDistance}>Train is here!</Text>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginBottom: 10 }}>
            <TouchableOpacity style={[styles.actionButton, { flex: 1, marginBottom: 0 }]} onPress={() => fetchLiveStatus()}>
              <Text style={styles.actionButtonText}>Refresh Status</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { flex: 1, backgroundColor: '#FF6B6B', marginBottom: 0 }]} onPress={triggerAlarm}>
              <Text style={styles.actionButtonText}>🔔 Test Alarm</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Stop Monitoring</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.emergencyButton} onPress={handleEmergencyCall}>
            <Ionicons name="call" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.emergencyButtonText}>Emergency Help (139)</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 18,
    color: '#50E3C2',
    marginBottom: 10,
  },
  destText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 40,
  },
  dataContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  label: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 5,
  },
  value: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  timelineContainerWrapper: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 20,
    maxHeight: 250,
  },
  timelineNode: {
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  timelineNodeSelected: {
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
  },
  timelineLine: {
    position: 'absolute',
    left: 26, 
    top: 30,
    bottom: -15,
    width: 4,
    backgroundColor: '#D3E3FD',
    zIndex: 1,
  },
  timelineLinePast: {
    backgroundColor: '#4A90E2',
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
  stationDistance: {
    fontSize: 12,
    color: '#4A90E2',
    marginTop: 2,
  },
  actionButton: {
    backgroundColor: '#4A90E2',
    padding: 20,
    borderRadius: 15,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  stopButton: {
    backgroundColor: '#ff4b4b',
    padding: 25,
    borderRadius: 15,
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  stopButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 24,
  },
  cancelButton: {
    padding: 15,
    width: '100%',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#aaa',
    fontSize: 16,
  },
  emergencyButton: {
    flexDirection: 'row',
    backgroundColor: '#d93025',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  emergencyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
