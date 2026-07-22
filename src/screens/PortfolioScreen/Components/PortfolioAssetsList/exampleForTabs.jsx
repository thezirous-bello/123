import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SwipeListView } from "react-native-swipe-list-view";
import { TabView, SceneMap, TabBar } from "react-native-tab-view";

const AssetsList = () => (
  <SwipeListView
    // ... assets list configuration
    renderHiddenItem={(data) => renderDeleteButton(data)}
  />
);

const TransactionsList = () => (
  <SwipeListView
    // ... transactions list configuration
    renderHiddenItem={(data) => renderDeleteButton(data)}
  />
);

const renderTabBar = (props) => (
  <TabBar
    {...props}
    indicatorStyle={{ backgroundColor: "blue" }}
    style={{ backgroundColor: "white" }}
    labelStyle={{ color: "black" }}
  />
);

const TabViewExample = () => {
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: "assets", title: "Assets" },
    { key: "transactions", title: "Transactions" },
  ]);

  const renderScene = SceneMap({
    assets: AssetsList,
    transactions: TransactionsList,
  });

  return (
    <TabView
      navigationState={{ index, routes }}
      renderScene={renderScene}
      onIndexChange={setIndex}
      initialLayout={{ width: 100 }}
      renderTabBar={renderTabBar}
    />
  );
};

export default TabViewExample;
