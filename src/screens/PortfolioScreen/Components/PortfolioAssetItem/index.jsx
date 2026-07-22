import React from "react";
import { View, Text, Image, Pressable } from "react-native";
import Styles from "./styles";
import { AntDesign } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

const PortfolioAssetsItem = ({ assetsItem }) => {
  const navigation = useNavigation();
  //Binance Price stuff
  const {
    coinID,
    currentPrice,
    image,
    name,
    totalSpent,
    priceChangePercentage,
    totalQuantityBought,
    ticker,
  } = assetsItem.item;
  const listDataLength = assetsItem.listDataLength;
  const index = assetsItem.index;
  const price_change_percentage_24h = priceChangePercentage;
  const usd = 20000;

  const percentageColor =
    // price_change_percentage_24h < 0 ? "#ea3943" : "#16c784" || "white";
    price_change_percentage_24h < 0 ? "#8930D5" : "#16c784" || "white";
  const caretupOrDown =
    price_change_percentage_24h < 0
      ? "caretdown"
      : "caretup" || "exclamationcircle";

  //const renderHoldings = ()=> (totalQuantityBought * currentPrice).toFixed(2);

  return (
    totalQuantityBought > 0 ?
    <Pressable
      style={[
        Styles.coinContainer,
        {
          borderTopLeftRadius: index === 0 ? 14 : 0, // Set border radius for the first item
          borderTopRightRadius: index === 0 ? 14 : 0, // Set border radius for the first item
          borderBottomLeftRadius: index === listDataLength - 1 ? 10 : 0,
          borderBottomRightRadius: index === listDataLength - 1 ? 10 : 0,
        },
      ]}
      onPress={() =>
        navigation.navigate("CoinDetailScreen", {
          coinID: coinID,
          symbolz: ticker,
          market_cap: 0,
        })
      }
    >
      <Image
        source={{ uri: image }}
        height={30}
        width={30}
        style={{ marginRight: 10, alignSelf: "center" }}
      />
      <View>
        <Text style={Styles.title}>
          {name.length > 10 ? name.substring(0, 10) + "..." : name}
        </Text>
        <Text style={Styles.ticker}>{ticker.toUpperCase()}</Text>
      </View>
      <View style={{ marginLeft: "auto" }}>
        <Text style={Styles.title}>
          $
          {currentPrice > 1
            ? currentPrice.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
            : currentPrice.toFixed(5).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1")}
        </Text>
        <View style={Styles.priceChangePercentageContainer}>
          <AntDesign
            name={caretupOrDown}
            size={12}
            color={percentageColor}
            style={{ alignSelf: "center", marginRight: 5 }}
          />
          <Text style={{ color: percentageColor, fontWeight: "700" }}>
            {price_change_percentage_24h ? price_change_percentage_24h.toFixed(2) + '%' : "NaN"}
          </Text>
        </View>
      </View>
      <View style={Styles.QuantityContainer}>
        <Text style={Styles.title}>
          $
          {currentPrice * totalQuantityBought > 1
            ? (currentPrice * totalQuantityBought)
                .toFixed(2)
                .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
            : (currentPrice * totalQuantityBought)
                .toFixed(5)
                .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1")}
        </Text>
        <Text style={Styles.ticker}>
          {totalQuantityBought} {ticker.toUpperCase()}
        </Text>
      </View>
    </Pressable>
    : <></>
  );
};

export default PortfolioAssetsItem;
