import * as React from 'react';
import { Button, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import StatsScreen from '../screens/StatsScreen/SubScreens/LongTerm';
import ShortTerm from '../screens/StatsScreen/SubScreens/ShortTerm';
import DayTrades from '../screens/StatsScreen/SubScreens/DayTrades';
import SwingTrades from '../screens/StatsScreen/SubScreens/SwingTrades';
import AIInsights from '../screens/StatsScreen/SubScreens/AIInsights';

const StatsNav = createStackNavigator();

const StatsStackScreen = () => {

    return (
        <StatsNav.Navigator>
          {/* <StatsNav.Screen name="LongTradeSceen" component={StatsScreen} options={{ headerShown: false }}/> */}
          {/* <StatsNav.Screen name="ShortTermScreen" component={ShortTerm} options={{ headerShown: false }}/> */}
          <StatsNav.Screen name="DayTradingScreen" component={DayTrades} options={{ headerShown: false }}/>
          {/* <StatsNav.Screen name="SwingTradingScreen" component={SwingTrades} options={{ headerShown: false }}/> */}
          <StatsNav.Screen name="AIInsights" component={AIInsights} options={{ headerShown: false }}/>
        </StatsNav.Navigator>
      );

}

export default StatsStackScreen;