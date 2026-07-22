import React, { useState, useEffect } from "react";
import { FlatList, RefreshControl, View, Text, ImageBackground, StyleSheet } from "react-native";
import { useWatchlist } from "../../contexts/watchlistContect";
import CoinItem from "../../components/Coinitem";
import { getWatchlistedCoins } from "../../services/requests";
import bg from "../../imgs/bgimg.png";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import Purchases from "react-native-purchases";
import { StatusBar } from 'react-native';

const getPurchaserInfo = async () => {
  try {
    const purchaserInfo = await Purchases.getCustomerInfo();
    console.log("Purchaser Info:", purchaserInfo);
    return purchaserInfo;
  } catch (e) {
    console.error("Error fetching purchaser info:", e);
  }
};


const WatchListScreen = () => {
  const { watchlistCoinIDs } = useWatchlist();

  const [coins, setCoin] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const transformCoinIDs = () => watchlistCoinIDs.join("%2C%20");

  const fetchWatchlistedCoins = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    const coinData = (await getWatchlistedCoins(1, transformCoinIDs())) || [];
    //setCoin([...coins, ...coinData]);
    setCoin(coinData);
    setLoading(false);
  };

  const refetchWatchlistedCoins = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    const coinData = (await getWatchlistedCoins(1, transformCoinIDs())) || [];
    setCoin(coinData);
    setLoading(false);
  };

  useEffect(() => {
    if (watchlistCoinIDs.length > 0) {
      fetchWatchlistedCoins();
    }
    console.log(getPurchaserInfo());
  }, []);
  useEffect(() => {
    refetchWatchlistedCoins();
  }, [watchlistCoinIDs]);

  return (
    <ImageBackground source={bg} style={{ padding: 30, flex: 1, paddingTop: 55 }}>
      <View style={styles.headerContainer}>
      <Ionicons
        name="chevron-back-sharp"
        size={29}
        color="white"
        style={{position: 'absolute', left: 0}}
        onPress={() => navigation.goBack()}
      />
      <Text
        style={{
          color: "white",
          fontSize: 25,
          letterSpacing: 1,
          paddingHorizontal: 20,
          fontFamily: "Poppins_700Bold",
          textAlign: 'center'
        }}
      >
        Favorites
      </Text>
    </View>
      <FlatList
        data={coins}
        renderItem={({ item }) => <CoinItem marketCoin={item} />}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            tintColor="white"
            onRefresh={refetchWatchlistedCoins}
          />
        }
      />
    </ImageBackground>
  );
};

export default WatchListScreen;

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'center'
  },
  tickerContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  tickerTitle: { 
    color: "white", 
    fontWeight: "bold", 
    marginHorizontal: 5,
  fontSize: 18},
  rank: {
    fontWeight: "bold",
    color: "white",
    fontSize: 16,
    marginRight: 5,
    backgroundColor: "#585858",
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 4,
    paddingRight: 4,
    borderRadius: 5
  }
});

