import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, StatusBar, ScrollView, Linking, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
const API_URL = 'http://172.16.96.162:5000/api/trains';
export default function HomeScreen({ navigation }) {
  const [fromStation, setFromStation] = useState('PNBE');
  const [fromStationName, setFromStationName] = useState('Patna Junction');
  const [toStation, setToStation] = useState('ERS');
  const [toStationName, setToStationName] = useState('Ernakulam Junction');
  const [trainQuery, setTrainQuery] = useState('');
  const [departureBoardQuery, setDepartureBoardQuery] = useState('');
  const [searchingTrain, setSearchingTrain] = useState(false);

  const swapStations = () => {
    setFromStation(toStation);
    setFromStationName(toStationName);
    setToStation(fromStation);
    setToStationName(fromStationName);
  };

  const findTrains = () => {
    navigation.navigate('TrainList', {
      fromStation,
      fromStationName,
      toStation,
      toStationName,
    });
  };

  const searchByTrainNumber = async () => {
    if (!trainQuery) return;
    setSearchingTrain(true);
    try {
      const response = await fetch(`${API_URL}/search?query=${trainQuery}`);
      const data = await response.json();
      if (data && data.length > 0) {
        navigation.navigate('TrainDetails', { train: data[0] });
      } else {
        Alert.alert('No Train Found', 'Could not find a train matching that number or name.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to search train. Check network connection.');
    }
    setSearchingTrain(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1E222D" />
      
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerIcon}>
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>RailSafe Alert</Text>
        <TouchableOpacity style={styles.headerIcon}>
          <MaterialIcons name="settings" size={26} color="#50E3C2" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        
        {/* Live System active badge */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 15 }}>
          <View style={[styles.liveIndicator, {backgroundColor: '#20C997', width: 8, height: 8, borderRadius: 4, marginRight: 5}]} />
          <Text style={{ color: '#20C997', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 }}>LIVE SYSTEM ACTIVE</Text>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 15 }}>
          <View style={styles.featureChip}><Text style={styles.featureChipText}>📡 Live</Text></View>
          <View style={styles.featureChip}><Text style={styles.featureChipText}>🔔 Alerts</Text></View>
          <View style={styles.featureChip}><Text style={styles.featureChipText}>⏱️ ETA</Text></View>
        </View>

        {/* Route Search Section */}
        <View style={styles.card}>
          <View style={styles.stationInputRow}>
            <MaterialIcons name="radio-button-unchecked" size={20} color="#aaa" />
            <View style={styles.stationTextContainer}>
              <Text style={styles.stationCode}>{fromStation}</Text>
              <TextInput 
                style={styles.stationInput} 
                value={fromStationName}
                onChangeText={setFromStationName}
                placeholder="From Station"
                placeholderTextColor="#aaa"
              />
            </View>
            <TouchableOpacity onPress={() => setFromStationName('')}>
              <Ionicons name="close" size={20} color="#aaa" />
            </TouchableOpacity>
          </View>

          <View style={styles.dividerContainer}>
            <View style={styles.dottedLine} />
            <TouchableOpacity style={styles.swapButton} onPress={swapStations}>
              <MaterialCommunityIcons name="swap-vertical" size={22} color="#50E3C2" />
            </TouchableOpacity>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.stationInputRow}>
            <MaterialIcons name="radio-button-unchecked" size={20} color="#aaa" />
            <View style={styles.stationTextContainer}>
              <Text style={styles.stationCode}>{toStation}</Text>
              <TextInput 
                style={styles.stationInput} 
                value={toStationName}
                onChangeText={setToStationName}
                placeholder="To Station"
                placeholderTextColor="#aaa"
              />
            </View>
            <TouchableOpacity onPress={() => setToStationName('')}>
              <Ionicons name="close" size={20} color="#aaa" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.findTrainsButton} onPress={findTrains}>
            <Text style={styles.findTrainsText}>Find trains</Text>
          </TouchableOpacity>
        </View>

        {/* Train Number Search */}
        <View style={styles.cardRow}>
          <MaterialIcons name="train" size={24} color="#8ab4f8" style={styles.cardIcon} />
          <TextInput 
            style={styles.singleInput}
            placeholder="Train No. / Train Name"
            placeholderTextColor="#aaa"
            value={trainQuery}
            onChangeText={setTrainQuery}
            onSubmitEditing={searchByTrainNumber}
          />
          <TouchableOpacity style={styles.searchIconButton} onPress={searchByTrainNumber}>
            {searchingTrain ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="search" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>

        {/* Departure Board */}
        <View style={styles.cardRow}>
          <MaterialCommunityIcons name="broadcast" size={24} color="#8ab4f8" style={styles.cardIcon} />
          <TextInput 
            style={styles.singleInput}
            placeholder="Station departure board"
            placeholderTextColor="#aaa"
            value={departureBoardQuery}
            onChangeText={setDepartureBoardQuery}
          />
          <TouchableOpacity style={styles.searchIconButton}>
            <Ionicons name="search" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search History */}
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>SEARCH HISTORY</Text>
          <TouchableOpacity style={styles.historyItem}>
            <Text style={styles.historyText} numberOfLines={1}>22670 Ernakulam Junction. SF Ex...</Text>
            <View style={styles.historyRight}>
              <Text style={styles.historyRoute}>PNBE - ERS</Text>
              <Ionicons name="chevron-forward" size={16} color="#50E3C2" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Emergency Contact */}
        <TouchableOpacity style={styles.emergencyCard} onPress={() => Linking.openURL('tel:139')}>
          <MaterialIcons name="security" size={24} color="#fff" style={styles.cardIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.emergencyTitle}>Railway Emergency (139)</Text>
            <Text style={styles.emergencySubtitle}>Tap here to call for security, medical, or complaints</Text>
          </View>
          <Ionicons name="call" size={20} color="#fff" />
        </TouchableOpacity>

      </ScrollView>

      {/* Bottom Tabs */}
      <View style={styles.bottomTabs}>
        <TouchableOpacity style={styles.bottomTabActive}>
          <Ionicons name="search" size={20} color="#8ab4f8" />
          <Text style={styles.bottomTabTextActive}>SPOT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomTab}>
          <MaterialCommunityIcons name="ticket-confirmation-outline" size={20} color="#aaa" />
          <Text style={styles.bottomTabText}>PNR</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bottomTab}>
          <Ionicons name="pricetag-outline" size={20} color="#aaa" />
          <Text style={styles.bottomTabText}>TICKETS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1E222D',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: '#232731',
  },
  headerIcon: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '500',
  },
  container: {
    padding: 15,
  },
  featureChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  featureChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#2A2E39',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
  },
  stationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stationTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 15,
  },
  stationCode: {
    color: '#8ab4f8',
    backgroundColor: 'rgba(138, 180, 248, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 10,
    fontSize: 14,
    fontWeight: 'bold',
  },
  stationInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    padding: 0,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
    paddingLeft: 9,
  },
  dottedLine: {
    height: 40,
    width: 2,
    borderStyle: 'dotted',
    borderWidth: 1,
    borderColor: '#555',
    marginRight: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
    marginLeft: 15,
  },
  swapButton: {
    backgroundColor: '#1E222D',
    borderRadius: 20,
    padding: 5,
    borderWidth: 1,
    borderColor: '#333',
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  findTrainsButton: {
    backgroundColor: '#1E8E3E',
    borderRadius: 6,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  findTrainsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2A2E39',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  cardIcon: {
    marginHorizontal: 10,
  },
  singleInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    padding: 5,
  },
  searchIconButton: {
    backgroundColor: '#1E8E3E',
    padding: 8,
    borderRadius: 6,
  },
  historyContainer: {
    backgroundColor: '#2A2E39',
    borderRadius: 8,
    padding: 15,
    marginTop: 5,
  },
  historyTitle: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyText: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyRoute: {
    color: '#fff',
    fontSize: 14,
    marginRight: 5,
  },
  bottomTabs: {
    flexDirection: 'row',
    backgroundColor: '#232731',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingVertical: 10,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabActive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabText: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 5,
  },
  bottomTabTextActive: {
    color: '#8ab4f8',
    fontSize: 12,
    marginTop: 5,
    fontWeight: 'bold',
  },
  emergencyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d93025',
    borderRadius: 8,
    padding: 15,
    marginTop: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  emergencyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emergencySubtitle: {
    color: '#ffcccc',
    fontSize: 12,
    marginTop: 2,
  }
});

