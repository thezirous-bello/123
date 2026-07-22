import React, {useState, useEffect} from "react";
import { View, Text, Modal, Pressable, StyleSheet, TouchableWithoutFeedback } from "react-native";
import { AntDesign, Entypo } from '@expo/vector-icons';
import Purchases from "react-native-purchases";
import { useNavigation } from "@react-navigation/native";

const FreeTrialPopUp = ({ visible, onClose, onBuy }) => {

  const navigation = useNavigation();
  const [products, setProducts] = useState([]); 
  const [expiration, setExpiration] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let interval;
    const fetchPurchaserInfo = async () => {
      setLoading(true);
      try {
        const purchaserInfo = await Purchases.getCustomerInfo();
        setProducts(purchaserInfo.activeSubscriptions[0]);
        setExpiration(purchaserInfo.allExpirationDates);
      } catch (e) {
        console.error("Error fetching purchaser info:", e);
      }
      setLoading(false);
    };
    interval = setInterval(fetchPurchaserInfo, 1000);
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

  const getDaysLeft = (expirationDate) => {
    const today = new Date();
    const timeDifference = expirationDate.getTime() - today.getTime();
    return Math.ceil(timeDifference / (1000 * 60 * 60 * 24));
};

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
            <Text style={styles.title}>🚀 Premium Free Trail!</Text>
            <View style={{height: 1, backgroundColor: 'white', width: '100%', marginVertical: 10}}></View>
            <Text style={styles.title2}>{'We have gifted you 2 days of premium access for free!'}</Text>
            <Text style={styles.title2}>{'You may need to close and reopen your app for the changes to take effect!'}</Text>

            {/* <Text style={[styles.title2, {color: 'rgba(255, 20, 20, 0.8)'}]}>{`Expires in ${expiration ? getDaysLeft(new Date(expiration['rc_promo_Premium_custom'])) : '2'} days!`}</Text> */}
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
    color: 'white',
    textAlign: 'center'
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

export default FreeTrialPopUp;
