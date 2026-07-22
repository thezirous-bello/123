import React, { useEffect, useState } from "react";
import CoinItem from "../../components/Coinitem";
import { FlatList, RefreshControl, View, Text } from "react-native";
import cryptoCurrencies from "../../../assets/data/cryptocurrencies.json";
import {
  getMarketData,
  getMarketDataFromMongoDB,
} from "../../services/requests";

const HomeScreen = () => {
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchCoins = async (pageNumber) => {
    if (loading) {
      return;
    }
    setLoading(true);
    const amountToSKip = pageNumber === 0 ? 0 : pageNumber;
    console.log(amountToSKip);
    const coinData = (await getMarketData(pageNumber)) || undefined;

    if (coinData === undefined) {
      console.log("Running our api");
      const coinDataFromMongo = await getMarketDataFromMongoDB(amountToSKip);
      setCoins((existingCoins) => [...existingCoins, ...coinDataFromMongo]);
    } else {
      setCoins((existingCoins) => [...existingCoins, ...coinData]);
    }

    /*if ((coinData = undefined)) {
      setLoading(false);
      setCoins([]);
      console.log("Returned Undefined");
      return;
    }*/

    //const uniq = [...new Set(coins)];
    //setCoins(uniq);
    setLoading(false);
  };

  const refetchCoins = async () => {
    if (loading) {
      return;
    }
    setLoading(true);

    const coinData =
      (await getMarketData()) || (await getMarketDataFromMongoDB());
    setCoins(coinData);
    setLoading(false);
  };

  useEffect(() => {
    fetchCoins();
  }, []);

  return (
    <View>
      <Text
        style={{
          color: "white",
          fontSize: 25,
          letterSpacing: 1,
          paddingHorizontal: 20,
          fontFamily: "Poppins_700Bold",
        }}
      >
        Crypto Assets
      </Text>
      <FlatList
        data={coins}
        onEndReached={() => fetchCoins(coins.length / 50 + 1)}
        renderItem={({ item }) => <CoinItem marketCoin={item} />}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            tintColor="white"
            onRefresh={refetchCoins}
          />
        }
      />
    </View>
  );
};

export default HomeScreen;
