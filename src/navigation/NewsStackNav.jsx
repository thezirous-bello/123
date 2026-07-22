import * as React from 'react';
import { Button, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import NewsScreen from '../screens/NewsScreen';
import FinanceScreen from '../screens/NewsScreen/SubScreens/Finacials';
import AllNews from '../screens/NewsScreen/SubScreens/News';
import SentimentScreen from '../screens/NewsScreen/SubScreens/Sentiment';

const NewsStack = createStackNavigator();

const NewsStackScreen = () => {

    return (
        <NewsStack.Navigator>
          <NewsStack.Screen name="NewsScreen" component={NewsScreen} options={{ headerShown: false }}/>
          <NewsStack.Screen name="Finance" component={FinanceScreen} options={{ headerShown: false }}/>
          <NewsStack.Screen name="Sentiment" component={SentimentScreen} options={{ headerShown: false }}/>
          <NewsStack.Screen name="AllNews" component={AllNews} options={{ headerShown: false }}/>
        </NewsStack.Navigator>
      );

}

export default NewsStackScreen;