import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import styles from "./styles";
import PortfolioAssetsItem from "../PortfolioAssetItem";
import { useNavigation } from "@react-navigation/native";
import { useRecoilValue, useRecoilState } from "recoil";
import auth from '@react-native-firebase/auth';
import {
  getTransactions,
  getDataForAssetsInStorage,
} from "../../../../services/requests";
import {
  allPortfolioAssets,
  allPortfolioBoughtAssetsInStorage,
} from "../../../../atoms/PortfolioAssets";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { SwipeListView, SwipeRow } from "react-native-swipe-list-view";
import { useIsFocused } from "@react-navigation/native";

//The newest version, includes avg price bought
const groupTransactions = (transactions) => {
  const groupedTransactions = transactions.reduce((result, transaction) => {
    const key = transaction.coinID;

    if (!result[key]) {
      result[key] = {
        coinID: transaction.coinID,
        image: transaction.image,
        name: transaction.name,
        ticker: transaction.ticker,
        totalQuantityBought: 0,
        totalSpent: 0,
        averagePriceBought: 0,
      };
    }

    result[key].totalQuantityBought += transaction.quantityBought;
    result[key].totalSpent +=
      transaction.priceBought * transaction.quantityBought;

    // Calculate average bought price
    result[key].averagePriceBought =
      result[key].totalSpent / result[key].totalQuantityBought;

    return result;
  }, {});

  // Convert the grouped transactions object back to an array
  const groupedArray = Object.values(groupedTransactions);
  return groupedArray;
};

const PortfolioAssetsList = () => {
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 

  //console.log(useQuery(Transactions));
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [isLoading, setIsLoading] = useState(false);
  const assets = useRecoilValue(allPortfolioAssets);
  const [newassets, setnewAssets] = useState([]);
  const [groupedAssets, setGroupedAssets] = useState([]);
  const [groupedAssetsWithPrices, setGroupedAssetsWithPrices] = useState([]);
  const [storageAssets, setStorageAssets] = useRecoilState(
    allPortfolioBoughtAssetsInStorage
  );

  const getAssets = async () => {
    try {
      const getAllTransactions = await getTransactions(isLoggedIn, id);

      // console.log(typeof getAllTransactions.documents);
      // console.log(getAllTransactions.documents);
      setnewAssets(getAllTransactions.documents);
      setGroupedAssets(groupTransactions(getAllTransactions.documents));
      //console.log(newassets);
      //console.log(groupedAssets);
    } catch (error) {
      console.error("Error fetching assets:", error);
    }
  };

  const getPriceDataForAssetsInStorage = async () => {
    const results = await getDataForAssetsInStorage(groupedAssets);
    setGroupedAssetsWithPrices(results);
    //console.log(groupedAssetsWithPrices);
  };

  //For reloading or going back to page
  useEffect(() => {
    if (isFocused) {
      getAssets();
    }
  }, [isFocused]);

  //for first time pull
  // useEffect(() => {
  //   getAssets();
  // }, []);

  //To pull prices
  useEffect(() => {
    getPriceDataForAssetsInStorage();
  }, [groupedAssets]);

  const price_change_percentage_24h = 0;
  const usd = 20000;

  //NEW
  const calculateTotalCurrentBalance = (transactions) => {
    return transactions.reduce((totalBalance, transaction) => {
      const { totalQuantityBought, currentPrice } = transaction;

      // Calculate the current value of the holdings for the transaction
      const currentValue = totalQuantityBought * currentPrice;

      // Add the current value to the total balance
      totalBalance += currentValue;

      return totalBalance;
    }, 0);
  };

  //NEW
  const calculateAllTimeChange = (transactions) => {
    const allTimeChange = transactions.reduce(
      (total, { totalQuantityBought, currentPrice, totalSpent }) =>
        total + totalQuantityBought * currentPrice - totalSpent,
      0
    );

    return allTimeChange.toFixed(2);
  };

  //NEW
  const calculatePercentageChange = (transactions) => {
    let currentBalance = 0;
    let boughtBalance = 0;

    transactions.forEach((transaction) => {
      const { totalQuantityBought, currentPrice, totalSpent } = transaction;

      // Calculate the current value of the holdings for the transaction
      const currentValue = totalQuantityBought * currentPrice;

      // Add the current value to the current balance
      currentBalance += currentValue;

      // Add the total spent to the bought balance
      boughtBalance += totalSpent;
    });

    // Calculate the percentage change
    const percentageChange =
      ((currentBalance - boughtBalance) / boughtBalance) * 100;

    return percentageChange.toFixed(2);
  };

  const percentageColor =
    calculateAllTimeChange(groupedAssetsWithPrices) < 0
      ? "#8930D5"
      : "#16c784" || "white";
  const caretupOrDown =
    calculateAllTimeChange(groupedAssetsWithPrices) < 0
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

  return isLoading ? (
    <ActivityIndicator size={"large"} />
  ) : (
    <SwipeListView
      data={groupedAssetsWithPrices}
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
                {calculateTotalCurrentBalance(groupedAssetsWithPrices)
                  .toFixed(2)
                  .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")}
              </Text>
              <Text style={[styles.valueChange, { color: percentageColor }]}>
                $&nbsp;{calculateAllTimeChange(groupedAssetsWithPrices)} (All
                Time)
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
                {calculatePercentageChange(groupedAssetsWithPrices)}%
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
          <Text style={styles.buttonText}> Add Transaction</Text>
        </Pressable>
      }
    />
  );
};
export default PortfolioAssetsList;
