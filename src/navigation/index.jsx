import * as React from "react";
import { View, Text } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";
import CoinDetailScreen from "../screens/CoinDetailScreen";
import BottomTabNavigator from "./bottomNavigator";
import AddNewAssetScreen from "../screens/AddNewAssetScreen";
import AddNewTransactionScreen from "../screens/AddNewTransactionScreen";
import LogInScreen from "../screens/LoginScreen/components/LogIn";
import CoinHoldingsScreen from "../screens/CoinHoldingsScreen";
import CoinInsightsScreen from "../screens/CoinInsightsScreen";
import EditTransactionPage from "../screens/EditTransactionScreen";
import WebViewScreen from "../screens/WebViewScreen";
// import NewsScreen from "../screens/NewsScreen";
import FinanceScreen from "../screens/NewsScreen/SubScreens/Finacials";
import WatchListScreen from "../screens/WarchListScreen";
import Timeline from "../screens/CoinHoldingsScreen/components/SellStratScreen";
import AddNewStep from "../screens/CoinHoldingsScreen/components/SellStratScreen/components/AddStepScreen";
import ImportantAlerts from "../screens/NewsScreen/SubScreens/ImportantAlerts";
import EconomicCalender from "../screens/NewsScreen/SubScreens/Finacials/EconomicCalender";
import Subscriptions from "../screens/AccountScreen/Screens/Subscriptions";
import ChatScreen from "../screens/NewsScreen/components/ChatBot";
import NotificationPage from "../screens/AccountScreen/Screens/Notifications";
import ManageSubscriptionsScreen from "../screens/AccountScreen/Screens/ManageSubscriptions";
import AccountScreen from "../screens/AccountScreen";

const Stack = createStackNavigator();

const Navigation = () => {
  return (
    <Stack.Navigator
      initialRouteName="Root"
      //screenOptions={{ headerShown: false }}
    >
      <Stack.Screen
        name={"Root"}
        component={BottomTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"EditTransactionScreen"}
        component={EditTransactionPage}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"CoinDetailScreen"}
        component={CoinDetailScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"CoinHoldingsScreen"}
        component={CoinHoldingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"CoinInsightsScreen"}
        component={CoinInsightsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"WebViewScreen"}
        component={WebViewScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"ImportantAlerts"}
        component={ImportantAlerts}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"EconomicCalender"}
        component={EconomicCalender}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"Notifications"}
        component={NotificationPage}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"ChatScreen"}
        component={ChatScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"WatchListScreen"}
        component={WatchListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"SellStratScreen"}
        component={Timeline}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"AddNewStep"}
        component={AddNewStep}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"Subscriptions"}
        component={Subscriptions}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"Account"}
        component={AccountScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"ManageSubscriptions"}
        component={ManageSubscriptionsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"AddNewAssetScreen"}
        component={AddNewAssetScreen}
        options={{
          title: "Add New Asset",
          headerStyle: { backgroundColor: "#121212" },
          headerTintColor: "white",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      />
      <Stack.Screen
        name={"AddNewTransactionScreen"}
        component={AddNewTransactionScreen}
        options={{
          title: "Add Transaction Asset",
          headerStyle: { backgroundColor: "#121212" },
          headerTintColor: "white",
          headerTitleStyle: {
            fontWeight: "bold",
          },
        }}
      />
    </Stack.Navigator>
  );
};

export default Navigation;
