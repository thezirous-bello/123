import React, { Suspense } from "react";
import { View, Text, FlatList } from "react-native";
import PortfolioAssetsList from "./Components/PortfolioAssetsList";

const PortfolioScreen = () => {
  return (
    <View style={{ flex: 1 }}>
      <Suspense fallback={<Text style={{ color: "white" }}>Loading...</Text>}>
        <PortfolioAssetsList />
      </Suspense>
    </View>
  );
};

export default PortfolioScreen;
