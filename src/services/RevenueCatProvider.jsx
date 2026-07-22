import React, { createContext, useEffect, useContext } from "react";
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import auth from '@react-native-firebase/auth';

const API_KEYS = {
    apple: 'appl_PlMpatYMTvhqkMmPtdyVurJNyZO',
    google: 'goog_ujQbcjPMrjtRjrhuXoTNOqugtZf'
};

const RevenueCatContext = createContext();

export const loginToRevenueCat = async (appUserID) => {
    try {
      const purchaserInfo = await Purchases.logIn(appUserID);
      
      if (purchaserInfo.created) {
        console.log("New user was created in RevenueCat");
      } else {
        console.log("Existing user logged in");
      }
      
      return purchaserInfo;
    } catch (e) {
      console.error("Error logging in to RevenueCat:", e);
    }
  };  

  const isConfiguredOfferings = async () => {
    const configured = await Purchases.isConfigured();
    console.log("Is RevenueCat Configured?", configured);

    if (configured) {
      try{
        const offerings = await Purchases.getOfferings();
        const availablePackages = offerings.all["default"].availablePackages;
        console.log("Offerings:", availablePackages);
      }catch(e){
        console.log(JSON.stringify(e))
      }
    } else {
        console.log("Purchases not configured yet.");
    }
};

export function RevenueCatProvider({ children }) {
    const id = auth().currentUser.uid;
    const isLoggedIn = auth().currentUser.uid ? true : false; 
    // useEffect(() => {
    //     Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    //     const apiKey = Platform.OS === 'ios' ? API_KEYS.apple : API_KEYS.google;
    //     Purchases.configure({ apiKey});
    //     loginToRevenueCat(id);
    //     console.log("IsConfigured: ")
    //     isConfiguredOfferings();

    // }, []);
    useEffect(() => {
      const initializeRevenueCat = async () => {
          Purchases.setLogLevel(LOG_LEVEL.DEBUG);
          const apiKey = Platform.OS === 'ios' ? API_KEYS.apple : API_KEYS.google;
          await Purchases.configure({ apiKey });
          
          if (id) {
              await loginToRevenueCat(id);
          }

          // await isConfi guredOfferings();
      };

      initializeRevenueCat();

      // Add the listener to catch subscription updates
      const subscriptionListener = Purchases.addCustomerInfoUpdateListener((customerInfo) => {
        if (customerInfo.entitlements.active['Premium']) {
          console.log("Subscription is active after purchase!");
          // Handle post-purchase logic, like unlocking features
        } else {
          console.log("No active subscription.");
        }
      });

      // Clean up the listener on unmount
      return () => {
        Purchases.removeCustomerInfoUpdateListener(subscriptionListener);
      };
  }, []);

    return (
        <RevenueCatContext.Provider value={{ Purchases }}>
            {children}
        </RevenueCatContext.Provider>
    );
}

export function useRevenueCat() {
    return useContext(RevenueCatContext);
}