import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { AntDesign } from "@expo/vector-icons";
import styles from "./styles";
import PortfolioAssetsItem from "../PortfolioAssetItem";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useRecoilValue, useRecoilState } from "recoil";
import auth from '@react-native-firebase/auth';
import DonutPieChart from "../PieChart";
import bg from "../../../../imgs/bgimg.png";
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
import TransactionItem from "../TransactionItem";
import {
  GestureHandlerRootView,
  ScrollView,
} from "react-native-gesture-handler";
import LoadingFullScreen from "../../../../components/LoadingFullScreen";

const TransactionsList = () => (
  <SwipeListView
    // ... transactions list configuration
    renderHiddenItem={(data) => renderDeleteButton(data)}
  />
);

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

//Newest down
// function sortTransactionsByTimestamp(transactions) {
//   return transactions.sort((a, b) => {
//     const timestampA = new Date(a.timestamp).getTime();
//     const timestampB = new Date(b.timestamp).getTime();
//     return timestampA - timestampB;
//   });
// }

//Newest up
function sortTransactionsByTimestamp(transactions) {
  return transactions.sort((a, b) => {
    const timestampA = new Date(a.timestamp).getTime();
    const timestampB = new Date(b.timestamp).getTime();
    return timestampB - timestampA;
  });
}

const PortfolioAssetsList = () => {
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 

  //console.log(useQuery(Transactions));
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const [isLoading, setIsLoading] = useState(true);
  const assets = useRecoilValue(allPortfolioAssets);
  const [newassets, setnewAssets] = useState([]);
  const [groupedAssets, setGroupedAssets] = useState([]);
  const [groupedAssetsWithPrices, setGroupedAssetsWithPrices] = useState([]);
  const [listData, setListData] = useState(groupedAssetsWithPrices);
  const [listDataLength, setListDataLength] = useState(groupedAssetsWithPrices);
  const [whichTab, setTab] = useState("assets");

  const [storageAssets, setStorageAssets] = useRecoilState(
    allPortfolioBoughtAssetsInStorage
  );

  const getAssets = async () => {
    try {
      setIsLoading(true)
      const getAllTransactions = await getTransactions(isLoggedIn, id);

      // console.log(typeof getAllTransactions.documents);
      //console.log(getAllTransactions.documents);

      setnewAssets(getAllTransactions.documents);
      const sortedCoins = groupTransactions(getAllTransactions.documents)
                    .map(coin => ({
                      ...coin,
                      totalHolding: coin.totalQuantityBought * coin.averagePriceBought
                    }))
                    .sort((a, b) => b.totalHolding - a.totalHolding);
                    
      setGroupedAssets(sortedCoins);
      setIsLoading(false)
      //console.log(newassets);
      //console.log(groupedAssets);
    } catch (error) {
      console.error("Error fetching assets:", error);
    }
  };

  const getPriceDataForAssetsInStorage = async () => {
    const results = await getDataForAssetsInStorage(groupedAssets);
    
    setGroupedAssetsWithPrices(results);
    setListData(results);
    //console.log(groupedAssetsWithPrices);
  };

  useFocusEffect(
    React.useCallback(() => {
      setIsLoading(true);
      getAssets();
      setIsLoading(false);
    }, [])  
  );
  //For reloading or going back to page
  useEffect(() => {
    if (isFocused) {
      getAssets();
    }
  }, [isFocused]);

  //for first time pull
  useEffect(() => {
    getAssets();
  }, []);

  //To pull prices
  useEffect(() => {
    getPriceDataForAssetsInStorage();
    setListDataLength(groupedAssets.length);
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
  const colorForTabAssets = whichTab === "assets" ? "#ffffff" : "#000000";
  // whichTab === "assets" ? "#8930D5" : "#000000";
  const colorForTabTransactions =
    whichTab === "transactions" ? "#ffffff" : "#000000";
  // whichTab === "transactions" ? "#8930D5" : "#000000";

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
          //backgroundColor: "#ea3943",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingRight: 25,
          marginLeft: 25,
          borderRadius: 15,
          marginHorizontal: 25,
        }}
        onPress={() => navigation.navigate("AddNewTransactionScreen")/*onDeleteAsset(data)*/ }
      >
        <Feather name="trash-2" size={24} color="white" />
      </Pressable>
    );
  };

  const handleTabSwitch = (data, tab) => {
    //console.log(data);
    setListData(data);
    setTab(tab);
  };

  return isLoading ? (
    <LoadingFullScreen
      spinnerSource={require('../../../../imgs/ngjyra.png')}
      backgroundSource={require('../../../../imgs/back that.png')}
    />
  ) : (
    <ImageBackground source={bg} style={{ paddingBottom: 70, paddingTop: 55, flex: 1 }}>
      <SwipeListView
        data={listData}
        renderItem={
          (item, index) =>
            //<SwipeRow closeOnRowPress={true} closeOnRowBeginSwipe={true}>
            whichTab === "assets" ? (
              <PortfolioAssetsItem
                assetsItem={item}
                index={index}
                listDataLength={listDataLength}
              />
            ) : (
              <TransactionItem assetsItem={item} />
            )
          //</SwipeRow>
        }
        keyExtractor={({ id }, index) => `${id}${index}`}
        renderHiddenItem={
          whichTab === "assets" ? (data) => renderDeleteButton(data) : false
        }
        disableLeftSwipe={whichTab === "assets" ? false : true}
        disableRightSwipe={true}
        rightOpenValue={whichTab === "assets" ? -75 : 0}
        ListHeaderComponent={
          <>
            <View
              style={{
                backgroundColor: "#251231",
                marginVertical: 25,
                marginHorizontal: 25,
                borderRadius: 15,
                padding: 20,
              }}
            >
              <View style={styles.balanceContainer}>
                <View>
                  <Text style={styles.currentBalance}>Current Balance: </Text>
                  <Text style={styles.currentBalanceValue}>
                    $
                    {calculateTotalCurrentBalance(groupedAssetsWithPrices)
                      .toFixed(2)
                      .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")}
                  </Text>
                  <Text
                    style={[styles.valueChange, { color: percentageColor }]}
                  >
                    $&nbsp;{calculateAllTimeChange(groupedAssetsWithPrices)}{" "}
                    (All Time)
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
              <DonutPieChart data={groupedAssetsWithPrices} />
            </View>
            <View
              style={{
                borderTopWidth: 0.5,
                marginHorizontal: 25,
                borderTopColor: "white",
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 15,
              }}
            >
              <Pressable
                onPress={() =>
                  handleTabSwitch(groupedAssetsWithPrices, "assets")
                }
                style={{
                  flex: 1,
                  justifyContent: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: colorForTabAssets,
                  paddingVertical: 15,
                  paddingHorizontal: 15,
                }}
              >
                <Text style={styles.AssetsLabel}>Assets</Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  handleTabSwitch(
                    sortTransactionsByTimestamp(newassets),
                    "transactions"
                  )
                }
                style={{
                  flex: 1,
                  justifyContent: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: colorForTabTransactions,
                  paddingVertical: 15,
                  paddingHorizontal: 15,
                }}
              >
                <Text style={styles.AssetsLabel}>Transactions</Text>
              </Pressable>
            </View>
            {/* <View style={{ paddingVertical: 20, paddingHorizontal: 15 }}>
              <Text style={styles.AssetsLabel}>Your Assets</Text>
            </View> */}
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
    </ImageBackground>
  );
};
export default PortfolioAssetsList;
