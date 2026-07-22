import React, { useEffect, useState, useRef } from "react";
import CoinItem from "../../components/Coinitem";
import { LineChart, XAxis, YAxis } from "react-native-svg-charts";
import {
  FlatList,
  RefreshControl,
  View,
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  BackHandler,
  ActivityIndicator,
  Pressable,
  TouchableOpacity,
} from "react-native";
import cryptoCurrencies from "../../../assets/data/cryptocurrencies.json";
import bg from "../../imgs/bgimg.png";
import spinnerLogo from "../../imgs/ngjyra.png";
import {
  getMarketData,
  getMarketDataFromMongoDB,
  getAllMarketDataFromMongoDBNoPages,
  getTransactions,
  getDataForAssetsInStorage,
  insertNewUser,
  checkIfUserExists,
  updateNotificationToken,
  getUserInfo,
  updateSubscriptionStatus,
  insertMongoDBData
} from "../../services/requests";
import SearchableDropDown from "react-native-searchable-dropdown";
import { AntDesign, Fontisto, EvilIcons } from "@expo/vector-icons";
import * as shape from "d3-shape";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import auth from '@react-native-firebase/auth';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { usePushNotifications } from "./notifications";
import { useHandler } from "react-native-reanimated";
import Purchases from "react-native-purchases";
import SubscriptionPopup from "../AccountScreen/Screens/PopUpSubscription";
import FreeTrialPopUp from "../AccountScreen/Screens/FreeTrialPopUp";
import LoadingFullScreen from "../../components/LoadingFullScreen";
import { useCoins } from "../../services/CoinsContext";

const checkSubscriptionStatus = async () => {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    setIsSubscribed(!!customerInfo.entitlements.active['your_entitlement_id']);
  } catch (error) {
    console.log("Error checking subscription status:", error);
  }
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const convertArray = (inputArray) => {
  return inputArray.map((obj) => {
    return {
      id: obj._id,
      symbol: obj.symbol,
      name: obj.name,
      market_cap: obj.market_cap,
    };
  });
};

const groupTransactions = (transactions) => {
  // console.log(transactions)
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
        totalQuantitySold: 0,
        totalSold: 0,
        averagePriceBought: 0,
        averagePriceSold: 0,
        transType: transaction.transaction_type
      };
    }

    if(transaction.transaction_type == 'buy'){
      result[key].totalQuantityBought += transaction.quantityBought;
      result[key].totalSpent +=
      transaction.priceBought * transaction.quantityBought;
      // Calculate average bought price
      result[key].averagePriceBought =
      result[key].totalSpent / result[key].totalQuantityBought;
    }
    if(transaction.transaction_type == 'sell'){
      result[key].totalQuantitySold += transaction.quantityBought;
      result[key].totalSold +=
      transaction.priceBought * transaction.quantityBought;
      // Calculate average sold price
      result[key].averagePriceSold =
      result[key].totalSold / result[key].totalQuantitySold;
    }

    return result;
  }, {});

  // Convert the grouped transactions object back to an array
  const groupedArray = Object.values(groupedTransactions);
  return groupedArray;
};

