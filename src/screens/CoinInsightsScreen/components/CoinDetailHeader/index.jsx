import { View, Text, Image } from "react-native";
import { Ionicons, AntDesign } from "@expo/vector-icons";
import styles from "./styles";
import React, { useContext } from "react";
import { useNavigation } from "@react-navigation/native";
import { useWatchlist } from "../../../../contexts/watchlistContect";

const CoinDetailHeader = (props) => {
  const { coinID, image, symbol, marketCapRank } = props;
  const navigation = useNavigation();
  const { watchlistCoinIDs, storeWatchlistCoinID, removeWatchListCoinID } =
    useWatchlist();

  const checkIfCoinIsWatchListed = () => {
    return watchlistCoinIDs.some((coinIDValue) => coinIDValue === coinID);
  };

  console.log(checkIfCoinIsWatchListed());

  const handleWatchListCoin = () => {
    if (checkIfCoinIsWatchListed()) {
      console.log("removed");
      return removeWatchListCoinID(coinID);
    }
    console.log("stored");
    return storeWatchlistCoinID(coinID);
  };

  return (
    <View style={styles.headerContainer}>
      <Ionicons
        name="chevron-back-sharp"
        size={29}
        color="white"
        // onPress={() => navigation.goBack()}
        onPress={() => navigation.navigate('Home')}
      />
      <View style={styles.tickerContainer}>
        <Image source={{ uri: image }} style={{ width: 30, height: 30 }} />
        {console.log("The symbol is: " + symbol)}
        <Text style={styles.tickerTitle}>{symbol.toUpperCase()}</Text>
        <Text style={styles.rank}>#{marketCapRank}</Text>
      </View>
      <AntDesign
        name={checkIfCoinIsWatchListed() ? "star" : "staro"}
        size={24}
        color={checkIfCoinIsWatchListed() ? "#FFBF00" : "white"}
        style={{ marginRight: 10 }}
        onPress={handleWatchListCoin}
      />
    </View>
  );
};

export default CoinDetailHeader;
