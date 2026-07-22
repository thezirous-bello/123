import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import SearchableDropDown from "react-native-searchable-dropdown";
import styles from "./styles";
import { useRecoilState } from "recoil";
import { allPortfolioBoughtAssetsInStorage } from "../../atoms/PortfolioAssets";
import { getAllCoins, getDetailedCoinData } from "../../services/requests";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";

const AddNewAssetScreen = () => {
  const [allCoins, setAllCoins] = useState([]);
  const [selectCoinID, setSelectCoinID] = useState(null);
  const [selectedCoins, setSelectedCoins] = useState(null);
  const [loading, setLoading] = useState(false);
  const [boughAssetQTY, setBoughAssetQTY] = useState("");
  const [assetsInStorage, setAssetsInStorage] = useRecoilState(
    allPortfolioBoughtAssetsInStorage
  );

  const navigation = useNavigation();

  const isQTYEntered = () => boughAssetQTY !== "";

  const fetchAllCoins = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    const allCoins = await getAllCoins();
    setAllCoins(allCoins);
    setLoading(false);
  };

  const fetchCoinInfo = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    const CoinInfo = await getDetailedCoinData(selectCoinID);
    setSelectedCoins(CoinInfo);
    setLoading(false);
  };

  useEffect(() => {
    fetchAllCoins();
  }, []);

  useEffect(() => {
    if (selectCoinID) {
      fetchCoinInfo();
    }
  }, [selectCoinID]);

  const onAddNewAsset = async () => {
    const newAsset = {
      id: selectedCoins.id,
      name: selectedCoins.name,
      image: selectedCoins.image.small,
      ticker: selectedCoins.symbol,
      quantityBought: parseFloat(boughAssetQTY),
      priceBought: selectedCoins.market_data.current_price.usd,
    };

    const newAssets = [...assetsInStorage, newAsset];
    const jsonValue = JSON.stringify(newAsset);
    await AsyncStorage.setItem("@portfolio_coins", jsonValue);
    setAssetsInStorage(newAssets);
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1 }}>
      <SearchableDropDown
        items={allCoins}
        containerStyle={styles.dropdownContainer}
        itemStyle={styles.itemStyle}
        onItemSelect={(item) => setSelectCoinID(item.id)}
        itemTextStyle={{
          color: "white",
        }}
        resetValue={false}
        placeholder={selectCoinID || "Select a coin..."}
        placeholderTextColor="white"
        textInputProps={{
          underlineColorAndroid: "transparent",
          style: styles.textInputProps,
        }}
      />
      {selectCoinID && (
        <>
          {selectedCoins && (
            <>
              <View style={styles.boughtQTYContainer}>
                <View style={{ flexDirection: "row" }}>
                  <TextInput
                    value={boughAssetQTY}
                    placeholder="0"
                    placeholderTextColor="#1f1f1f"
                    keyboardType="numeric"
                    onChangeText={setBoughAssetQTY}
                    style={{
                      color: "white",
                      fontSize: 90,
                    }}
                  />
                  {selectedCoins.symbol && (
                    <Text style={styles.ticker}>
                      {selectedCoins.symbol.toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.pricePerCoin}>
                  $
                  {selectedCoins.market_data.current_price.usd > 1
                    ? selectedCoins.market_data.current_price.usd
                        .toFixed(2)
                        .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
                    : selectedCoins.market_data.current_price.usd
                        .toFixed(5)
                        .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1")}{" "}
                  per coin
                </Text>
              </View>
              <Pressable
                style={{
                  ...styles.buttonContainer,
                  backgroundColor: isQTYEntered() ? "#4169e1" : "#303030",
                }}
                onPress={onAddNewAsset}
                disabled={boughAssetQTY === ""}
              >
                <Text
                  style={{
                    ...styles.buttonText,
                    color: isQTYEntered() ? "white" : "grey",
                  }}
                >
                  {" "}
                  Add new asset
                </Text>
              </Pressable>
            </>
          )}
        </>
      )}
    </View>
  );
};

export default AddNewAssetScreen;