const NewHomeScreen = () => {
  const user = auth().currentUser;
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 
  const [coins, setCoins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allCoins, setAllCoins] = useState([]);
  const [newassets, setnewAssets] = useState([]);
  const [groupedAssets, setGroupedAssets] = useState([]);
  const [groupedAssetsWithPrices, setGroupedAssetsWithPrices] = useState([]);
  const [selectCoinID, setSelectCoinID] = useState(null);
  const [isPopupVisible, setPopupVisible] = useState(false);
  const [isFreeTrialPopUpVisible, setFreeTrialPopUpVisible] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState([]);

  const [expoPushNotiToken, setExpoPushNotiToken] = useState(null);
  const notificationListener1 = useRef();
  const responseListener1 = useRef();

  const {expoPushToken, notification} = usePushNotifications();
  const data = JSON.stringify(notification, undefined, 2);
  const [userInfo, setUserInfo] = useState(null);
  const { setCoinsList } = useCoins();

  useFocusEffect(
    React.useCallback(() => {
    setLoading(true)
    let interval;

    const checkConfiguration = async () => {
      try {
        const configured = await Purchases.isConfigured();

        if (configured) {
          clearInterval(interval); // Stop checking once configured
          // console.log("Purchases is configured, fetching info...");
          const purchaserInfo = await Purchases.getCustomerInfo();
          const purchaseInformation = purchaserInfo.activeSubscriptions[0];

          setPurchaseInfo(purchaseInformation);

        }
      } catch (e) {
        console.error("Error fetching purchaser info:", e);
      }
    };

    // Poll every 1 second until configured
    interval = setInterval(checkConfiguration, 1000);
    const GetThoseUserInfos = async () =>{
      try{
        const info  = await getUserInfo(user?.email, id, isLoggedIn);
        console.log("user info " + info.userID)
        setUserInfo(info[0])
      }catch(e){
        console.log("error with user info " + e)
      }
    }
    GetThoseUserInfos();
    setLoading(false)
    return () => clearInterval(interval); // Cleanup on unmount
    }, [isLoggedIn, user?.email])
  );

  useEffect(() => {
          //console.log(isLoggedIn + " : " + user?.email + " : " + expoPushToken?.data + " : " + userInfo?.userID)
          if (userInfo && expoPushToken){
            if (isLoggedIn && user?.email && userInfo.notificationToken != expoPushToken.data && userInfo.userID != null) {
              try {
                const info = updateNotificationToken(user?.email, id, expoPushToken?.data,isLoggedIn);
                // console.log("Updated user info : " + info)
              } catch (error) {
                console.error("Error fetching user info:", error);
              }
            }else{
              console.log("no noti update needed")
            }
          }
  }, [userInfo, expoPushToken])

  useEffect(() => {
    if(userInfo){
      let currentSub = userInfo.subscription;
      // console.log("Subscription: " + purchaseInfo + " Length: " + purchaseInfo?.length + " Current Sub: " + currentSub)
      if(currentSub == undefined){
        currentSub = 'Free'
      }
      
      if (isLoggedIn && user?.email && (currentSub == 'Free' || currentSub == undefined || currentSub == null) && (purchaseInfo && purchaseInfo?.length > 0)) {
        try {
          const info = updateSubscriptionStatus(user?.email, id, purchaseInfo,isLoggedIn);
          //console.log("Updated user info add: " + info )
          //console.log("Subscription: " + purchaseInfo + " Length: " + purchaseInfo.length + " Current Sub: " + currentSub)
        } catch (error) {
          console.error("Error fetching user info:", error);
        }
      }
      else if(isLoggedIn && user?.email && currentSub != 'Free' && (!purchaseInfo && !purchaseInfo?.length > 0)) {
        try {
          const info = updateSubscriptionStatus(user?.email, id, purchaseInfo,isLoggedIn);
          //console.log("Updated user info remove: " + info)
          //console.log("Subscription: " + purchaseInfo + " Length: " + purchaseInfo.length + " Current Sub: " + currentSub)
        } catch (error) {
          //console.error("Error fetching user info:", error);
        }
      }
    }
}, [userInfo, purchaseInfo])

  //Get Portfolio info
  const getAssets = async () => {
    try {
      // const getAllTransactions = await getTransactions(isLoggedIn, id);

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
  };

  const onCloseDropdown = () => {
    // Handle dropdown close event, clear the selected item
    setSelectCoinID(null);
  };

  const handleBackButton = () => {
    // Close the dropdown when the back button is pressed
    setSelectCoinID(null);
    onCloseDropdown();
    return true; // Prevent default back button behavior
  };
  //Get coin data for search function
  const fetchAllCoins = async () => {
    if (loading) {
      return;
    }
    setLoading(true);
    const allCoins = await getAllMarketDataFromMongoDBNoPages();
    const formattedResults = convertArray(allCoins);
    setAllCoins(formattedResults);
    setLoading(false);
  };

  const fetchCoins = async (pageNumber) => {
    if (loading) {
      return;
    }
    setLoading(true);
    const amountToSKip = pageNumber === 0 ? 0 : pageNumber;
    //console.log(amountToSKip);
    const coinData = (await getMarketData(pageNumber)) || undefined;

    if (coinData === undefined) {
      // console.log("Running our api");
      const coinDataFromMongo = await getMarketDataFromMongoDB(amountToSKip);
      console.log("Coins from mongo: " + coinDataFromMongo);
      setCoins((existingCoins) => [...existingCoins, ...coinDataFromMongo]);
      setCoinsList((existingCoins) => [...existingCoins, ...coinDataFromMongo]);
    } else {
      setCoins((existingCoins) => [...existingCoins, ...coinData]);
      setCoinsList((existingCoins) => [...existingCoins, ...coinData]);
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
    setCoinsList(coinData);
    // await getAssets();
    setLoading(false);
  };

  const checkIfUserRecordExists = async () =>{
    const userExists = await checkIfUserExists(user?.email, id, isLoggedIn);

      // console.log("checking if user exists")
      // console.log(userExists)
      if (!userExists && user?.emailVerified) {
        // console.log("Creating user")
        // If the user does not exist, insert a new record
        // await insertNewUser(user?.email, id, expoPushNotiToken ? expoPushNotiToken : null, isLoggedIn);
        const newUserObject =
          {
            userID: id,
            email: user?.email,
            language: 'English',
            subscription: 'Free',
            darkMode: true,
            notificationToken: expoPushNotiToken ? expoPushNotiToken : null,
            notificationFlag:{signals:true,news:true,financials:true},
            remainingChats: 10
          }
        await insertMongoDBData("Users", newUserObject, isLoggedIn);
        setFreeTrialPopUpVisible(true);
      }
  }

  useEffect(() => {
    fetchCoins();
    fetchAllCoins();
    
    BackHandler.addEventListener("hardwareBackPress", handleBackButton);

    // Remove the event listener on component unmount
    return () => {
      BackHandler.removeEventListener("hardwareBackPress", handleBackButton);
    };
  }, []);

  useEffect(() => {
    getPriceDataForAssetsInStorage();
  }, [groupedAssets]);

  useEffect(() => {
    setLoading(true)
    checkIfUserRecordExists();
    // getAssets();
    // const getPurchaserInfo = async () => {
    //   try {
    //     const purchaserInfo = await Purchases.getCustomerInfo();
    //     setPurchaseInfo(purchaserInfo.activeSubscriptions[0]);
    //   } catch (e) {
    //     console.error("Error fetching purchaser info:", e);
    //   }
    // };
    // getPurchaserInfo();
    setLoading(false)
  }, [isLoggedIn])

  useEffect(() => {
    setLoading(true)
    // const getPurchaserInfo = async () => {
    //   try {
    //     const configured = await Purchases.isConfigured();
    //     console.log(configured + " ?????")
    //     if(configured){
    //       const purchaserInfo = await Purchases.getCustomerInfo();
    //       const purchaseInformation = purchaserInfo.activeSubscriptions[0];
    //       setPurchaseInfo(purchaserInfo.activeSubscriptions[0])
    //       console.log("We ran it!!")
    //       if(!purchaseInformation){
    //         setPopupVisible(true)
    //       }
    //     }
    //   } catch (e) {
    //     console.error("Error fetching purchaser info:", e);
    //   }
    // };

    // getPurchaserInfo();
    let interval;

    const checkConfiguration = async () => {
      try {
        const configured = await Purchases.isConfigured();

        if (configured) {
          clearInterval(interval); // Stop checking once configured
          // console.log("Purchases is configured, fetching info...");
          const purchaserInfo = await Purchases.getCustomerInfo();
          const purchaseInformation = purchaserInfo.activeSubscriptions[0];

          setPurchaseInfo(purchaseInformation);

          if (!purchaseInformation) {
            setPopupVisible(true);
          }
        }
      } catch (e) {
        console.error("Error fetching purchaser info:", e);
      }
    };

    // Poll every 1 second until configured
    interval = setInterval(checkConfiguration, 1000);
    const GetThoseUserInfos = async () =>{
      try{
        const info  = await getUserInfo(user?.email, id, isLoggedIn);
        setUserInfo(info[0])
      }catch(e){
        console.log("error with user info " + e)
      }
    }
    GetThoseUserInfos();
    setLoading(false)
    return () => clearInterval(interval); // Cleanup on unmount
  }, [isLoggedIn, id, user?.email]);

  const navigation = useNavigation();

  //NEW
  const calculateTotalCurrentBalance = (transactions) => {
    return transactions.reduce((totalBalance, transaction) => {
      const { totalQuantityBought, totalQuantitySold,currentPrice } = transaction;

      // Calculate the current value of the holdings for the transaction
      const currentValue = (totalQuantityBought + totalQuantitySold) * currentPrice;

      // Add the current value to the total balance
      totalBalance += currentValue;

      return totalBalance;
    }, 0);
  };

  //NEW
  const calculateAllTimeChange = (transactions) => {
    const allTimeChange = transactions.reduce(
      (total, { totalQuantityBought, currentPrice, totalSpent, totalSold, totalQuantitySold }) =>
        total + (totalQuantityBought) * currentPrice - (totalSpent),
      0
    );

    return allTimeChange.toFixed(2);
  };

  //NEW
  const calculatePercentageChange = (transactions) => {
    let currentBalance = 0;
    let boughtBalance = 0;

    transactions.forEach((transaction) => {
      const { totalQuantityBought, totalQuantitySold, currentPrice, totalSpent, totalSold, transType } = transaction;
      
      // Calculate the current value of the holdings for the transaction
      const currentValue = (totalQuantityBought) * currentPrice;

      // Add the current value to the current balance
      currentBalance += currentValue;

      // Add the total spent to the bought balance
      boughtBalance += (totalSpent);
    });

    // Calculate the percentage change
    const percentageChange =
      ((currentBalance - boughtBalance) / boughtBalance) * 100;

    return percentageChange.toFixed(2);
  };

  const handleClosePopup = () => {
    setPopupVisible(false); // Close the modal
  };
  const handleFreeTrialClosePopup = () => {
    setFreeTrialPopUpVisible(false);
  };

  return (
    isLoggedIn ?
    <View style={styles.image}>
      <SubscriptionPopup
        visible={isPopupVisible}
        onClose={handleClosePopup}
        onBuy={() => {handleClosePopup; navigation.navigate('Subscriptions')}} // Calls your existing purchase function
      />
      <FreeTrialPopUp
        visible={isFreeTrialPopUpVisible}
        onClose={handleFreeTrialClosePopup}
      />
      <View style={{display: 'flex', justifyContent:'space-between', flexDirection: 'row', alignItems: 'center'}}>
        <TouchableOpacity onPress={() => navigation.navigate("Account")} style={{display: 'flex', flexDirection: 'row', alignItems: 'center', marginLeft: 10}}>
          <EvilIcons name="user" size={24} color="white" style={{fontSize: 42}}/>
          <Text
            style={{
              color: "white",
              fontSize: 20,
              letterSpacing: 1,
              paddingHorizontal: 10,
              fontFamily: "Poppins_700Bold",
              marginTop: 10
            }}
          >
            Hey {user?.email ? user?.email.split("@")[0] : "there"}!
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={{marginRight: 20}} onPress={() => navigation.navigate("Notifications")}>
          <Fontisto name="bell" size={24} color="white" />
        </TouchableOpacity>
      </View>
      {userInfo?.userID ?
      <TouchableOpacity onPress={() => navigation.navigate('ChatScreen', { userID: userInfo.userID, numberOfTriesLeft: userInfo.remainingChats })} style={[styles.aiContainer, {marginBottom: 15, display: 'flex', flexDirection: 'row', alignItems:'center', alignContent: 'flex-start'}]}>
          <Image source={{uri: 'https://www.barnacleai.com/Images/Logo.png'}} style={{width: 45, height: 45, marginRight: 10, borderRadius: 50, borderColor: '#FF07C9', borderWidth: 1}} />
          <Text style={{
              color: "#ffffff",
              fontFamily: "Poppins_700Bold",
              letterSpacing: 1,
              fontSize: 15,
            }}>Try our new Analysis Bot Now!</Text>
      </TouchableOpacity>
      :
      <></>}
      <View>
        <Text
          style={{
            color: "white",
            fontSize: 18,
            letterSpacing: 1,
            paddingHorizontal: 20,
            fontFamily: "Poppins_700Bold",
            marginBottom: 5,
          }}
        >
        Markets
        </Text>
      </View>

      <FlatList
        data={coins}
        style={{ borderRadius: 20 }}
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
    : <LoadingFullScreen 
        spinnerSource={require('../../imgs/ngjyra.png')}
        backgroundSource={require('../../imgs/back that.png')}
    />
  );
};

export default NewHomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
  },
  image: {
    flex: 1,
    resizeMode: "cover",
    paddingVertical: 20,
    paddingHorizontal: 10,
    paddingTop: 50
    // justifyContent: "center",
  },
  text: {
    color: "white",
    fontSize: 42,
    fontWeight: "bold",
    textAlign: "center",
    backgroundColor: "#000000a0",
  },
  SearchContainer: {
    
  },
  dropdownContainer: {
    fontFamily: "Poppins_700Bold",
    borderWidth: 0,
    width: "100%",
    paddingHorizontal: 10,
    paddingVertical: 20,
  },
  itemStyle: {
    padding: 10,
    marginTop: 2,
    borderWidth: 1,
    backgroundColor: 'white',
    borderColor: "#444444",
    borderRadius: 5,
  },
  textInputProps: {
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#444444",
    borderRadius: 5,
    backgroundColor: "white",
    color: "white",
  },
  portfolioValues: {
    backgroundColor: "#251230",
    paddingHorizontal: 10,
    paddingVertical: 15,
    marginHorizontal: 10,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  aiContainer: {
    backgroundColor: "#181818",
    paddingHorizontal: 10,
    marginTop: 20,
    paddingVertical: 15,
    paddingHorizontal: 30,
    marginHorizontal: 10,
    borderRadius: 50,
    flexDirection: "row",
  },
  
  dropdownItem: {
    padding: 10,
    marginTop: 2,
    backgroundColor: '#FAF9F8',
    //borderColor: '#bbb',
    //borderWidth: 1,
    //borderRadius: 5,
  },
  dropdownItemText: {
    color: '#222',
  },
  itemsContainer: {
    backgroundColor: '#FFF',
    //borderColor: '#bbb',
    //borderWidth: 1,
    borderTopRightRadius: 20,
    borderTopLeftRadius: 20,
    //elevation: 5,
  },
  input: {
    margin: 0,
    height: 40,
    backgroundColor: 'white',
    fontFamily: 'Poppins_600SemiBold',
    padding: 10,
    borderRadius: 20
  },
});
