import * as React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import LogInScreen from "../screens/LoginScreen/components/LogIn";
import LogIn from "../screens/LoginScreen/index";
// import RegisterScreen from "../screens/LoginScreen/components/Register";
import FirstScreen from "../screens/LoginScreen/components/FirstScreen";
import Walkthrough from "../screens/LoginScreen/components/FirstScreen/walkthrough";
// import SignUp from "../screens/LoginScreen/components/SignUp";
import ForgotPasswordScreen from "../screens/LoginScreen/components/ForgotPassword";

const Stack = createStackNavigator();

const LoginNav = () => {
  return (
    <Stack.Navigator
      initialRouteName="Walkthrough"
      //screenOptions={{ headerShown: false }}
    >
      <Stack.Screen
        name={"FirstScreen"}
        component={FirstScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"Walkthrough"}
        component={Walkthrough}
        options={{ headerShown: false }}
      />
      {/* <Stack.Screen
        name={"SignUp"}
        component={SignUp}
        options={{ headerShown: false }}
      /> */}
      <Stack.Screen
        name={"LogIn"}
        component={LogIn}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={"LogInScreen"}
        component={LogInScreen}
        options={{ headerShown: false }}
      />
      {/* <Stack.Screen
        name={"RegisterScreen"}
        component={RegisterScreen}
        options={{ headerShown: false }}
      /> */}
      <Stack.Screen
        name={"ForgotPasswordScreen"}
        component={ForgotPasswordScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default LoginNav;
