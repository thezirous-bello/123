// import React, { useState } from "react";
// import { View, Text, Image, Pressable, TextInput } from "react-native";
// import Logo from "../../../../imgs/BarnacleAI-1200-600.png";
// import Swimmers from "../../../../imgs/underwater_astro.png";
// import { useEmailPasswordAuth, useApp } from "@realm/react";

// const RegisterScreen = () => {
//   const { register, logIn, result } = useEmailPasswordAuth();
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const app = useApp();

//   const performLogin = () => {
//     if (email !== "enter your username") {
//       if (password !== "enter your password") {
//         const formattedEmail = email.replace(/\s/g, '');
//         logIn({ formattedEmail, password });
//       }
//     }
//   };
//   const registerUser = () => {
//     if (email && password) {
//       //console.log(email + " : " + password);
//       try {
//         const formattedEmail = email.replace(/\s/g, '');
//         register({ formattedEmail, password });
//         console.log("User registered successfully!");
//         performLogin();
//       } catch (error) {
//         console.error("Error registering user:", error);
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
//     <View
//       style={{
//         flex: 1,
//         backgroundColor: "#8930D5",
//         paddingVertical: 100,
//         paddingHorizontal: 25,
//         alignItems: "center",
//       }}
//     >
//       <Image
//         source={Logo}
//         width={300}
//         height={150}
//         style={{ width: 300, height: 150, resizeMode: "contain" }}
//       />
//       <View style={{ marginTop: 40 }}>
//         <Text
//           style={{
//             fontSize: 25,
//             fontWeight: 700,
//             color: "white",
//             alignSelf: "center",
//             fontFamily: "Poppins",
//             marginBottom: 15,
//           }}
//         >
//           Sign up!
//         </Text>
//         <TextInput
//           style={{
//             backgroundColor: "white",
//             borderRadius: 35,
//             paddingVertical: 15,
//             paddingHorizontal: 20,
//             color: "#686868",
//             width: 300,
//             fontFamily: "Poppins",
//             fontSize: 20,
//           }}
//           multiline={false}
//           placeholder="enter your email"
//           value={email}
//           onChangeText={changeEmailValue}
//         />
//         <TextInput
//           style={{
//             backgroundColor: "white",
//             borderRadius: 35,
//             paddingVertical: 15,
//             paddingHorizontal: 20,
//             color: "#686868",
//             width: 300,
//             fontFamily: "Poppins",
//             fontSize: 20,
//             marginTop: 20,
//           }}
//           placeholder="enter your password"
//           secureTextEntry={true}
//           multiline={false}
//           value={password}
//           onChangeText={changePassValue}
//         />
//         <Pressable
//           onPress={() => registerUser()}
//           style={{
//             marginTop: 35,
//             backgroundColor: "#b34eef",
//             paddingVertical: 15,
//             paddingHorizontal: 75,
//             borderRadius: 35,
//             shadowColor: "#000000",
//             shadowOffset: {
//               width: 0,
//               height: 12,
//             },
//             shadowOpacity: 0.23,
//             shadowRadius: 12.81,
//             elevation: 16,
//             alignContent: "center",
//           }}
//         >
//           <Text
//             style={{
//               color: "white",
//               alignSelf: "center",
//               fontFamily: "Poppins",
//               fontWeight: 700,
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
//             Log in
//           </Text>
//         </Pressable>
//       </View>
//     </View>
//   );
// };

// export default RegisterScreen;
