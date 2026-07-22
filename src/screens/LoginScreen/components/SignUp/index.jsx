// import React, { useState } from "react";
// import {
//   View,
//   Text,
//   Image,
//   Pressable,
//   TextInput,
//   ImageBackground,
//   StyleSheet,
//   Alert
// } from "react-native";
// import bg from "../../../../imgs/bgimg.png";
// import Logo from "../../../../imgs/BarnacleAI-1200-600.png";
// import Swimmers from "../../../../imgs/underwater_astro.png";
// import { useNavigation } from "@react-navigation/native";
// import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
// import auth from '@react-native-firebase/auth';

// const SignUp = () => {
//   const navigation = useNavigation();
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(true);


//   const performLogin = async () => {
//     if (email !== "enter your username") {
//       if (password !== "enter your password") {
//         try{
//           await auth().signInWithEmailAndPassword(email, password);
//         }catch(error){
//           console.error("Error signing in user:", error);
//         }
//       }
//     }
//   };
//   const registerUser = async () => {
//     if (email && password) {
//       //console.log(email + " : " + password);
//       try {
//         await auth().createUserWithEmailAndPassword(email, password);
//         await performLogin();
//         await auth().currentUser.sendEmailVerification(email);
//         await auth().signOut();
//         console.log("User registered successfully!");

//         Alert.alert(
//           "Confirm User",
//           "An email has been sent to you in order to confirm your email. Once confirmed, navigate to the log in screen",
//           [
//             { text: "OK", onPress: () => console.log("OK Pressed") }
//           ]
//         );
//         //performLogin();
//       } catch (error) {
//         console.error("Error registering user:", error);
//         // Alert.alert(
//         //   "Error",
//         //   error.toString(),
//         //   [
//         //     { text: "OK", onPress: () => console.log("OK Pressed") }
//         //   ]
//         // );
//       }
//     }
//   };

//   const changeEmailValue = (value) => {
//     setEmail(value.toString());
//   };
//   const changePassValue = (value) => {
//     setPassword(value.toString());
//   };
//   return (
//     <ImageBackground source={bg} style={styles.image}>
//       <View
//         style={{
//           flex: 1,
//           paddingVertical: 0,
//           paddingHorizontal: 25,
//           alignItems: "center",
//         }}
//       >
//         <Image
//           source={Logo}
//           style={{ width: 250, height: 100, resizeMode: "contain" }}
//         />
//         <Text
//           style={{
//             fontSize: 18,
//             fontFamily: "Poppins_400Regular",
//             fontWeight: 400,
//             color: "white",
//           }}
//         >
//           Create an account to access your account on your device ;)
//         </Text>
//         <View style={{ marginTop: 40 }}>
//           <Text
//             style={{
//               fontSize: 20,
//               fontWeight: 700,
//               color: "white",
//               alignSelf: "flex-start",
//               fontFamily: "Poppins_400Regular",
//               marginBottom: 15,
//               textTransform: "uppercase",
//             }}
//           >
//             Sign up!
//           </Text>

//           <Text
//             style={{
//               color: "white",
//               fontFamily: "Poppins_400Regular",
//               fontSize: 13,
//               marginBottom: 7,
//             }}
//           >
//             Email Address
//           </Text>
//           <TextInput
//             style={{
//               backgroundColor: "rgba(255,255,255,0.2)",
//               borderRadius: 15,
//               paddingVertical: 15,
//               borderColor: "white",
//               borderWidth: 1,
//               paddingHorizontal: 20,
//               color: "white",
//               width: 300,
//             }}
//             multiline={false}
//             placeholder="enter your email"
//             placeholderTextColor={"white"}
//             value={email}
//             onChangeText={changeEmailValue}
//           />

//           <Text
//             style={{
//               color: "white",
//               fontFamily: "Poppins_400Regular",
//               fontSize: 13,
//               marginBottom: 7,
//               marginTop: 20,
//             }}
//           >
//             Password
//           </Text>
//           <View style={{width: 300, display:'flex', flexDirection: 'row', alignItems: 'center',borderColor: "white",
//               borderWidth: 1,backgroundColor: "rgba(255,255,255,0.2)",borderRadius: 15,}}>
//           <TextInput
//             style={{
              
