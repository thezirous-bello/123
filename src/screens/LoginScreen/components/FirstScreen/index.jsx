import React from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ImageBackground,
  Dimensions
} from "react-native";
import Logo from "../../../../imgs/logo.png";
import bg from "../../../../imgs/bgimg.png";
import graphicStarterScreen from "../../../../imgs/graphicStarterScreen.png";
import Constants from "expo-constants";
import Swimmers from "../../../../imgs/underwater_astro.png";
import { useNavigation } from "@react-navigation/native";
import LogInScreen from "../LogIn";
const screenWidth = Dimensions.get("window").width;
const screenHeight = Dimensions.get("window").height;


const FirstScreen = () => {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <ImageBackground source={bg} style={styles.image}>
        <Text
          style={{
            fontFamily: "Poppins_800ExtraBold",
            fontWeight: 800,
            color: "white",
            fontSize: 35,
            paddingBottom: screenHeight/9,
            textTransform: "uppercase",
          }}
        >
          Barnacle <Text style={{ color: "#b51bd4" }}>AI</Text>
        </Text>
        <Image
          source={graphicStarterScreen}
          height={200}
          style={{
            width: screenHeight/3,
            height: screenHeight/5,
            resizeMode: "contain",
            alignSelf: "center",
          }}
        />
        <View
          style={{
            paddingTop: screenHeight/10,
            textAlign: "center",
            alignSelf: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "Poppins_700Bold",
              fontWeight: 700,
              color: "white",
              fontSize: 25,
            }}
          >
            The next generation of{" "}
            <Text style={{ color: "#b51bd4" }}>
              trading Insights and analysis.
            </Text>
          </Text>
          <Text
            style={{
              color: "#C1BDBD",
              paddingTop: 20,
              fontSize: 14,
              fontFamily: "Poppins_500Medium",
              fontWeight: 500,
            }}
          >
            Barnacle AI provides real-time and accurate sentiment & technical
            analysis of cryptocurrencies,
          </Text>
          <Pressable
            style={{
              backgroundColor: "#98188D",
              borderRadius: 12,
              alignItems: "center",
              padding: 15,
              marginTop: 40,
            }}
            onPress={() => navigation.navigate("SignUp")}
          >
            <Text
              style={{
                color: "white",
                fontFamily: "Poppins_600SemiBold",
                fontWeight: 700,
                fontSize: 19,
              }}
            >
              Get Started
            </Text>
          </Pressable>
        </View>
      </ImageBackground>
    </View>
  );
};

export default FirstScreen;

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
