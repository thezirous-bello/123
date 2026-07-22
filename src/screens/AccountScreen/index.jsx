import React, { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, TouchableOpacity, TextInput,ImageBackground, Image, Switch, ActivityIndicator, Alert } from "react-native";
import { getUserInfo, updateNotificationToken, updateNotificationFlag, deleteUserData, handleNotificationTokenUpdate, handleSubscriptionStatusUpdate } from "../../services/requests";
import accountDefault from '../../imgs/accountDefault.png';
import { Feather, FontAwesome, AntDesign, MaterialCommunityIcons, FontAwesome5, Ionicons } from '@expo/vector-icons';
import { ScrollView, GestureHandlerRootView } from "react-native-gesture-handler";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import auth from '@react-native-firebase/auth';
import Purchases from "react-native-purchases";
import * as Notifications from 'expo-notifications';
import { usePushNotifications } from "../HomeScreen/notifications";
import { usePushNotifications as usePromptForNotifications } from "./promptForNotifications";
import { Platform, Linking } from 'react-native';
import LoadingFullScreen from "../../components/LoadingFullScreen";

const getUsernameFromEmail = (email) => {
  return email.replace(/@gmail\.com$/, '');
};

const AccountScreen = () => {
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 
  const user = auth().currentUser;
  const [isEnabled, setIsEnabled] = useState(true);
  const [isEnabledNoti, setIsEnabledNoti] = useState(true);
  const [userInfo, setUserInfo] = useState(null); // Initial state should be null or {} based on your data
  const navigation = useNavigation();
  const [purchaseInfo, setPurchaseInfo] = useState([]);
  const [loading, isLoading] = useState(false);
  const [notiToken, setNotiToken] = useState(null);
  const [notificationContainer, setNotificationContainer] = useState(false);
  const [notificationFlags, setNotificationFlags] = useState([]);

  // For account deletion
  const [modalVisible, setModalVisible] = useState(false);
  const [email, setEmail] = useState('');


  const fetchUserInfo = async () => {
    if (isLoggedIn && user?.email) {
      try {
        const info = await getUserInfo(user?.email, id, isLoggedIn);
        setUserInfo(info[0]);
      } catch (error) {
        console.error("Error fetching user info:", error);
      }
    }
  };

  const toggleSwitch = () => setIsEnabled(previousState => !previousState);
  // const toggleNotificationSwitch = async () => {
  //   if(userInfo.notificationToken != null){
  //     isLoading(true);
  //     await updateNotificationToken(user?.email, id, null, isLoggedIn);
  //     await fetchUserInfo();
  //     setIsEnabledNoti(previousState => !previousState)
  //     isLoading(false);
  //   }else{
  //     isLoading(true);
  //     const {expoPushToken, notification} = usePushNotifications();
  //     setNotiToken(expoPushToken)
  //     console.log(expoPushToken)
  //     await updateNotificationToken(user?.email, id, expoPushToken, isLoggedIn);
  //     await fetchUserInfo();
  //     isLoading(false);
  //   }

  // };
  // const { expoPushToken } = usePushNotifications(); // Call hook at top level
  const { expoPushToken, promptForNotifications } = usePromptForNotifications();

  const toggleNotificationFlagSwitch = async (flag) => {
    if (userInfo.notificationFlags && userInfo.notificationFlags[flag] != null) {
      isLoading(true);
      await updateNotificationFlag(user?.email, id, flag, isLoggedIn);
      await fetchUserInfo();
      isLoading(false);
    } else {
      isLoading(true);
      if (!expoPushToken) {
        alert("Failed to get push token. Please try again.");
        isLoading(false);
        return;
      }

      await updateNotificationFlag(user?.email, id, flag, isLoggedIn);
      await fetchUserInfo();
      isLoading(false);
    }
  };

  const toggleNotificationSwitch = async () => {
    if (userInfo.notificationToken != null) {
      isLoading(true);
      await updateNotificationToken(user?.email, id, null, isLoggedIn);
      await fetchUserInfo();
      setIsEnabledNoti((previousState) => !previousState);
      isLoading(false);
    } else {
      await promptForNotifications();
      isLoading(true);
      if (!expoPushToken) {
        alert("Failed to get push token. Please try again.");
        isLoading(false);
        return;
      }

      setNotiToken(expoPushToken); // Update state with new token
      console.log(expoPushToken);

      await updateNotificationToken(user?.email, id, expoPushToken?.data, isLoggedIn);
      await fetchUserInfo();
      isLoading(false);
    }
  };

  const manageSubscriptions = async () => {
    try {
      if (Platform.OS === 'ios') {
        // Open iOS subscription settings
        await Purchases.presentCodeRedemptionSheet();
      } else if (Platform.OS === 'android') {
        // Open Google Play subscription page
        const packageName = 'com.dinshpati.barnacleai';
        Linking.openURL(
          `https://play.google.com/store/account/subscriptions?package=${packageName}`
        );
      }
    } catch (error) {
      console.error("Failed to open subscription management:", error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      const getPurchaserInfo = async () => {
        try {
          const purchaserInfo = await Purchases.getCustomerInfo();
          setPurchaseInfo(purchaserInfo.activeSubscriptions[0]);
        } catch (e) {
          console.error("Error fetching purchaser info:", e);
        }
      };
  
      isLoading(true);
      getPurchaserInfo();
      fetchUserInfo();
      handleNotificationTokenUpdate(user?.email, id, expoPushToken?.data, isLoggedIn);
      handleSubscriptionStatusUpdate(user?.email, id, isLoggedIn);
      isLoading(false);
    }, [isLoggedIn, id, user?.email])
  );

  useEffect(() => {
    
    const getPurchaserInfo = async () => {
      try {
        const purchaserInfo = await Purchases.getCustomerInfo();
        setPurchaseInfo(purchaserInfo.activeSubscriptions[0]);
      } catch (e) {
        console.error("Error fetching purchaser info:", e);
      }
    };

    isLoading(true);
    getPurchaserInfo();

    fetchUserInfo();
    isLoading(false);
  }, [isLoggedIn, id, user?.email]);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account?',
      [
        {
          text: 'Cancel',
          onPress: () => console.log('Cancel Pressed'),
          style: 'cancel',
        },
        {
          text: 'OK',
          onPress: () => setModalVisible(true),
        },
      ],
      { cancelable: false },
    );
  };
  const handleConfirmDelete = () => {
    if (email.toLocaleLowerCase() === user.email.toLocaleLowerCase()) {
      deleteUserData(id, email, isLoggedIn);
      console.log("deleted: " + id)
      setModalVisible(false);
    } else {
      Alert.alert('Error', 'Email does not match');
    }
  };

  const handleNotificationContainer = () => {
    setNotificationContainer(!notificationContainer);
  }

  return (
    loading || !userInfo?
      <LoadingFullScreen spinnerSource={require('../../imgs/ngjyra.png')} backgroundSource={require('../../imgs/back that.png')}/>
    :
    <View style={{ padding: 30, flex: 1, paddingTop: 55 }}>
      <GestureHandlerRootView>
        <ScrollView>
          <TouchableOpacity style={{ display: 'flex', flexDirection: 'row' }} onPress={() => navigation.goBack()}>
            <Ionicons
            name="chevron-back-sharp"
            size={25}
            color="white"
            style={{marginRight: 5}}
            />
          </TouchableOpacity>
          <View style={{ marginTop: 10 }}>            
            {userInfo ? (
              <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14 }}>
                <View style={{ display: 'flex', flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10 }}>
                  <Image source={accountDefault} style={{ width: 50, height: 50, borderRadius: 50 }} />
                  <View style={{ marginLeft: 15 }}>
                    <Text style={{ fontFamily: 'Poppins_500Medium', color: 'white', fontSize: 24 }}>{getUsernameFromEmail(user?.email)}</Text>
                    <Text style={{ fontFamily: 'Poppins_400Regular', color: 'rgba(255, 255, 255, 0.8)', fontSize: 14 }}>{user?.email}</Text>
                  </View>
                </View>
                <View style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', height: 1 }}></View>
                <Pressable style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center' }} onPress={() => navigation.navigate('ManageSubscriptions')}>
                  <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16 }}>My Subscription</Text>
                  <View>
                    <Text style={{ fontFamily: 'Poppins_500Medium', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 18 }}>
                      {purchaseInfo ? purchaseInfo == 'rc_promo_Premium_custom' ? 'Free Trial >' : 'Premium >' : 'Free' + ' >'}
                    </Text>
                  </View>
                </Pressable>
                {
                  !purchaseInfo ?
                  <Pressable style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center' }} onPress={() => navigation.navigate(purchaseInfo ? 'ManageSubscriptions' : 'Subscriptions')}>
                    <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16 }}>See subscription options</Text>
                    <View>
                      <Text style={{ fontFamily: 'Poppins_500Medium', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 18 }}>
                        {'Buy >'}
                      </Text>
                    </View>
                  </Pressable>
                  :
                  <></>
                }
              </View>
            ) : (
              <ActivityIndicator size={"large"} />
            )}
          </View>
          <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontFamily: 'Poppins_400Regular', fontSize: 16, marginTop: 5 }}>App Settings</Text>
          
          {userInfo && !loading ? (
            <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14, marginVertical: 5 }}>
              <Pressable style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)' }}>
                <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16 }}>Language</Text>
                <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16 }}>{userInfo.language}</Text>
              </Pressable>
              <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)' }}>
                <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16 }}>Dark Mode</Text>
                <Switch
                  ios_backgroundColor="#3e3e3e"
                  onValueChange={toggleSwitch}
                  value={isEnabled}
                />
              </View>
              <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)' }}>
                <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16 }}>Notifications</Text>
                <Switch
                  ios_backgroundColor="#3e3e3e"
                  onValueChange={toggleNotificationSwitch}
                  value={userInfo?.notificationToken != null ? true : false}
                />
              </View>
              {
                userInfo?.notificationToken != null ?
                <View>
                  <TouchableOpacity onPress={() => handleNotificationContainer()} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)' }}>
                    <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16}}>Notification Options</Text>
                    {
                      notificationContainer && userInfo?.notificationFlag ?
                      <AntDesign name="upcircleo" size={20} color="white" />
                      :
                      <AntDesign name="downcircle" size={20} color="white" />

                    }
                  </TouchableOpacity>
                  {notificationContainer && userInfo?.notificationFlag ?
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingLeft: 15 }}>
                    <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)' }}>
                      <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16 }}>Urgent News</Text>
                      <Switch
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={() => toggleNotificationFlagSwitch('news')}
                        value={userInfo?.notificationFlag?.news}
                      />
                    </View>
                    <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)' }}>
                      <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16 }}>Economic News</Text>
                      <Switch
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={() => toggleNotificationFlagSwitch('financials')}
                        value={userInfo?.notificationFlag?.financials}
                      />
                    </View>
                    <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)' }}>
                      <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16 }}>Signals</Text>
                      <Switch
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={() => toggleNotificationFlagSwitch('signals')}
                        value={userInfo?.notificationFlag?.signals}
                      />
                    </View>
                  </View>
                  : <></>
                }
                </View>
                :
                <></>
              }
              <Pressable style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16 }}>Preferred Currency</Text>
                <View>
                  <Text style={{ fontFamily: 'Poppins_500Medium', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 18 }}>
                    USD
                  </Text>
                </View>
              </Pressable>
            </View>
          ) : (
            <ActivityIndicator size={"large"} />
          )}

          <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontFamily: 'Poppins_400Regular', fontSize: 16, marginTop: 5 }}>Tools</Text>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14, marginVertical: 5 }}>
            <Pressable style={{ display: 'flex', flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)' }} onPress={() => navigation.navigate('WatchListScreen')}>
              <Feather name="bookmark" size={24} color="rgba(255, 255, 255, 0.8)" />
              <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, marginLeft: 5 }}>Favorites</Text>
            </Pressable>
            {/* <Pressable style={{ display: 'flex', flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)' }}>
              <FontAwesome name="calculator" size={24} color="rgba(255, 255, 255, 0.8)" />
              <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, marginLeft: 5 }}>Calculator</Text>
            </Pressable> */}
            <Pressable style={{ display: 'flex', flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center' }} onPress={() => navigation.navigate('WebViewScreen', { url: 'https://barnacleai.com' })}>
              <AntDesign name="exclamationcircle" size={24} color="rgba(255, 255, 255, 0.8)" />
              <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, marginLeft: 5 }}>Need help? Contact us!</Text>
            </Pressable>
          </View>
          <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontFamily: 'Poppins_400Regular', fontSize: 16, marginTop: 5 }}>Web & Social Media</Text>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14, marginVertical: 5 }}>
            <Pressable style={{ display: 'flex', flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)' }} onPress={() => navigation.navigate('WebViewScreen', { url: 'https://barnacleai.com' })}>
              <MaterialCommunityIcons name="web" size={24} color="rgba(255, 255, 255, 0.8)" />
              <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, marginLeft: 5 }}>barnacleai.com</Text>
            </Pressable>
            <Pressable style={{ display: 'flex', flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)' }} onPress={() => navigation.navigate('WebViewScreen', { url: 'https://x.com/Barnacle_AI' })}>
              <FontAwesome name="twitter" size={24} color="rgba(255, 255, 255, 0.8)" />
              <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, marginLeft: 5 }}>@barnacle_ai</Text>
            </Pressable>
            <Pressable style={{ display: 'flex', flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center' }} onPress={() => navigation.navigate('WebViewScreen', { url: 'https://www.instagram.com/barnacleai/#' })}>
              <FontAwesome5 name="instagram" size={24} color="rgba(255, 255, 255, 0.8)" />
              <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, marginLeft: 5 }}>@barnacleai</Text>
            </Pressable>
          </View>
          <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontFamily: 'Poppins_400Regular', fontSize: 16, marginTop: 5 }}>Privacy & Disclaimer</Text>
          <View style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 14, marginVertical: 5 }}>
              <Pressable style={{ display: 'flex', flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(255, 255, 255, 0.8)'  }} onPress={() => navigation.navigate('WebViewScreen', { url: 'https://www.barnacleai.com/privacypolicy.html' })}>
              {/* <FontAwesome5 name="instagram" size={24} color="rgba(255, 255, 255, 0.8)" /> */}
              <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, marginLeft: 5 }}>Privacy Policy</Text>
              </Pressable>
              <Pressable style={{ display: 'flex', flexDirection: 'row', paddingHorizontal: 15, paddingVertical: 10, alignItems: 'center' }} onPress={() => navigation.navigate('WebViewScreen', { url: 'https://www.barnacleai.com/disclaimer.html' })}>
              {/* <FontAwesome5 name="instagram" size={24} color="rgba(255, 255, 255, 0.8)" /> */}
              <Text style={{ fontFamily: 'Poppins_500Medium', color: 'rgba(255, 255, 255, 0.8)', fontSize: 16, marginLeft: 5 }}>Disclaimer</Text>
              </Pressable>
            </View>

          <Pressable
            style={{
              backgroundColor: "#000",
              borderRadius: 12,
              alignItems: "center",
              padding: 10,
              marginTop: 10,
              marginBottom: 20
            }}
            onPress={async () => {
              await toggleNotificationSwitch();
              await auth().signOut();
            }}
            // onPress={() => auth().signOut()}
          >
            <Text
              style={{
                color: "white",
                fontFamily: "Poppins_600SemiBold",
                fontWeight: 700,
                fontSize: 19,
              }}
            >
              Sign Out
            </Text>
          </Pressable>
          <View>
            <Pressable onPress={handleDeleteAccount}
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.2)",
              borderRadius: 12,
              alignItems: "center",
              padding: 10,
              marginBottom: 60,
              borderColor: 'white',
              borderWidth: 1
            }}
            >
              <Text style={{ color: "red", fontFamily: "Poppins_600SemiBold", fontWeight: 700, fontSize: 17 }}>Delete Account</Text>
            </Pressable>
            <Modal
              animationType="slide"
              transparent={true}
              visible={modalVisible}
              onRequestClose={() => {
                setModalVisible(false);
              }}
            >
              <View style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                
              }}>
                <View
                  style={{
                    backgroundColor: 'white',
                    borderRadius: 10,
                    padding: 20,
                    width: '80%',
                  }}
                >
                  <TextInput
                    value={email}
                    onChangeText={(text) => setEmail(text)}
                    placeholder="Enter your email"
                    style={{
                      height: 40,
                      borderColor: 'gray',
                      borderWidth: 1,
                      marginBottom: 10,
                      padding: 10,
                      borderRadius: 25
                    }}
                  />
                  <Pressable onPress={handleConfirmDelete} 
                  style={{
                      backgroundColor: 'red',
                      padding: 10,
                      borderRadius: 25,
                      textAlign: 'center',
                      alignContent: 'center',
                    }}>
                    <Text style={{
            color: 'white',
            textAlign: 'center',  
            fontSize: 16,
            fontFamily: 'Poppins_600SemiBold',
          }}>Confirm Delete</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
        </View>
        </ScrollView>
      </GestureHandlerRootView>
    </View>
  );
};

export default AccountScreen;
