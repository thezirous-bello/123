import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ImageBackground, StyleSheet, Dimensions, Alert } from "react-native";
import bg from "../../../../imgs/bgimg.png";
import pBG from "../../../../imgs/purchasingBG.jpeg";
import { Entypo, Feather, FontAwesome, AntDesign, MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { ScrollView, GestureHandlerRootView } from "react-native-gesture-handler";
import { useNavigation } from "@react-navigation/native";
import auth from '@react-native-firebase/auth';
import Purchases from "react-native-purchases";
import { isConfigured } from "react-native-reanimated";
const screenHeight = Dimensions.get("window").height;

const Subscriptions = () => {
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 
  const user = auth().currentUser;
  const [isEnabled, setIsEnabled] = useState(true);
  const [userInfo, setUserInfo] = useState(null); // Initial state should be null or {} based on your data
  const navigation = useNavigation();
  const [purchaseInfo, setPurchaseInfo] = useState([]);
  const toggleSwitch = () => setIsEnabled(previousState => !previousState);
  const [products, setProducts] = useState([]); 
  const [offerings, setOfferings] = useState([]); 
  const [fetchOffering, setFetchOffering] = useState([]); 

  useEffect(() => {
    let interval;
    const fetchOfferings = async () => {
      try {
        await Purchases.isConfigured(); 
        const offerings = await Purchases.getOfferings();
        const availablePackages = offerings.all["default"].availablePackages;
        const offering = {
          title: availablePackages[0].product.title,
          description: availablePackages[0].product.description,
          period: availablePackages[0].packageType,
          pricePerMonth: availablePackages[0].product.pricePerMonthString
        };
        setFetchOffering(offering);
      } catch (error) {
        console.error("Error fetching offerings:", error);
      }
    };
    interval = setInterval(fetchOfferings, 1000);
    return () => clearInterval(interval); // Cleanup on unmount

  }, []);

  //Purchase function
  async function Buy_now() {
    try {
    // // Configured?
    // const configured = await Purchases.isConfigured();
    // console.log("Is configured??? " + configured)
    // Get offerings
    const offerings = await Purchases.getOfferings();
    // Check if the desired package is available
    const packageIdentifier = "Premium";
    const availablePackages = offerings.all["default"].availablePackages;
    if (availablePackages.length !== 0) {
      // Display packages for sale (you can customize this part based on your UI)
      // For simplicity, let's assume you want to purchase the first available package
      const selectedPackage = availablePackages[0];
      
      // Make the purchase
      const { customerInfo, productIdentifier } = await Purchases.purchasePackage(selectedPackage);
      
      // Check if the entitlement is active
      const entitlementIdentifier = "Premium";
      if (customerInfo.entitlements.active[entitlementIdentifier] !== undefined) {
        console.log("✅ PURCHASE SUCCESSFUL");
        Purchases.syncPurchases();
        const customerInfo = await Purchases.getCustomerInfo();
        navigation.navigate('ManageSubscriptions');
      // Do something after a successful purchase
      }
    }
    } catch (error) {
      if (!error.userCancelled) {
        console.error("PURCHASE FAILED", error);
        // Handle error (show an error message, etc.)
      }
    }
  }

  async function Restore_Purchases() {
    try {
      const restore = await Purchases.restorePurchases();
      const customerInfo = await Purchases.getCustomerInfo();
      Alert.alert("Restored Purchases", JSON.stringify(restore.entitlements.active));
    } catch (e) {
      console.error("Error restoring purchases:", e);
    }
  }

  return (
    <ImageBackground source={bg} style={{ flex:1}}>
      <GestureHandlerRootView>
            <ImageBackground style={styles.headerBG} source={pBG}>
                <View style={styles.headerContainer}>
                    <AntDesign
                        name="close"
                        size={29}
                        color="white"
                        style={{position: 'absolute', right: 0}}
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
                        
                    </Text>
                </View>
            </ImageBackground>
        <ScrollView style={{paddingTop: 20, backgroundColor: '#820D72'}}>
            <Text
                    style={{
                    color: "white",
                    fontSize: 25,
                    letterSpacing: 1,
                    paddingHorizontal: 20,
                    fontFamily: "Poppins_700Bold",
                    textAlign: 'left'
                    }}
                >
                Time to trade like a pro with our Premium Plan!
                {products ? products : 'Its empty'}
                {offerings ? offerings : 'Offerings is empty'}
            </Text>
            <View style={{height: 1, backgroundColor: 'white', width: '100%', marginVertical: 10}}></View>
            <Text style={styles.title}>{fetchOffering.title}</Text>
            <Text style={styles.description}>{fetchOffering.description}</Text>
            <View style={{paddingHorizontal:20, paddingVertical: 15}}>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={27} color="lightgreen"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 17}}>Advanced Portfolio Tracking</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={27} color="lightgreen"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 17}}>Premium AI Signals</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={27} color="lightgreen"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 17}}>Advanced AI News Analysis</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={27} color="lightgreen"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 17}}>Economic and Other Urgent Alerts</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={27} color="lightgreen"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 17}}>Coin Sell Plan Creator</Text></View>
                <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><Entypo name="line-graph" size={27} color="lightgreen"  style={{marginRight: 10}}/><Text style={{color: 'white', fontSize: 17}}>And More!</Text></View>
                <Pressable style={{padding: 15, borderColor: 'white', borderWidth: 2, borderRadius: 25, marginVertical: 15}}>
                    <View style={{display: 'flex', flexDirection: 'row', paddingVertical: 5}}><AntDesign name="checkcircle" size={24} color="white" style={{marginRight: 10}}/><Text style={{fontSize: 17, color: 'white'}}>1 Month</Text></View>
                    <Text style={{fontSize: 17, color: 'white'}}>Full access for just {fetchOffering.pricePerMonth ? fetchOffering.pricePerMonth : '$14.99'} per {fetchOffering.period == 'MONTHLY' ? 'Month' : 'Month'}!</Text>
                </Pressable>
                <Pressable style={{backgroundColor: 'white', padding: 15, marginHorizontal: 5, borderRadius: 30, alignItems: 'center'}} onPress={()=>Buy_now()}><Text style={{fontSize: 27, color: '#000'}}>Continue</Text></Pressable>
                <Pressable style={{alignItems: 'center'}} onPress={()=>{Restore_Purchases();}}>
                  <Text style={{color: 'white', textDecorationLine: 'underline', marginTop: 10}}>Restore</Text>
                </Pressable>
                <View style={{display: 'flex', justifyContent: 'center', flexDirection: 'row', paddingVertical: 15, marginBottom: 35}}>
                    <Pressable onPress={() => {navigation.navigate('WebViewScreen', { url: 'https://www.barnacleai.com/privacypolicy.html' }); }}><Text style={{color: 'white'}}>Privacy Policy <Entypo name="dot-single" size={24} color="white" /></Text></Pressable>
                    <Pressable onPress={() => {navigation.navigate('WebViewScreen', { url: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/' }); }}><Text style={{color: 'white'}}>EULA <Entypo name="dot-single" size={24} color="white" /></Text></Pressable>
                    <Pressable onPress={() => {navigation.navigate('WebViewScreen', { url: 'https://www.barnacleai.com/disclaimer.html' }); }}><Text style={{color: 'white'}}>Disclaimer <Entypo name="dot-single" size={24} color="#820D72" /></Text></Pressable>
                </View>
            </View>
        </ScrollView>
      </GestureHandlerRootView>
    </ImageBackground>
  );
};

export default Subscriptions;

const styles = StyleSheet.create({
    headerContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: 'center',
    },
    headerBG:{
        padding: 30,
        paddingTop: 65,
        height: screenHeight/ 3.7
    },
    tickerContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    tickerTitle: { 
      color: "white", 
      fontWeight: "bold", 
      marginHorizontal: 5,
    fontSize: 18},
    rank: {
      fontWeight: "bold",
      color: "white",
      fontSize: 16,
      marginRight: 5,
      backgroundColor: "#585858",
      paddingTop: 1,
      paddingBottom: 1,
      paddingLeft: 4,
      paddingRight: 4,
      borderRadius: 5
    },
    title: {
      fontSize: 20,
      fontWeight: "bold",
      marginVertical: 15,
      color: 'white',
      alignSelf: 'center'
    },
    description: {
      fontSize: 16,
      color: 'white',
      marginBottom: 10,
      textAlign: 'center'
    },
  });

//   import React from 'react';
//   import { View } from 'react-native';
  
//   import RevenueCatUI from 'react-native-purchases-ui';
  
//   // Display current offering
//   const Subscriptions = () => {
//   return (
//       <View style={{ flex: 1 }}>
//           <RevenueCatUI.Paywall />
//       </View>
//   );
// }
// export default Subscriptions;
//   // If you need to display a specific offering:
//   return (
//       <View style={{ flex: 1 }}>
//           <RevenueCatUI.Paywall
//             options={{
//               offering: offering // Optional Offering object obtained through getOfferings
//             }}
//             onRestoreCompleted={({customerInfo}: { customerInfo: CustomerInfo }) => {
//               // Optional listener. Called when a restore has been completed.
//               // This may be called even if no entitlements have been granted.
//             }
//             onDismiss={() => {
//               // Dismiss the paywall, i.e. remove the view, navigate to another screen, etc.
//               // Will be called when the close button is pressed (if enabled) or when a purchase succeeds.
//             }}
//           />
//       </View>
//   );