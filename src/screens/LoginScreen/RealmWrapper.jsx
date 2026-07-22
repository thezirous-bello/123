import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { ActivityIndicator } from "react-native";
import LoginNav from "../../navigation/LoginNav";
import AppMain from "../../../AppMain";
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";

const RealmWrapper = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState(null);
  const [theUser, setTheUser] = useState();

  const onAuthStateChanged = (user) => {
    setUser(user);
    if(initializing) setInitializing(false);
  }



  useEffect(() => {
    
    const subscriber = auth().onAuthStateChanged(onAuthStateChanged);
    return subscriber;

  }, []);

  useEffect(() => {
    if(initializing) return;

    if(user){
      setTheUser(auth().currentUser.emailVerified);
    }
  },[user, initializing])

  if(initializing){
    return <ActivityIndicator size={'large'} color={'white'}/>
  }

  return user && theUser && !initializing ? (
      <AppMain />
  ) : (
    <LoginNav />
  );
};

export default RealmWrapper;
