import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  ImageBackground,
  StyleSheet,
  Alert
} from "react-native";
import Logo from "../../../../imgs/BarnacleAI-1200-600.png";
import bg from "../../../../imgs/bgimg.png";
import { useNavigation } from "@react-navigation/native";
import auth from '@react-native-firebase/auth';

const ForgotPasswordScreen = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const performPasswordReset = async () => {
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    try {
      await auth().sendPasswordResetEmail(email);
      Alert.alert(
        "Password Reset",
        "If an account with that email exists, we have sent the password reset instructions.",
        [{ text: "OK", onPress: () => navigation.navigate('LogInScreen') }]
      );
    } catch (e) {
      console.error(e);
      setError("Failed to send password reset email. Please try again.");
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  return (
    <ImageBackground source={bg} style={styles.image}>
      <View style={styles.container}>
        <Image source={Logo} style={styles.logo} />
        <Text style={styles.headerText}>
          Forgot your password? Let's get that fixed!
        </Text>
        <View style={styles.formContainer}>
          <Text style={styles.title}>Forgot Password</Text>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholderTextColor={"white"}
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
          />
          <Pressable
            onPress={performPasswordReset}
            style={styles.button}
          >
            <Text style={styles.buttonText}>Reset Password</Text>
          </Pressable>
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}
          <Pressable
            onPress={() => navigation.navigate("SignUp")}
            style={styles.signUpLink}
          >
            <Text style={styles.signUpText}>
              Don't have an account?
            </Text>
            <Text style={styles.signUpLinkText}>
              Sign Up!
            </Text>
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 0,
    paddingHorizontal: 25,
    alignItems: "center",
  },
  logo: {
    width: 250,
    height: 100,
    resizeMode: "contain",
  },
  headerText: {
    fontSize: 18,
    fontFamily: "Poppins_400Regular",
    fontWeight: "400",
    color: "white",
  },
  formContainer: {
    marginTop: 40,
    width: "100%",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "white",
    alignSelf: "flex-start",
    fontFamily: "Poppins_400Regular",
    marginBottom: 15,
    textTransform: "uppercase",
  },
  label: {
    color: "white",
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    marginBottom: 7,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 15,
    paddingVertical: 15,
    borderColor: "white",
    borderWidth: 1,
    paddingHorizontal: 20,
    color: "white",
    width: "100%",
  },
  button: {
    marginTop: 20,
    backgroundColor: "#98188D",
    borderRadius: 12,
    alignItems: "center",
    padding: 15,
  },
  buttonText: {
    color: "white",
    alignSelf: "center",
    fontFamily: "Poppins",
    fontWeight: "700",
    fontSize: 25,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.23,
    shadowRadius: 12.81,
    elevation: 16,
  },
  errorText: {
    color: "red",
    fontFamily: "Poppins_400Regular",
    fontSize: 12,
    marginTop: 10,
    alignSelf: "center",
  },
  signUpLink: {
    flexDirection: "row",
    marginTop: 15,
    alignSelf: "center",
  },
  signUpText: {
    color: "white",
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
  },
  signUpLinkText: {
    textDecorationLine: "underline",
    color: "white",
    fontFamily: "Poppins_500Medium",
    fontSize: 10,
    marginLeft: 10,
    fontWeight: "500",
  },
  image: {
    flex: 1,
    resizeMode: "cover",
    paddingVertical: 50,
    paddingHorizontal: 30,
  },
});

export default ForgotPasswordScreen;
