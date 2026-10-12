import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';

const API_URL = 'http://10.0.2.2:5000/api/trains'; // Use 10.0.2.2 for Android Emulator to connect to localhost

export default function HomeScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchTrain = async () => {
    if (!searchQuery) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/search?query=${searchQuery}`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error(error);
      alert('Failed to fetch train data. Make sure backend is running.');
    }
    setLoading(false);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('TrainDetails', { train: item })}
    >
      <Text style={styles.trainNumber}>{item.trainNumber} - {item.trainName}</Text>
      <Text style={styles.trainRoute}>Route: {item.stations[0]} to {item.stations[item.stations.length - 1]}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>RailSafe Alert</Text>
      <Text style={styles.subtitle}>Smart Destination Alarm</Text>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter Train Number or Name"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#888"
        />
        <TouchableOpacity style={styles.button} onPress={searchTrain}>
          <Text style={styles.buttonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#007bff" style={styles.loader} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.trainNumber}
          renderItem={renderItem}
          ListEmptyComponent={
            searchQuery ? <Text style={styles.emptyText}>No trains found. Try 'Rajdhani'.</Text> : null
          }
        />
      )}
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 40,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    height: 50,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginLeft: 10,
    paddingHorizontal: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loader: {
    marginTop: 50,
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  },
  trainNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  trainRoute: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  emptyText: {
    textAlign: 'center',
    color: '#888',
    marginTop: 40,
    fontSize: 16,
  }
});
