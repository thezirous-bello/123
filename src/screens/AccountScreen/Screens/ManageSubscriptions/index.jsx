import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ImageBackground, ScrollView, StyleSheet } from "react-native";
import bg from "../../../../imgs/bgimg.png";
import { useNavigation } from "@react-navigation/native";
import Purchases from "react-native-purchases";
import LoadingFullScreen from "../../../../components/LoadingFullScreen";
import { Ionicons, Entypo } from "@expo/vector-icons";
import { Platform, Linking } from 'react-native';

const ManageSubscriptionsScreen = () => {
  const navigation = useNavigation();
  const [purchaseInfo, setPurchaseInfo] = useState([]);
  const [expiration, setExpiration] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchPurchaserInfo = async () => {
    setLoading(true);
    try {
      const purchaserInfo = await Purchases.getCustomerInfo();
      setPurchaseInfo(purchaserInfo.activeSubscriptions);
      setExpiration(purchaserInfo.allExpirationDates);
    } catch (e) {
      console.error("Error fetching purchaser info:", e);
    }
    setLoading(false);
  };

  const manageSubscriptions = async () => {
    try {
      if (Platform.OS === 'ios') {
        // await Purchases.presentCodeRedemptionSheet();
        Linking.openURL('itms-apps://apps.apple.com/account/subscriptions');
      } else if (Platform.OS === 'android') {
        const packageName = 'com.dinshpati.barnacleai';
        Linking.openURL(
          `https://play.google.com/store/account/subscriptions?package=${packageName}`
        );
      }
    } catch (error) {
      console.error("Failed to open subscription management:", error);
    }
  };

  useEffect(() => {
    fetchPurchaserInfo();
  }, []);

  const getDaysLeft = (expirationDate) => {
    const today = new Date();
    const timeDifference = expirationDate.getTime() - today.getTime();
    return Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
};

  return (
    loading ? (
      <LoadingFullScreen spinnerSource={require('../../../../imgs/ngjyra.png')} backgroundSource={require('../../../../imgs/back that.png')}/>
    ) : (
      <ImageBackground source={bg} style={{ padding: 30, flex: 1, paddingTop: 55 }}>
        <ScrollView>
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
                        fontSize: 20,
                        letterSpacing: 1,
                        paddingHorizontal: 20,
                        fontFamily: "Poppins_700Bold",
                        textAlign: 'center'
                        }}
                    >
                        Manage Subscriptions
                    </Text>
            </View>
          {purchaseInfo.length > 0 ? (
            purchaseInfo.map((sub, index) => (
              sub == 'rc_promo_Premium_custom' ? 
              <View key={index} style={{ marginTop: 20, padding: 15, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14 }}>
                <Text style={{ color: 'white', fontSize: 18, fontFamily: 'Poppins_500Medium' }}>{'Premium Free Trial'}</Text>
                <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, fontFamily: 'Poppins_400Regular' }}>You're currently trying out premium</Text>
                <Text style={{ color: 'rgba(255, 20, 20, 0.9)', fontSize: 16, fontFamily: 'Poppins_400Regular'}}>{`Expires in ${getDaysLeft(new Date(expiration['rc_promo_Premium_custom']))} days!`}</Text>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={22} color="rgba(255, 255, 255, 0.5)"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 13}}>Advanced Portfolio Tracking</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={22} color="rgba(255, 255, 255, 0.5)"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 13}}>Premium AI Signals</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={22} color="rgba(255, 255, 255, 0.5)"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 13}}>Advanced AI News Analysis</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={22} color="rgba(255, 255, 255, 0.5)"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 13}}>Economic and Other Urgent Alerts</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={22} color="rgba(255, 255, 255, 0.5)"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 13}}>Coin Sell Plan Creator</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={22} color="rgba(255, 255, 255, 0.5)"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 13}}>And More!</Text></View>
              </View>
              :
              <View key={index} style={{ marginTop: 20, padding: 15, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14 }}>
                <Text style={{ color: 'white', fontSize: 18, fontFamily: 'Poppins_500Medium' }}>{'Premium Monthly'}</Text>
                <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, fontFamily: 'Poppins_400Regular' }}>Premium features included</Text>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={22} color="rgba(255, 255, 255, 0.5)"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 13}}>Advanced Portfolio Tracking</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={22} color="rgba(255, 255, 255, 0.5)"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 13}}>Premium AI Signals</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={22} color="rgba(255, 255, 255, 0.5)"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 13}}>Advanced AI News Analysis</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={22} color="rgba(255, 255, 255, 0.5)"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 13}}>Economic and Other Urgent Alerts</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={22} color="rgba(255, 255, 255, 0.5)"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 13}}>Coin Sell Plan Creator</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={22} color="rgba(255, 255, 255, 0.5)"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 13}}>And More!</Text></View>
              </View>
            ))
          ) : (
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, fontFamily: 'Poppins_400Regular', marginTop: 20 }}>No active subscriptions</Text>
          )}
          {
            purchaseInfo[0] == 'rc_promo_Premium_custom' ? 

          <Pressable onPress={() => navigation.navigate('Subscriptions')} style={{ marginTop: 20, padding: 10, backgroundColor: '#98188d', borderRadius: 14 }}>
            <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Poppins_500Medium', textAlign: 'center' }}>See Subscription Options!</Text>
          </Pressable>
          
          :
          <Pressable onPress={manageSubscriptions} style={{ marginTop: 20, padding: 10, backgroundColor: '#98188d', borderRadius: 14 }}>
            <Text style={{ color: 'white', fontSize: 16, fontFamily: 'Poppins_500Medium', textAlign: 'center' }}>Manage Subscription</Text>
          </Pressable>
          }
          
        </ScrollView>
      </ImageBackground>
    )
  );
};

export default ManageSubscriptionsScreen;

const styles = StyleSheet.create({
    headerContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: 'center'
      }
});