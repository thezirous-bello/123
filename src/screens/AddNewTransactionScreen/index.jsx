import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Switch, ActivityIndicator } from "react-native";
import SearchableDropDown from "react-native-searchable-dropdown";
import styles from "./styles";
import { useRecoilState } from "recoil";
import { allPortfolioBoughtAssetsInStorage } from "../../atoms/PortfolioAssets";
import {
  getAllCoins,
  getAllCoinsMongoDB,
  getDetailedCoinData,
  historical_coin_data,
  getMarketDataByCoinIDs,
  postTransaction,
  insertMongoDBData
} from "../../services/requests";
import { getDefaultStartDate, getDefaultEndDate } from "../../services/dataManipulation";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import { Transactions } from "../../models/Transactions";
import { v4 as uuid } from "uuid";
import auth from '@react-native-firebase/auth';
import { Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback, Platform } from 'react-native';

const AddNewTransactionScreen = () => {
  // const items = useQuery(Transactions);
  // const [subscriptions, setSubcriptions] = useState();

  //console.log(items);
  const user = auth().currentUser;
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 

  //const transaction = useQuery(Transaction);

  const [allCoins, setAllCoins] = useState([]);
  const [selectCoinID, setSelectCoinID] = useState(null);
  const [symbolz, setSymbolz] = useState(null);
  const [isBuy, setIsBuy] = useState(true);
  const toggleSwitch = () => setIsBuy((previousState) => !previousState);
  const [transactionType, setTransactionType] = useState("buy");
  const [selectedCoins, setSelectedCoins] = useState(null);
  const [curerntPrice, setCurrentPrice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [boughAssetQTY, setBoughAssetQTY] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
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
    const allCoins = await getAllCoinsMongoDB(isLoggedIn);
    const coinsWithId = allCoins.map(coin => ({
      id: coin._id, // Rename _id to id
      symbol: coin.symbol,
      name: coin.name,
      market_cap: coin.market_cap,
      // Add other fields as necessary
    }));
    const sortedCoins = coinsWithId ? 
    coinsWithId.sort((a, b) => b.market_cap - a.market_cap) :
          [];
    setAllCoins(sortedCoins);
    setLoading(false);
  };

  const fetchCoinInfo = async () => {
    if (loading) {
      return;
    }
    setLoading(true);

    try{
      console.log("hello")
      const CoinInfo = await getDetailedCoinData(selectCoinID) || false;
      if(!CoinInfo){
        console.log("YFinance")
        try{
          console.log("Whats good")
          console.log(symbolz)
          const fetchCoinData = (await historical_coin_data((symbolz.toString().toUpperCase() + '-USD'), getDefaultStartDate(59), getDefaultEndDate(), '30m')) || [];
          // console.log(fetchCoinData[0])
          setCurrentPrice(fetchCoinData[0].current_price.usd)
          setSelectedCoins(fetchCoinData[0])
          console.log(selectedCoins)
        }catch (e){
          console.log(e)
          try{
            console.log("mongodb")
            console.log(selectCoinID)
            const mongoDB = await getMarketDataByCoinIDs(selectCoinID) || false;
            console.log('MongoDB')
            setCurrentPrice(mongoDB[0].current_price)
            setSelectedCoins(mongoDB[0]);
          }catch (e){
            console.log(e)
          }
        }
      }else{
        setCurrentPrice(CoinInfo.market_data.current_price.usd)
        setSelectedCoins(CoinInfo);
        console.log("CoinInfo")
      }
      

    }catch(e){
      console.log(e)
    }    
    setLoading(false);
  };

  useEffect(() => {
    fetchAllCoins();
  }, []);

  useEffect(() => {
      fetchCoinInfo();
  }, [symbolz]);

  const setSomeData = (id, symbol) =>{
    console.log(id, symbol)
    setSelectCoinID(id);
    setSymbolz(symbol);
  }

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
  
    // Cleanup listeners on component unmount
    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);  

  // useEffect(() => {
  //   //Subscriptions
  //   console.log(user.id);
  //   // const updateSubscriptions = async () => {
  //   //   await realm.subscriptions.update((mutableSubs) => {
  //   //     mutableSubs.add(realm.objects(Transactions), { name: "Transaction" });
  //   //   });
  //   // };
  //   const updateSubscriptions = async () => {
  //     await realm.subscriptions.update((mutableSubs) => {
  //       mutableSubs.add(realm.objects(Transactions));
  //       console.log("updateSubscriptions");
  //       console.log(realm.subscriptions);
  //     });

  //     setSubcriptions(realm.subscriptions);
  //   };

  //   updateSubscriptions();

  //   console.log("UpdateSUBS");
  //   console.log(subscriptions);
  //   //}, [realm, user]);
  // }, []);

  // const onAddNewAsset = useCallback(() => {
  //   // const newAsset = {
  //   //   id: selectedCoins.id,
  //   //   name: selectedCoins.name,
  //   //   image: selectedCoins.image.small,
  //   //   ticker: selectedCoins.symbol,
  //   //   quantityBought: parseFloat(boughAssetQTY),
  //   //   priceBought: selectedCoins.market_data.current_price.usd,
  //   // };

  //   // const newAssets = [...assetsInStorage, newAsset];
  //   // const jsonValue = JSON.stringify(newAsset);
  //   // await AsyncStorage.setItem("@portfolio_coins", jsonValue);
  //   // setAssetsInStorage(newAssets);
  //   if (!realm || !user.isLoggedIn) {
  //     console.error("Realm is not initialized");
  //     return;
  //   }
  //   //console.log(realm.subscriptions);
  //   if (boughAssetQTY > 0) {
  //     const newAsset = {
  //       _id: new BSON.ObjectId(),
  //       user_id: user.id,
  //       transaction_type: "buy",
  //       image: selectedCoins.image.small,
  //       name: selectedCoins.name,
  //       priceBought: selectedCoins.market_data.current_price.usd,
  //       quantityBought: parseFloat(boughAssetQTY),
  //       ticker: selectedCoins.symbol,
  //       timestamp: "2024-01-13T22:06:49Z",
  //     };

  //     console.log(realm.subscriptions.findByName("Transaction"));
  //     if (realm.subscriptions.findByName("Transaction")) {
  //       realm.write(() => {
  //         //console.log(newAsset);
  //         realm.create("Transaction", new Transactions(newAsset));

  //         // return new Transactions(realm, {
  //         //   newAsset,
  //         // });
  //       });
  //       realm.commitTransaction();
  //     } else {
  //       console.log("Transaction does not exist");
  //     }
  //     navigation.goBack();
  //   }
  // }, [realm, boughAssetQTY, selectedCoins]);

  useEffect(() => {
    console.log(isBuy);
    if (isBuy) {
      setTransactionType("buy");
      console.log(transactionType);
    } else {
      setTransactionType("sell");
      console.log(transactionType);
    }
  }, [isBuy]);
  const onAddNewAsset = async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    const newAsset = {
      // _id: new BSON.ObjectId(),
      user_id: id,
      transaction_type: transactionType,
      image: selectedCoins.image ? selectedCoins.image.small : 'https://www.barnacleai.com/Images/Logo.png',
      name: selectedCoins.name,
      coinID: selectedCoins.market_data ? selectedCoins.id : selectedCoins.name.toLowerCase(),
      priceBought: selectedCoins.market_data ? selectedCoins.market_data.current_price.usd : selectedCoins.current_price.usd,
      quantityBought: isBuy
        ? parseFloat(boughAssetQTY)
        : -parseFloat(boughAssetQTY),
      ticker: selectedCoins.symbol,
      timestamp: new Date().toISOString(),
    };
    // const submitTransaction = await postTransaction(newAsset);
    const submitTransaction = await insertMongoDBData('Transactions',newAsset, isLoggedIn);
    //console.log(submitTransaction);
    setLoading(false);
    navigation.goBack();
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss(); // Close the keyboard when the Done button is pressed
  };

  return (
    <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  >
    {/* Dismiss keyboard when tapping outside */}
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <View style={{ flex: 1 }}>
        {/* Your SearchableDropDown and other components */}
        
        {keyboardVisible && (
          <Pressable onPress={Keyboard.dismiss} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        )}
      <SearchableDropDown
        items={allCoins}
        containerStyle={styles.dropdownContainer}
        itemStyle={styles.itemStyle}
        onItemSelect={(item) => setSomeData(item.id,item.symbol)}
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
                {selectedCoins || loading || curerntPrice ? 
                <Text style={styles.pricePerCoin}>
                  $
                  {curerntPrice > 1
                    ? curerntPrice
                        .toFixed(2)
                        .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
                    : curerntPrice
                        .toFixed(5)
                        .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1")}{" "}
                  per coin
                </Text>
                : <ActivityIndicator size={"large"} color={'#fff'}/>}
                <View style={{ alignContent: "center", alignSelf: "center" }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text style={{ color: "#8930D5", padding: 10 }}>Sell</Text>
                    <Text style={{ color: "#16c784", padding: 10 }}>Buy</Text>
                  </View>
                  <Switch
                    style={{ alignSelf: "center" }}
                    // trackColor={{ false: "#767577", true: "#81b0ff" }}
                    thumbColor={isBuy ? "#FFF" : "#8930D5"}
                    ios_backgroundColor="#3e3e3e"
                    onValueChange={toggleSwitch}
                    value={isBuy}
                  />
                </View>
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
    </TouchableWithoutFeedback>
  </KeyboardAvoidingView>
  );
};

export default AddNewTransactionScreen;
