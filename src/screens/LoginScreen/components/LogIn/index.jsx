import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  ImageBackground,
  StyleSheet,
  Alert,
  ScrollView,
  Keyboard, TouchableWithoutFeedback
} from "react-native";
import Logo from "../../../../imgs/BarnacleAI-1200-600.png";
import Swimmers from "../../../../imgs/underwater_astro.png";
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useNavigation } from "@react-navigation/native";
import auth from '@react-native-firebase/auth';

import bg from "../../../../imgs/bgimg.png";

const LogInScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false);

  const performLogin = async () => {
    if (email !== "enter your username") {
      if (password !== "enter your password") {
        // setLoading(false)
        try{
          const formattedEmail = email.replace(/\s/g, '');
          await auth().signInWithEmailAndPassword(formattedEmail, password);
        }catch(error){
          console.error("Error signing in user:", error);
          // setLoading(false)
          setError(true);
          Alert.alert(
            "Confirm User",
            error.toString(),
            [
              { text: "OK", onPress: () => console.log("OK Pressed") }
            ]
          );
        }
      }
    }
  };

  const changeEmailValue = (value) => {
    setEmail(value);
  };
  const changePassValue = (value) => {
    setPassword(value);
  };

  return (
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
      <ImageBackground source={bg} style={styles.image}>
        <ScrollView
          contentContainerStyle={{
            flex: 1,
            paddingVertical: 0,
            paddingHorizontal: 25,
            alignItems: "center",
          }}
        >
          <Image
            source={Logo}
            style={{ width: 250, height: 100, resizeMode: "contain" }}
          />
          <Text
            style={{
              fontSize: 18,
              fontFamily: "Poppins_400Regular",
              fontWeight: 400,
              color: "white",
            }}
          >
            Log into your existing account and start investing like a pro!
          </Text>
          <View style={{ marginTop: 40 }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "white",
                alignSelf: "flex-start",
                fontFamily: "Poppins_400Regular",
                marginBottom: 15,
                textTransform: "uppercase",
              }}
            >
              Log In!
            </Text>
            <Text
              style={{
                color: "white",
                fontFamily: "Poppins_400Regular",
                fontSize: 13,
                marginBottom: 7,
              }}
            >
              Email Address
            </Text>
            <TextInput
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: 15,
                paddingVertical: 15,
                borderColor: "white",
                borderWidth: 1,
                paddingHorizontal: 20,
                color: "white",
                //width: 300,
              }}
              multiline={false}
              placeholderTextColor={"white"}
              placeholder="enter your email"
              value={email}
              onChangeText={changeEmailValue}
            />
            <Text
              style={{
                color: "white",
                fontFamily: "Poppins_400Regular",
                fontSize: 13,
                marginBottom: 7,
                marginTop: 20,
              }}
            >
              Password
            </Text>
            <View style={{width: 300, display:'flex', flexDirection: 'row', alignItems: 'center', justifyContent:'space-between',borderColor: "white",
                borderWidth: 1,backgroundColor: "rgba(255,255,255,0.2)",borderRadius: 15,}}>
            <TextInput
              style={{
                paddingVertical: 15,
                fontFamily: "Poppins_400Regular",
                paddingHorizontal: 20,
                color: "white",
                //width: 250,
              }}
              placeholder="enter your password"
              secureTextEntry={showPassword}
              multiline={false}
              placeholderTextColor={"white"}
              value={password}
              onChangeText={changePassValue}
            />
            <Pressable style={{marginRight: 15}} onPress={() => setShowPassword(!showPassword)}>{showPassword ? <FontAwesome5 name="eye" size={24} color="white" /> : <FontAwesome5 name="eye-slash" size={24} color="white" />}</Pressable>
            </View>
            <Pressable
              onPress={() => performLogin()}
              style={{
                marginTop: 20,
                backgroundColor: "#98188D",
                borderRadius: 12,
                alignItems: "center",
                padding: 15,
              }}
            >
              <Text
                style={{
                  color: "white",
                  alignSelf: "center",
                  fontFamily: "Poppins",
                  fontWeight: 700,
                  fontSize: 16,
                  shadowColor: "#000000",
                  shadowOffset: {
                    width: 0,
                    height: 12,
                  },
                  shadowOpacity: 0.23,
                  shadowRadius: 12.81,
                  elevation: 16,
                }}
              >
                Log in
              </Text>
            </Pressable>
            {error ? 
            <Text style={{
              color: "red",
              fontFamily: "Poppins_400Regular",
              fontSize: 12,
              marginTop: 10,
              alignSelf: "center",
            }}>{error}</Text>
            : <></>
          }
            <Pressable onPress={()=>navigation.navigate("ForgotPasswordScreen")}>
              <Text style={{
                color: "white",
                fontFamily: "Poppins_400Regular",
                fontSize: 16,
                marginTop: 10,
                alignSelf: "center",
                textDecorationLine:'underline'
              }}>Forgot Password?</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate("SignUp")}
              style={{ flexDirection: "row", marginTop: 15, alignSelf: "center" }}
            >
              <Text
                style={{
                  color: "white",
                  fontFamily: "Poppins_400Regular",
                  fontSize: 16,
                }}
              >
                Dont have a account?
              </Text>
              <Text
                style={{
                  textDecorationLine: "underline",
                  color: "white",
                  fontFamily: "Poppins_500Medium",
                  fontSize: 16,
                  marginLeft: 10,
                  fontWeight: 500,
                }}
              >
                Sign Up!
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </ImageBackground>
    </TouchableWithoutFeedback>
  );
};

export default LogInScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
  },
  image: {
    flex: 1,
    resizeMode: "cover",
    paddingVertical: 50,
    paddingHorizontal: 30,
    // justifyContent: "center",
  },
  text: {
    color: "white",
    fontSize: 42,
    fontWeight: "bold",
    textAlign: "center",
    backgroundColor: "#000000a0",
  },
});
