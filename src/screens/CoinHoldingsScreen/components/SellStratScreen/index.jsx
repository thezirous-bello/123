import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, ImageBackground, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import bg from "../../../../imgs/bgimg.png";
import { getSellStrategyPerCoin, deleteSellStrategyRecord } from '../../../../services/requests';
import auth from '@react-native-firebase/auth';
import GetPremium from '../../../../components/GetPremium';
import Purchases from "react-native-purchases";
import { Keyboard, TouchableWithoutFeedback } from 'react-native';

const screenWidth = Dimensions.get('window').width;

const Timeline = () => {
  const navigation = useNavigation();
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 
  const { params: { averagePriceBought, coinID, symbolz } } = useRoute();
  const [timelineData, setTimelineData] = useState([]);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalSum, setTotalSum] = useState(0);
  const [loading, setLoading] = useState(true);
  const [purchaseInfo, setPurchaseInfo] = useState([]);

  const getAssets = useCallback(async () => {
    try {
      const getAllTransactions = await getSellStrategyPerCoin(isLoggedIn, id, coinID);
      const data = getAllTransactions.documents;
      
      setTimelineData(data);
      const totalPaidAmount = data.reduce((sum, item) => sum + (averagePriceBought * item.qty), 0);
      const totalSumAmount = data.reduce((sum, item) => sum + (item.sellPrice * item.qty), 0);
      
      setTotalPaid(totalPaidAmount);
      setTotalSum(totalSumAmount);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching assets:", error);
    }
  }, [isLoggedIn, id, coinID, averagePriceBought]);

  const deleteSellStep = (recordID) => {
    try {
      setLoading(true);
      const deleteStep = deleteSellStrategyRecord(isLoggedIn, id, coinID, recordID);
      getAssets();
      setLoading(false);
    } catch (error) {
      console.error("Error fetching assets:", error);
    }
  };

  useEffect(() => {
    const getPurchaserInfo = async () => {
      try {
        const purchaserInfo = await Purchases.getCustomerInfo();
        setPurchaseInfo(purchaserInfo.activeSubscriptions[0]);
      } catch (e) {
        console.error("Error fetching purchaser info:", e);
      }
    };
    getPurchaserInfo();
    getAssets();
  }, []);

  const renderItem = ({ item, index }) => (
    <View style={styles.itemContainer}>
      <View style={styles.iconContainer}>
        <Text style={{
          marginLeft: 6,
          color: "#FF07C9",
          fontSize: 22,
          letterSpacing: 1,
          fontFamily: "Poppins_600SemiBold",
          textAlign: 'center'
        }}>{index + 1}.</Text>
      </View>
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>${parseFloat(item.sellPrice) > 1 ? parseFloat(item.sellPrice).toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,") : parseFloat(item.sellPrice).toFixed(12).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,") }</Text>
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.title}>$ {item.sellPrice * item.qty > 1 ? (item.sellPrice * item.qty).toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,") : (item.sellPrice * item.qty).toFixed(12).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")}</Text>
        <Text style={styles.description}>x {item.qty}</Text>
      </View>
      <Pressable onPress={ () => deleteSellStep(item._id)}>
        <Ionicons name='trash-sharp' size={24} color={'#FF07C9'}/>
      </Pressable>
    </View>
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <ImageBackground source={bg} style={styles.image}>
        <View style={styles.headerContainer}>
          <Ionicons
            name="chevron-back-sharp"
            size={29}
            color="white"
            style={{ position: 'absolute', left: 0 }}
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
            Sell Strategy
          </Text>
        </View>
        { purchaseInfo ? loading ? <ActivityIndicator size={'large'} color={'white'} /> :
          <>
            <View>
              <Text style={{
                color: "white",
                fontSize: 22,
                letterSpacing: 1,
                marginTop: 40,
                paddingHorizontal: 20,
                fontFamily: "Poppins_600SemiBold",
                textAlign: 'center'
              }}>Total Planned Gains:</Text>
              <Text style={{
                color: "#FF07C9",
                fontSize: 22,
                letterSpacing: 1,
                fontFamily: "Poppins_600SemiBold",
                textAlign: 'center'
              }}>${totalSum > 1 ? totalSum.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,") : totalSum.toFixed(12).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")}</Text>
            </View>
            <View>
              <Text style={{
                color: "white",
                fontSize: 18,
                letterSpacing: 1,
                marginTop: 10,
                fontFamily: "Poppins_600SemiBold",
                textAlign: 'center'
              }}>Total Profit:</Text>
              <Text style={{
                color: "#FF07C9",
                fontSize: 18,
                letterSpacing: 1,
                fontFamily: "Poppins_600SemiBold",
                textAlign: 'center'
              }}>${(totalSum - totalPaid) > 1 ? (totalSum - totalPaid).toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,") : (totalSum - totalPaid).toFixed(12).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")}</Text>
            </View>
            <FlatList
              data={timelineData}
              renderItem={renderItem}
              keyExtractor={(item) => item._id.toString()}
              contentContainerStyle={styles.container}
              refreshControl={
                <RefreshControl
                  refreshing={loading}
                  tintColor="white"
                  onRefresh={getAssets}
                />
              }
            />
            <Pressable
              style={styles.buttonContainer}
              onPress={() => navigation.navigate("AddNewStep", { averagePriceBought: averagePriceBought, coinID: coinID, symbolz: symbolz })}
            >
              <Text style={styles.buttonText}> Add Step</Text>
            </Pressable>
          </>
          : <GetPremium/>}
      </ImageBackground>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
  },
  itemContainer: {
    justifyContent: 'center',
    flexDirection: 'row',
    marginVertical: 10,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 40,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateContainer: {
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    width: 100,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  contentContainer: {
    flex: 1,
    paddingLeft: 20,
    borderLeftWidth: 2,
    borderLeftColor: '#ddd',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgba(255, 255, 255, 0.8)'
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  headerContainer: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'center'
  },
  image: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 5,
    paddingTop: 55,
    backgroundColor: 'rgba(0, 0, 0, 1)'
  },
  buttonContainer: {
    marginVertical: 15,
    marginHorizontal: 25,
    borderRadius: 5,
    padding: 10,
    paddingVertical: 7,
    alignItems: "center",
    backgroundColor: "#FF07C9",
  },
  buttonText: {
    color: "white",
    fontSize: 17,
    fontFamily: "Poppins_600SemiBold",
    fontWeight: "600",
  },
});

export default Timeline;
