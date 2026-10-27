// App.js — five tabs; Brainstorm sits center and raised, and is its own
// small stack (a landing screen, then a dedicated full-screen typer).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer } from '@react-navigation/native';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from './screens/HomeScreen';
import EventsScreen from './screens/EventsScreen';
import SalonsScreen from './screens/SalonsScreen';
import BrainstormHomeScreen from './screens/BrainstormHomeScreen';
import BrainstormWriterScreen from './screens/BrainstormWriterScreen';
import MyWritingScreen from './screens/MyWritingScreen';
import DayScreen from './screens/DayScreen';
import MedalsScreen from './screens/MedalsScreen';
import MedalDetailScreen from './screens/MedalDetailScreen';
import CommunitiesScreen from './screens/CommunitiesScreen';
import { colors, gradients } from './theme';

const Tabs = createMaterialTopTabNavigator();
const BrainstormStackNav = createNativeStackNavigator();

const ICONS = {
  Home: 'book',
  Events: 'calendar',
  Salons: 'play-circle',
  Communities: 'chatbubbles',
};

function BrainstormStack() {
  return (
    <BrainstormStackNav.Navigator screenOptions={{ headerShown: false }}>
      <BrainstormStackNav.Screen name="BrainstormHome" component={BrainstormHomeScreen} />
      <BrainstormStackNav.Screen name="BrainstormWriter" component={BrainstormWriterScreen} />
      <BrainstormStackNav.Screen name="MyWriting" component={MyWritingScreen} />
      <BrainstormStackNav.Screen name="BrainstormDay" component={DayScreen} />
      <BrainstormStackNav.Screen name="Medals" component={MedalsScreen} />
      <BrainstormStackNav.Screen name="MedalDetail" component={MedalDetailScreen} />
    </BrainstormStackNav.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tabs.Navigator
      tabBarPosition="bottom"
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        swipeEnabled: true,
        tabBarShowIcon: true,
        tabBarActiveTintColor: colors.royalDeep,
        tabBarInactiveTintColor: colors.tabIdle,
        tabBarPressColor: 'rgba(27,63,160,0.08)',
        tabBarIcon: ({ color, focused }) => {
          if (route.name === 'Brainstorm') {
            return (
              <LinearGradient colors={gradients.button} style={s.centerIcon}>
                <Ionicons name="pencil" size={22} color="#fff" />
              </LinearGradient>
            );
          }
          return <Ionicons name={ICONS[route.name]} size={focused ? 23 : 21} color={color} />;
        },
        // Labels stay on one line: "Communities" used to break in two. On a very
        // narrow phone the text shrinks a little instead of wrapping.
        tabBarLabel: ({ color }) => (
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            maxFontSizeMultiplier={1.15}
            style={[s.tabLabel, { color }]}
          >
            {route.name}
          </Text>
        ),
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarStyle: { backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line, elevation: 0 },
        tabBarIndicatorStyle: {
          backgroundColor: colors.royalDeep, height: 3, borderRadius: 3, width: 26, marginLeft: '6%', top: 0,
        },
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Events" component={EventsScreen} />
      <Tabs.Screen name="Brainstorm" component={BrainstormStack} />
      <Tabs.Screen name="Salons" component={SalonsScreen} />
      <Tabs.Screen name="Communities" component={CommunitiesScreen} />
    </Tabs.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <View style={{ flex: 1 }}>
          <TabNavigator />
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  tabLabel: { fontSize: 10.5, fontWeight: '600', marginTop: 2, textAlign: 'center', width: '100%', paddingHorizontal: 1 },
  centerIcon: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -18,
    borderWidth: 3, borderColor: colors.paper,
    shadowColor: colors.royalDeep, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 6,
  },
});