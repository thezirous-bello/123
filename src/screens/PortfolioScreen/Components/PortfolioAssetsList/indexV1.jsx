import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import styles from "./styles";
import PortfolioAssetsItem from "../PortfolioAssetItem";
import { useNavigation } from "@react-navigation/native";
import { useRecoilValue, useRecoilState } from "recoil";
import auth from '@react-native-firebase/auth';
import { getTransactions } from "../../../../services/requests";
import {
  allPortfolioAssets,
  allPortfolioBoughtAssetsInStorage,
} from "../../../../atoms/PortfolioAssets";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { SwipeListView, SwipeRow } from "react-native-swipe-list-view";

const PortfolioAssetsList = () => {
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 

  const getAssets = async () => {
    try {
      const getAllTransactions = await getTransactions(isLoggedIn, id);
      console.log(getAllTransactions);
    } catch (error) {
      console.error("Error fetching assets:", error);
    }
  };

  useEffect(() => {
    getAssets();
  }, [isLoggedIn, id]);

  //console.log(useQuery(Transactions));
  const navigation = useNavigation();

  const assets = useRecoilValue(allPortfolioAssets);
  const [storageAssets, setStorageAssets] = useRecoilState(
    allPortfolioBoughtAssetsInStorage
  );

  const price_change_percentage_24h = 0;
  const usd = 20000;

  const getCurrentBalnce = () =>
    assets.reduce(
      (total, currentAsset) =>
        total + currentAsset.currentPrice * currentAsset.quantityBought,
      0
    );

  const getCurrentValueChange = () => {
    const currentBalance = getCurrentBalnce();
    const boughtBalance = assets.reduce(
      (total, currentAsset) =>
        total + currentAsset.priceBought * currentAsset.quantityBought,
      0
    );

    return (currentBalance - boughtBalance).toFixed(2);
  };

  const getCurrentPercentageChange = () => {
    const currentBalance = getCurrentBalnce();
    const boughtBalance = assets.reduce(
      (total, currentAsset) =>
        total + currentAsset.priceBought * currentAsset.quantityBought,
      0
    );
    return (
      (((currentBalance - boughtBalance) / boughtBalance) * 100).toFixed(3) || 0
    );
  };

  const percentageColor =
    getCurrentValueChange() < 0 ? "#ea3943" : "#16c784" || "white";
  const caretupOrDown =
    getCurrentValueChange() < 0
      ? "caretdown"
      : "caretup" || "exclamationcircle";

  const onDeleteAsset = async (asset) => {
    const newAsset = storageAssets.filter(
      // (coin, index) => coin.id !== asset.item.id
      (coin, index) => index !== asset.index
    );
    const JsonValue = JSON.stringify(newAsset);
    await AsyncStorage.setItem("@portfolio_coins", JsonValue);
    setStorageAssets(newAsset);
  };

  const renderDeleteButton = (data) => {
    return (
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "#ea3943",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingRight: 25,
          marginLeft: 20,
        }}
        onPress={() => onDeleteAsset(data)}
      >
        <Feather name="trash-2" size={24} color="white" />
      </Pressable>
    );
  };

  return (
    <SwipeListView
      data={assets}
      renderItem={(item) => (
        //<SwipeRow closeOnRowPress={true} closeOnRowBeginSwipe={true}>
        <PortfolioAssetsItem assetsItem={item} />
        //</SwipeRow>
      )}
      keyExtractor={({ id }, index) => `${id}${index}`}
      renderHiddenItem={(data) => renderDeleteButton(data)}
      disableRightSwipe={true}
      rightOpenValue={-75}
      ListHeaderComponent={
        <>
          <View style={styles.balanceContainer}>
            <View>
              <Text style={styles.currentBalance}>Current Balance: </Text>
              <Text style={styles.currentBalanceValue}>
                $
                {getCurrentBalnce()
                  .toFixed(2)
                  .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")}
              </Text>
              <Text style={[styles.valueChange, { color: percentageColor }]}>
                $&nbsp;{getCurrentValueChange()} (All Time)
              </Text>
            </View>
            <View
              style={[
                styles.priceChangePercentageContainer,
                { backgroundColor: percentageColor },
              ]}
            >
              <AntDesign
                name={caretupOrDown}
                size={12}
                color={"white"}
                style={{ alignSelf: "center", marginRight: 5 }}
              />
              <Text style={styles.percentageChange}>
                {getCurrentPercentageChange()}%
              </Text>
            </View>
          </View>
          <View style={{ paddingVertical: 20, paddingHorizontal: 15 }}>
            <Text style={styles.AssetsLabel}>Your Assets</Text>
          </View>
        </>
      }
      ListFooterComponent={
        <Pressable
          style={styles.buttonContainer}
          // onPress={() => navigation.navigate("AddNewAssetScreen")}
          onPress={() => navigation.navigate("AddNewTransactionScreen")}
        >
          <Text style={styles.buttonText}> Add new asset</Text>
        </Pressable>
      }
    />
  );
};
export default PortfolioAssetsList;
