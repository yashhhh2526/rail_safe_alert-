import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './src/screens/HomeScreen';
import TrainDetailsScreen from './src/screens/TrainDetailsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#007bff',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ title: 'RailSafe Alert' }} 
        />
        <Stack.Screen 
          name="TrainDetails" 
          component={TrainDetailsScreen} 
          options={{ title: 'Train Status & Alarm' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
