import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';

export default function TrainDetailsScreen({ route, navigation }) {
  const { train } = route.params;
  const [alertDistance, setAlertDistance] = useState(5); // Default 5km

  // For this mock prototype, we'll just select the last station as destination
  const destination = train.stations[train.stations.length - 1];

  const handleSetAlarm = () => {
    Alert.alert(
      "Alarm Set!", 
      `We will wake you up ${alertDistance}km before ${destination}. Have a safe sleep!`,
      [{ text: "OK", onPress: () => navigation.navigate('Home') }]
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{train.trainNumber} - {train.trainName}</Text>
      
      <View style={styles.infoCard}>
        <Text style={styles.label}>Current Location:</Text>
        <Text style={styles.value}>{train.currentLocation.station}</Text>
        
        <Text style={styles.label}>Delay:</Text>
        <Text style={[styles.value, { color: train.delayMinutes > 0 ? 'red' : 'green' }]}>
          {train.delayMinutes > 0 ? `${train.delayMinutes} mins late` : 'On time'}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Set Destination Alarm</Text>
      <View style={styles.destinationCard}>
        <Text style={styles.destText}>Destination: {destination}</Text>
      </View>

      <Text style={styles.label}>Alert me when train is within:</Text>
      <View style={styles.distanceContainer}>
        {[2, 5, 10].map(dist => (
          <TouchableOpacity 
            key={dist} 
            style={[styles.distButton, alertDistance === dist && styles.distButtonActive]}
            onPress={() => setAlertDistance(dist)}
          >
            <Text style={[styles.distText, alertDistance === dist && styles.distTextActive]}>{dist} km</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.setAlarmButton} onPress={handleSetAlarm}>
        <Text style={styles.setAlarmText}>Set Smart Alarm</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 30,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    color: '#888',
    marginBottom: 5,
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#444',
  },
  destinationCard: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  destText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0d47a1',
  },
  distanceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
    marginTop: 10,
  },
  distButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 8,
    alignItems: 'center',
  },
  distButtonActive: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  distText: {
    fontSize: 16,
    color: '#555',
    fontWeight: 'bold',
  },
  distTextActive: {
    color: '#fff',
  },
  setAlarmButton: {
    backgroundColor: '#28a745',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#28a745',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 5,
  },
  setAlarmText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  }
});
