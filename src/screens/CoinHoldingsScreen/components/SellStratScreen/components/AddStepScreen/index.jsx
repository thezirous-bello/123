import React, { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Switch, ActivityIndicator } from "react-native";
import styles from "./styles";
import { useNavigation, useRoute } from "@react-navigation/native";
import auth from '@react-native-firebase/auth';
import { Ionicons } from '@expo/vector-icons'; 
import { postSellStratStep, insertMongoDBData } from "../../../../../../services/requests";
// import { BSON } from "realm";


const AddNewStep = () => {
  const isLoggedIn = auth().currentUser.uid ? true : false; 
  const navigation = useNavigation();
  const {params: {averagePriceBought, coinID, symbolz}} = useRoute();
  // const items = useQuery(Transactions);
  // const [subscriptions, setSubcriptions] = useState();
  const [sellQty, setSellQty] = useState('');
  const [priceToSell, setPriceToSell] = useState('');
  const [loading, setLoading] = useState(false);


  //console.log(items);
  const user = auth().currentUser;
  
  const onAddNewAsset = async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    const newAsset = {
      // _id: new BSON.ObjectId(),
      sellPrice: priceToSell,
      user_id: user.uid,
      coinID: coinID,
      ticker: symbolz,
      qty: parseFloat(sellQty),
      timestamp: new Date().toISOString(),
    };
    // const submitTransaction = await postSellStratStep(newAsset);
    const submitTransaction = await insertMongoDBData('SellStrategy',newAsset, isLoggedIn);
    console.log(submitTransaction);
    setLoading(false);
    navigation.goBack();
  };

  const isQuantityEntered = () => {
    if(sellQty > 0 && priceToSell > 0){
        return true
    } else {return false}
  }


  return (
    <View style={{ flex: 1 }}>
        <View style={styles.headerContainer}>
            <Ionicons
                name="chevron-back-sharp"
                size={29}
                color="white"
                style={{position: 'absolute', left: 0}}
                onPress={() => navigation.goBack()}
            />
            <Text
                style={{
                color: "white",
                fontSize: 25,
                letterSpacing: 1,
                paddingHorizontal: 20,
                fontFamily: "Poppins_700Bold",
                textAlign: 'center'
                }}
            >
                Add Step
            </Text>
        </View>
      {coinID && (
        <>
          {loading ? 
          (

            <View style={styles.boughtQTYContainer}>
                <ActivityIndicator size={"large"} color={'white'}/>
            </View>

          )
          
          : (
            <>
              <View style={styles.boughtQTYContainer}>
                <Text style={styles.pricePerCoin}>Enter sell price in USD: </Text>
                <View style={{ flexDirection: "row", marginBottom: 25 }}>
                  <TextInput
                    value={priceToSell}
                    placeholder="0"
                    placeholderTextColor="#1f1f1f"
                    keyboardType="numeric"
                    onChangeText={setPriceToSell}
                    style={{
                      color: "white",
                      fontSize: 40,
                    }}
                  />
                    <Text style={styles.ticker}>
                      USD
                    </Text>
                </View>
                <Text style={styles.pricePerCoin}>Enter quantity: </Text>
                <View style={{ flexDirection: "row" }}>
                <TextInput
                    value={sellQty}
                    placeholder="0"
                    placeholderTextColor="#1f1f1f"
                    keyboardType="numeric"
                    onChangeText={setSellQty}
                    style={{
                      color: "white",
                      fontSize: 40,
                    }}
                  />
                    <Text style={styles.ticker}>
                      QTY
                    </Text>
                </View>
                <View style={{marginTop: 25}}></View>
                <Text style={styles.pricePerCoin}>
                  
                 Average price per coin: {'\n'}
                 $
                  {averagePriceBought > 1
                    ? averagePriceBought
                        .toFixed(2)
                        .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
                    : averagePriceBought
                        .toFixed(5)
                        .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1")}{" "}
                </Text>
              </View>
              <Pressable
                style={{
                  ...styles.buttonContainer,
                  backgroundColor: isQuantityEntered() ? "#FF07C9" : "#303030",
                }}
                onPress={onAddNewAsset}
                disabled={sellQty === ""}
              >
                <Text
                  style={{
                    ...styles.buttonText,
                    color: isQuantityEntered() ? "white" : "grey",
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

export default AddNewStep;
