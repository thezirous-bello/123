import React from "react";
import { StyleSheet, Text, View, Image, Pressable } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
//import styles from "./styles";

const CointItem = ({ marketCoin }) => {
  const {
    id,
    name,
    current_price,
    market_cap,
    market_cap_rank,
    symbol,
    price_change_percentage_24h,
    image,
  } = marketCoin;

  const navigation = useNavigation();

  const percentageColor =
    price_change_percentage_24h < 0 ? "#FF5555" : "#16c784" || "WHITE";
  // price_change_percentage_24h < 0 ? "#ea3943" : "#16c784" || "WHITE";
  const caretupOrDown =
    price_change_percentage_24h < 0
      ? "caretdown"
      : "caretup" || "exclamationcircle";

  const normalizeMarketCap = (marketCap) => {
    if (marketCap > 1_000_000_000_000) {
      return `${Math.floor(marketCap / 1_000_000_000_000)} T`;
    } else if (marketCap > 1_000_000_000) {
      return `${Math.floor(marketCap / 1_000_000_000)} B`;
    } else if (marketCap > 1_000_000) {
      return `${Math.floor(marketCap / 1_000_000)} M`;
    } else if (marketCap > 1_000) {
      return `${Math.floor(marketCap / 1_000)} K`;
    } else {
      return `${Math.floor(marketCap / 1_000)} H`;
    }

    return marketCap;
  };

  return (
    <Pressable
      style={styles.coinContainer}
      onPress={() =>
        navigation.navigate("CoinDetailScreen", {
          coinID: id,
          symbolz: symbol,
          market_cap: market_cap,
        })
      }
    >
      <Image
        source={{
          uri: image,
        }}
        style={{
          height: 36,
          width: 36,
          marginRight: 10,
          alignSelf: "center",
        }}
      />
      <View>
        <Text style={styles.textUpperCase}>{symbol}</Text>
        <View style={{ flexDirection: "row" }}>
          <Text style={styles.title}>{name}</Text>
          {/* <AntDesign
            name={caretupOrDown}
            size={12}
            color={percentageColor}
            style={{ alignSelf: "center", marginRight: 5 }}
          />
          <Text style={{ color: percentageColor }}>
            {price_change_percentage_24h?.toFixed(2)} %
          </Text> */}
        </View>
      </View>
      <View style={{ marginLeft: "auto", alignItems: "flex-end" }}>
        <Text style={styles.textUpperCase}>
          $
          {current_price > 1
            ? current_price.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
            : current_price.toFixed(5).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1")}
        </Text>
        <View style={{ flexDirection: "row" }}>
          <AntDesign
            name={caretupOrDown}
            size={12}
            color={percentageColor}
            style={{ alignSelf: "center", marginRight: 5 }}
          />
          <Text style={{ color: percentageColor }}>
            {price_change_percentage_24h?.toFixed(2)} %
          </Text>
        </View>
        <Text style={styles.mCap}>Mcap {normalizeMarketCap(market_cap)}</Text>
      </View>
    </Pressable>
  );
};

export default CointItem;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#222222",
    paddingTop: 40,
    padding: 10,
  },
  coinContainer: {
    backgroundColor: "#181818",
    flexDirection: "row",
    alignSelf: "baseline",
    borderBottomWidth: 0.5,
    padding: 15,
    borderBottomColor: "#282828",
    width: "100%",
  },

  title: {
    color: "white",
    fontSize: 16,
    marginBottom: 3,
  },
  text: {
    color: "white",
    fontSize: 14,
    marginRight: 5,
  },
  mCap: {
    color: "white",
    fontSize: 14,
  },
  textUpperCase: {
    color: "white",
    fontSize: 20,
    marginRight: 5,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  rank: {
    fontWeight: "bold",
    color: "white",
    fontSize: 12,
    marginRight: 5,
    backgroundColor: "#8930D5",
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 5,
    paddingRight: 5,
    borderRadius: 5,
  },
});
