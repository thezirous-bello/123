import React, {useState, useEffect} from "react";
import { View, Text, Modal, Pressable, StyleSheet, TouchableWithoutFeedback } from "react-native";
import { AntDesign, Entypo } from '@expo/vector-icons';
import Purchases from "react-native-purchases";
import { useNavigation } from "@react-navigation/native";

const SubscriptionPopup = ({ visible, onClose, onBuy }) => {

  const navigation = useNavigation();
  const [products, setProducts] = useState([]); 
  const [offerings, setOfferings] = useState([]); 


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
        setOfferings(offering);
      } catch (error) {
        console.error("Error fetching offerings:", error);
      }
    };
    interval = setInterval(fetchOfferings, 1000);
    return () => clearInterval(interval); // Cleanup on unmount

  }, []);

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
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose} // Handles back button on Android
    >
      <TouchableWithoutFeedback  onPress={onClose}>
        <View style={styles.overlay}>
          <View style={styles.popupContainer}>
            {/* Close Button */}
            <AntDesign
              name="close"
              size={24}
              color="white"
              style={styles.closeIcon}
              onPress={onClose}
            />

            {/* Title */}
            <Text style={styles.title}>🚀 {offerings.title}!</Text>
            <View style={{height: 1, backgroundColor: 'white', width: '100%', marginVertical: 10}}></View>
            <Text style={styles.title2}>{offerings.description}</Text>
            {/* Benefits */}
            <View style={styles.benefits}>
              <View style={styles.benefitItem}>
                <Entypo name="line-graph" size={20} color="lightgreen" />
                <Text style={styles.benefitText}> Advanced Portfolio Tracking</Text>
              </View>
              <View style={styles.benefitItem}>
                <Entypo name="line-graph" size={20} color="lightgreen" />
                <Text style={styles.benefitText}> Premium AI Signals</Text>
              </View>
              <View style={styles.benefitItem}>
                <Entypo name="line-graph" size={20} color="lightgreen" />
                <Text style={styles.benefitText}> AI News Analysis</Text>
              </View>
              <View style={styles.benefitItem}>
                <Entypo name="line-graph" size={20} color="lightgreen" />
                <Text style={styles.benefitText}> Economic Alerts</Text>
              </View>
            </View>

            {/* Price & Purchase Button */}
            <Text style={styles.price}>🔥 Just {offerings.pricePerMonth ? offerings.pricePerMonth : '$14.99'}/{offerings.period == 'MONTHLY' ? 'Month' : 'Month'}</Text>
            <Pressable style={styles.buyButton} onPress={()=>{Buy_now();}}>
              <Text style={styles.buyText}>Subscribe Now</Text>
            </Pressable>
            <Pressable style={{}} onPress={()=>{Restore_Purchases();}}>
              <Text style={{color: 'white', textDecorationLine: 'underline', marginTop: 10}}>Restore</Text>
            </Pressable>
            <View style={{display: 'flex', justifyContent: 'center', flexDirection: 'row', paddingVertical: 15}}>
                    <Pressable onPress={() => {navigation.navigate('WebViewScreen', { url: 'https://www.barnacleai.com/privacypolicy.html' }); onClose();}}><Text style={{color: 'white'}}>Privacy Policy <Entypo name="dot-single" size={24} color="white" /></Text></Pressable>
                    <Pressable onPress={() => {navigation.navigate('WebViewScreen', { url: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/' }); onClose();}}><Text style={{color: 'white'}}>EULA <Entypo name="dot-single" size={24} color="white" /></Text></Pressable>
                    <Pressable onPress={() => {navigation.navigate('WebViewScreen', { url: 'https://www.barnacleai.com/disclaimer.html' }); onClose();}}><Text style={{color: 'white'}}>Disclaimer <Entypo name="dot-single" size={24} color="#820D72" /></Text></Pressable>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>

  );
};

// Styles for the pop-up
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupContainer: {
    backgroundColor: "#820D72",
    padding: 20,
    width: "85%",
    borderRadius: 15,
    alignItems: "center",
    position: "relative",
  },
  closeIcon: {
    position: "absolute",
    top: 10,
    right: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: 'white'
  },
  title2: {
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 10,
    color: 'white'
  },
  benefits: {
    width: "100%",
    marginBottom: 10,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 3,
  },
  benefitText: {
    fontSize: 17,
    marginLeft: 5,
    fontWeight: 'bold',
    color: 'white'
  },
  price: {
    fontSize: 18,
    fontWeight: "bold",
    marginVertical: 10,
    color: "#e0e0e0",
  },
  buyButton: {
    backgroundColor: "#FFF",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 10,
  },
  buyText: {
    color: "#000",
    fontSize: 18,
    fontWeight: "bold",
  },
});

export default SubscriptionPopup;
