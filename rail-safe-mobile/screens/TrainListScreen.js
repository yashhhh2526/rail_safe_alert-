import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const API_URL = 'http://172.16.96.162:5000/api/trains';
export default function TrainListScreen({ route, navigation }) {
  const { fromStation, fromStationName, toStation, toStationName } = route.params;
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showClassModal, setShowClassModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [showDateModal, setShowDateModal] = useState(false);

  useEffect(() => {
    fetchTrains();
  }, [fromStation, toStation]);

  const fetchTrains = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/searchByRoute?from=${fromStation}&to=${toStation}`);
      const data = await res.json();
      setTrains(data);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  const renderTrain = ({ item }) => {
    const runningDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return (
      <TouchableOpacity 
        style={styles.trainCard}
        onPress={() => navigation.navigate('TrainDetails', { train: { ...item, userSelectedFrom: fromStationName || fromStation } })}
      >
        <View style={styles.trainHeaderRow}>
          <Text style={styles.trainNumber}>{item.trainNumber}</Text>
          <Text style={styles.trainTime}>{item.departureTime}</Text>
          <Text style={styles.trainDuration}>— {item.duration} —</Text>
          <Text style={styles.trainTime}>{item.arrivalTime}</Text>
          <Text style={styles.trainPrice}>₹{item.fare}</Text>
        </View>
        
        <View style={styles.trainSubRow}>
          <Text style={styles.trainName} numberOfLines={1}>{item.trainName}</Text>
          <View style={styles.daysRow}>
            {runningDays.map((day, idx) => (
              <Text key={idx} style={[styles.dayText, item.runningDays.includes(day) ? styles.dayActive : styles.dayInactive]}>
                {day}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.platformRow}>
          <Text style={styles.platformText}>
            Expected Platform: {item.expectedPlatform || 'TBD'}
          </Text>
        </View>

        {item.isNotRunningToday && (
          <Text style={styles.notRunningText}>Not running today</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderModalOption = (label, isSelected, onPress) => (
    <TouchableOpacity style={styles.modalOption} onPress={onPress}>
      <MaterialCommunityIcons 
        name={isSelected ? "radiobox-marked" : "radiobox-blank"} 
        size={24} 
        color={isSelected ? "#8ab4f8" : "#888"} 
      />
      <Text style={styles.modalOptionText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1E222D" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search results</Text>
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="share-social-outline" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialCommunityIcons name="dots-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        <TouchableOpacity style={styles.filterChip} onPress={() => setShowDateModal(true)}>
          <Text style={styles.filterText}>All Dates</Text>
          <Ionicons name="caret-down" size={12} color="#aaa" style={{marginLeft: 5}}/>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterChip} onPress={() => setShowClassModal(true)}>
          <Text style={styles.filterText}>FC - First Class</Text>
          <Ionicons name="caret-down" size={12} color="#aaa" style={{marginLeft: 5}}/>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterChip} onPress={() => setShowSortModal(true)}>
          <Text style={styles.filterText}>Sort by</Text>
          <Ionicons name="caret-down" size={12} color="#aaa" style={{marginLeft: 5}}/>
        </TouchableOpacity>
      </View>

      {/* Route Info */}
      <View style={styles.routeHeader}>
        <Text style={styles.routeText} numberOfLines={1}>
          <Text style={{fontWeight: 'bold'}}>{fromStation}</Text> - {fromStationName}
        </Text>
        <Ionicons name="arrow-forward" size={16} color="#aaa" style={{marginHorizontal: 10}} />
        <Text style={styles.routeText} numberOfLines={1}>
          <Text style={{fontWeight: 'bold'}}>{toStation}</Text> - {toStationName}
        </Text>
      </View>

      {/* Train List */}
      {loading ? (
        <ActivityIndicator size="large" color="#8ab4f8" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={trains}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderTrain}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListFooterComponent={
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>Cannot find the train you are looking for?</Text>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Report missing train</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Check Seat Availability Bottom Tab */}
      <TouchableOpacity style={styles.bottomTab}>
        <Text style={styles.bottomTabText}>Check seat availability</Text>
        <Ionicons name="chevron-forward" size={20} color="#8ab4f8" />
      </TouchableOpacity>

      {/* Sort Modal */}
      <Modal visible={showSortModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort by</Text>
            </View>
            {renderModalOption('Departure time', true, () => setShowSortModal(false))}
            {renderModalOption('Duration', false, () => setShowSortModal(false))}
            {renderModalOption('Arrival Time', false, () => setShowSortModal(false))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowSortModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Class Modal */}
      <Modal visible={showClassModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose fare class</Text>
            </View>
            {renderModalOption('GN - Unreserved', false, () => setShowClassModal(false))}
            {renderModalOption('SL - Sleeper', false, () => setShowClassModal(false))}
            {renderModalOption('3A - AC 3-Tier', false, () => setShowClassModal(false))}
            {renderModalOption('FC - First Class', true, () => setShowClassModal(false))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowClassModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Date Modal */}
      <Modal visible={showDateModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose the date</Text>
            </View>
            {renderModalOption('All Dates', true, () => setShowDateModal(false))}
            {renderModalOption('Today', false, () => setShowDateModal(false))}
            {renderModalOption('Tomorrow', false, () => setShowDateModal(false))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDateModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0E1116',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 15,
    backgroundColor: '#1E222D',
  },
  iconButton: {
    padding: 5,
    marginHorizontal: 5,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    color: '#fff',
    marginLeft: 10,
  },
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#1E222D',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
  },
  filterText: {
    color: '#aaa',
    fontSize: 13,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#161922',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  routeText: {
    color: '#aaa',
    fontSize: 14,
    flex: 1,
  },
  trainCard: {
    backgroundColor: '#1E222D',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2E39',
  },
  trainHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  trainNumber: {
    backgroundColor: 'rgba(138, 180, 248, 0.2)',
    color: '#8ab4f8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 10,
  },
  trainTime: {
    color: '#ccc',
    fontSize: 16,
    fontWeight: '500',
  },
  trainDuration: {
    color: '#777',
    fontSize: 12,
    marginHorizontal: 10,
    flex: 1,
    textAlign: 'center',
  },
  trainPrice: {
    color: '#aaa',
    fontSize: 16,
    marginLeft: 10,
  },
  trainSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trainName: {
    color: '#aaa',
    fontSize: 14,
    flex: 1,
  },
  daysRow: {
    flexDirection: 'row',
  },
  dayText: {
    fontSize: 12,
    marginLeft: 3,
  },
  dayActive: {
    color: '#8ab4f8',
    fontWeight: 'bold',
  },
  dayInactive: {
    color: '#555',
  },
  platformRow: {
    marginTop: 8,
  },
  platformText: {
    color: '#8ab4f8',
    fontSize: 12,
    fontWeight: 'bold',
  },
  notRunningText: {
    color: '#d93025',
    fontSize: 12,
    marginTop: 8,
  },
  footerContainer: {
    alignItems: 'center',
    padding: 30,
  },
  footerText: {
    color: '#aaa',
    fontSize: 14,
  },
  footerLink: {
    color: '#8ab4f8',
    fontSize: 14,
    marginTop: 5,
  },
  bottomTab: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#161922',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  bottomTabText: {
    color: '#8ab4f8',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#232731',
    width: '85%',
    borderRadius: 8,
    paddingBottom: 10,
  },
  modalHeader: {
    backgroundColor: '#2A2E39',
    padding: 20,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginBottom: 10,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  modalOptionText: {
    color: '#eee',
    fontSize: 16,
    marginLeft: 15,
  },
  modalCancel: {
    marginTop: 10,
    padding: 15,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#eee',
    fontSize: 16,
  }
});