//               paddingVertical: 15,
//               fontFamily: "Poppins_400Regular",
//               paddingHorizontal: 20,
//               color: "white",
//               width: 250,
//             }}
//             placeholder="enter your password"
//             secureTextEntry={showPassword}
//             multiline={false}
//             placeholderTextColor={"white"}
//             value={password}
//             onChangeText={changePassValue}
//           />
//           <Pressable onPress={() => setShowPassword(!showPassword)}>{showPassword ? <FontAwesome5 name="eye" size={24} color="white" /> : <FontAwesome5 name="eye-slash" size={24} color="white" />}</Pressable>
//           </View>
//           <Text
//             style={{
//               color: "white",
//               fontFamily: "Poppins_400Regular",
//               fontSize: 10,
//               marginBottom: 7,
//               marginTop: 6,
//               alignSelf: "center",
//             }}
//           >
//             At least 6 characters: numbers and letters
//           </Text>
//           <Pressable
//             onPress={() => registerUser()}
//             style={{
//               marginTop: 35,
//               backgroundColor: "#98188D",
//               borderRadius: 12,
//               alignItems: "center",
//               padding: 15,
//             }}
//           >
//             <Text
//               style={{
//                 color: "white",
//                 alignSelf: "center",
//                 fontFamily: "Poppins_500Medium",
//                 fontWeight: 500,
//                 fontSize: 25,
//                 shadowColor: "#000000",
//                 shadowOffset: {
//                   width: 0,
//                   height: 12,
//                 },
//                 shadowOpacity: 0.23,
//                 shadowRadius: 12.81,
//                 elevation: 16,
//               }}
//             >
//               Sign Up
//             </Text>
//           </Pressable>
//           <Text
//             style={{
//               marginTop: 8,
//               marginBottom: 8,
//               color: "white",
//               alignSelf: "center",
//               fontFamily: "Poppins_500Medium",
//               fontWeight: 500,
//               fontSize: 25,
//               shadowColor: "#000000",
//               shadowOffset: {
//                 width: 0,
//                 height: 12,
//               },
//               shadowOpacity: 0.23,
//               shadowRadius: 12.81,
//               elevation: 16,
//             }}
//           >
//             Or
//           </Text>
//           <Pressable
//             onPress={() => navigation.navigate("LogInScreen")}
//             style={{ flexDirection: "row", marginTop: 15, alignSelf: "center" }}
//           >
//             <Text
//               style={{
//                 color: "white",
//                 fontFamily: "Poppins_400Regular",
//                 fontSize: 10,
//               }}
//             >
//               Have an account already?
//             </Text>
//             <Text
//               style={{
//                 textDecorationLine: "underline",
//                 color: "white",
//                 fontFamily: "Poppins_500Medium",
//                 fontSize: 10,
//                 marginLeft: 10,
//                 fontWeight: 500,
//               }}
//             >
//               Log in!
//             </Text>
//           </Pressable>
//         </View>
//       </View>
//     </ImageBackground>
//   );
// };

// export default SignUp;

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     flexDirection: "column",
//   },
//   image: {
//     flex: 1,
//     resizeMode: "cover",
//     paddingVertical: 50,
//     paddingHorizontal: 30,
//     // justifyContent: "center",
//   },
//   text: {
//     color: "white",
//     fontSize: 42,
//     fontWeight: "bold",
//     textAlign: "center",
//     backgroundColor: "#000000a0",
//   },
// });
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
  Modal,
  TouchableOpacity
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import auth from '@react-native-firebase/auth';
import LoadingFullScreen from "../../../../components/LoadingFullScreen";

