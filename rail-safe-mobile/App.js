import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from './screens/HomeScreen';
import TrainDetailsScreen from './screens/TrainDetailsScreen';
import ActiveAlarmScreen from './screens/ActiveAlarmScreen';
import TrainListScreen from './screens/TrainListScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Home"
        screenOptions={{
          headerStyle: { backgroundColor: '#0f2027' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#0f2027' }
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TrainList" component={TrainListScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TrainDetails" component={TrainDetailsScreen} options={{ title: 'Train Details' }} />
        <Stack.Screen name="ActiveAlarm" component={ActiveAlarmScreen} options={{ title: 'Live Tracking', headerShown: false }} />
      </Stack.Navigator>

    </NavigationContainer>
  );
}
