import React from "react";
import { View, Text, Image, Pressable } from "react-native";
import Logo from "../../imgs/BarnacleAI-1200-600.png";
import Swimmers from "../../imgs/underwater_astro.png";
import { useNavigation } from "@react-navigation/native";
import LoginNav from "../../navigation/LoginNav";

const LogIn = () => {
  const navigation = useNavigation();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#8930D5",
        paddingVertical: 50,
        paddingHorizontal: 25,
        alignItems: "center",
      }}
    >
      <Image
        source={Logo}
        width={300}
        height={150}
        style={{ width: 300, height: 150, resizeMode: "contain" }}
      />
      <Image
        source={Swimmers}
        width={300}
        height={150}
        style={{
          width: 400,
          height: 200,
          resizeMode: "contain",
          marginTop: 70,
        }}
      />
      <Pressable
        onPress={() => navigation.navigate("RegisterScreen")}
        style={{
          marginTop: 35,
          backgroundColor: "#CC94F7",
          paddingVertical: 15,
          paddingHorizontal: 70,
          borderRadius: 35,
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
        <Text
          style={{
            color: "white",
            fontFamily: "Poppins",
            fontWeight: 700,
            fontSize: 25,
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
          Sign up
        </Text>
      </Pressable>
      <Pressable
        onPress={() => navigation.navigate("LogInScreen")}
        style={{
          marginTop: 35,
          backgroundColor: "#b34eef",
          paddingVertical: 15,
          paddingHorizontal: 75,
          borderRadius: 35,
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
        <Text
          style={{
            color: "white",
            fontFamily: "Poppins",
            fontWeight: 700,
            fontSize: 25,
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
    </View>
  );
};

export default LogIn;