const SignUp = () => {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isChecked, setIsChecked] = useState(false);

  const performLogin = async () => {
    if (email !== "enter your username" && password !== "enter your password") {
      try {
        await auth().signInWithEmailAndPassword(email, password);
      } catch (error) {
        console.error("Error signing in user:", error.message);
      }
    }
  };

  const registerUser = async () => {
    if (email && password) {
      setLoading(true)
      if(isChecked){      
        try {
          await auth().createUserWithEmailAndPassword(email, password);
          await performLogin();
          await auth().currentUser.sendEmailVerification();
          await auth().signOut();
          console.log("User registered successfully!");
          setLoading(false)
          Alert.alert(
            "Confirm User",
            "An email has been sent to you for confirmation. Once confirmed, navigate to the login screen.",
            [
              {
                text: "OK",
                onPress: () => navigation.navigate("LogInScreen")
              }
            ]
          );        
        } catch (error) {
          console.error("Error registering user:", error.message);
          setLoading(false)
          Alert.alert("Error", error.message, [{ text: "OK" }]);
        }
      }else{
        setLoading(false)
        Alert.alert("Error ", "Please accept the dislcaimer.", [{ text: "OK" }]);
      }
    }
  };

  const changeEmailValue = (value) => setEmail(value);
  const changePassValue = (value) => setPassword(value);

  return (
    !loading ?
    <ImageBackground source={require("../../../../imgs/bgimg.png")} style={styles.image}>
      <ScrollView contentContainerStyle={styles.innerContainer}>
        <Image
          source={require("../../../../imgs/BarnacleAI-1200-600.png")}
          style={styles.logo}
        />
        <Text style={styles.createAccountText}>
          Create an account to access your account on your device ;)
        </Text>
        <View style={styles.formContainer}>
          <Text style={styles.label}>Sign up!</Text>

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="enter your email"
            placeholderTextColor="white"
            value={email}
            onChangeText={changeEmailValue}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="enter your password"
              secureTextEntry={showPassword}
              placeholderTextColor="white"
              value={password}
              onChangeText={changePassValue}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)}>
              <FontAwesome5
                name={showPassword ? "eye" : "eye-slash"}
                size={24}
                color="white"
              />
            </Pressable>
          </View>

          <Text style={styles.passwordHint}>
            At least 6 characters: numbers and letters
          </Text>
          <View style={styles.checkcontainer}>
              <Pressable 
                  style={[styles.checkbox, isChecked && styles.checked]} 
                  onPress={() => setIsChecked(!isChecked)}
              >
                  {isChecked && <Text style={styles.checkmark}>✔</Text>}
              </Pressable>
              <Pressable onPress={() => setIsModalVisible(true)}>
                <Text style={styles.checkLabel}>
                    Accept disclaimer*
                </Text>
              </Pressable>
          </View>
          <Modal
                visible={isModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalText}>
                            ⚠️ Disclaimer {'\n'}{'\n'}
                            📉 Not Financial Advice {'\n'}{'\n'}
                            The trades and strategies shared within this app are not financial advice. They represent trades that we execute based on various AI-driven indicators and market analysis. {'\n'}{'\n'}
                            🚀 Follow at Your Own Risk {'\n'}{'\n'}
                            If you choose to follow our trades or strategies, you do so at your own risk. Market conditions can change rapidly, and trading involves significant risk of loss. {'\n'}{'\n'}
                            🧠 Informed Decision-Making {'\n'}{'\n'}
                            We encourage you to conduct your own research, understand the indicators mentioned in AI Insights, and make decisions that align with your financial goals and risk tolerance. {'\n'}
                        </Text>
                        <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
          <Pressable onPress={registerUser} style={styles.signUpButton}>
            <Text style={styles.signUpButtonText}>Sign Up</Text>
          </Pressable>

          <Text style={styles.orText}>Or</Text>
          <Pressable
            onPress={() => navigation.navigate("LogInScreen")}
            style={styles.loginLink}
          >
            <Text style={styles.loginText}>Have an account already?</Text>
            <Text style={styles.loginLinkText}>Log in!</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ImageBackground>
    : <LoadingFullScreen spinnerSource={require('../../../../imgs/ngjyra.png')} backgroundSource={require('../../../../imgs/back that.png')}/>
  );
};

export default SignUp;

const styles = StyleSheet.create({
  image: {
    flex: 1,
    resizeMode: "cover",
    paddingVertical: 50,
    paddingHorizontal: 30,
  },
  innerContainer: {
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
  createAccountText: {
    fontSize: 18,
    fontFamily: "Poppins_400Regular",
    fontWeight: "400",
    color: "white",
    textAlign: "center",
    marginVertical: 15,
  },
  formContainer: {
    marginTop: 40,
    width: "100%",
  },
  label: {
    color: "white",
    fontFamily: "Poppins_400Regular",
    fontSize: 13,
    marginBottom: 7,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
    color: "white",
    borderColor: "white",
    borderWidth: 1,
    //width: 300,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: "white",
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 15,
    //width: 500,
    paddingHorizontal: 15,
  },
  passwordInput: {
    color: "white",
    fontFamily: "Poppins_400Regular",
    paddingVertical: 15,
    paddingHorizontal: 5,
    flex: 1,
  },
  passwordHint: {
    color: "white",
    fontFamily: "Poppins_400Regular",
    fontSize: 10,
    marginVertical: 6,
    textAlign: "center",
  },
  signUpButton: {
    marginTop: 10,
    backgroundColor: "#98188D",
    borderRadius: 12,
    alignItems: "center",
    padding: 15,
  },
  signUpButtonText: {
    color: "white",
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
  },
  orText: {
    marginVertical: 8,
    color: "white",
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    textAlign: "center",
  },
  loginLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 15,
  },
  loginText: {
    color: "white",
    fontFamily: "Poppins_400Regular",
    fontSize: 16,
  },
  loginLinkText: {
    color: "white",
    fontFamily: "Poppins_500Medium",
    fontSize: 16,
    marginLeft: 10,
    textDecorationLine: "underline",
  },
  checkcontainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center'
},
  checkbox: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: '#007bff',
      borderRadius: 5,
      justifyContent: 'center',
      alignItems: 'center',
  },
  checked: {
      backgroundColor: '#007bff',
  },
  checkmark: {
      color: '#fff',
      fontSize: 13,
  },
  checkLabel: {
      marginLeft: 10,
      fontSize: 13,
      color: '#fff',
      textDecorationLine: 'underline'
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    maxWidth: 300,
    alignItems: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
  },
  closeText: {
    color: 'blue',
    fontWeight: 'bold',
  },
});
