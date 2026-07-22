import React, { useEffect } from "react";
import { View, Text, Animated, Dimensions } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import HomeScreen from "../screens/HomeScreen";
import PortfolioScreen from "../screens/PortfolioScreen";
import AccountScreen from "../screens/AccountScreen";
import WatchListScreen from "../screens/WarchListScreen";
//import NewsScreen from "../screens/NewsScreen";
import { AntDesign, FontAwesome, Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import NewHomeScreen from "../screens/HomeScreen/newHomeScreen";
import { useNavigation } from "@react-navigation/native";
import NewsStackScreen from "./NewsStackNav";
import SearchScreen from "../screens/SearchScreen";
import StatsStackScreen from "./StatsStackNav";
import auth from '@react-native-firebase/auth';

const Tab = createBottomTabNavigator();
const AnimatedTabBarLabel = Animated.Text;
const iconWidth = new Animated.Value(0);

const screenWidth = Dimensions.get('window').width - 40;

const BottomTabNavigator = () => {
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 
  const verified = auth().currentUser.emailVerified ? true : false;

  const navigation = useNavigation();


  if(!isLoggedIn || !verified){
    auth().signOut();
    navigation.navigate("SignUp");
  }
  return (
    // <Tab.Navigator
    //   initialRouteName="Home"
    //   screenOptions={{
    //     headerShown: false,
    //     tabBarActiveTintColor: "#FF07C9",
    //     tabBarInactiveTintColor: "gray",
    //     tabBarStyle: {
    //       // backgroundColor: "#181818",
    //       // height: 60,
    //       // paddingBottom: 8,
    //       // borderRadius: 30,
    //       // marginHorizontal: 20,

    //       backgroundColor: "#222222",
    //       height: 60,
    //       paddingBottom: 3,
    //       borderRadius: 30,
    //       borderLeftWidth: 0.2,
    //       borderRightWidth: 0.2,
    //       marginHorizontal: 20,
    //       marginBottom: 15,
    //       position: "absolute",
    //       overflow: "hidden",
    //     },
    //   }}
    // >
    <Tab.Navigator
      initialRouteName="Home"
      
      screenOptions={{
        tabBarShowLabel: false,
        headerShown: false,
        tabBarActiveTintColor: "black",
        tabBarInactiveTintColor: "gray",
        tabBarStyle: {
          backgroundColor: "#222222",
          height: 65,
          paddingBottom: 3,
          borderRadius: 30,
          borderLeftWidth: 0.2,
          borderRightWidth: 0.2,
          marginHorizontal: 20,
          paddingTop: 12,
          marginBottom: 15,
          position: "absolute",
          overflow: "hidden",
        },

      }}
    >
      <Tab.Screen
        name={"Home"}
        component={NewHomeScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {!focused && <AntDesign name="home" size={focused ? 27 : 23} color={color} />}
              {focused && (
              <Animated.View
              style={{
                fontSize: 12,
                color: 'white',
                opacity: 1,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 50,
              backgroundColor: '#D9D9D9',
              paddingHorizontal: 10,
              paddingVertical: 4,
              marginLeft: 8,
              width: screenWidth / 4 - 10,
              height: 35
              }}
            >
               <AntDesign name="home" size={focused ? 27 : 23} color={color} />
               <Text style={{ marginLeft: 5, color: color, fontSize: 12 }}>Home</Text>
              </Animated.View>
              )}
            </View>
          ),
        }}
      />

<Tab.Screen
        name={"Search"}
        component={SearchScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {!focused && <Feather
                          name="search"
                          size={focused ? 27 : 25}
                          color={color}
                        />     }
            {focused && ( 
            <View
              style={{
                fontSize: 12,
                color: 'white',
                opacity: 1,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 50,
              backgroundColor: '#D9D9D9',
              paddingHorizontal: 10,
              paddingVertical: 4,
              marginLeft: 8,
              width: screenWidth / 4 - 10,
              height: 35
              }}
            >
                <Feather
                          name="search"
                          size={focused ? 27 : 25}
                          color={color}
                        />
                <Text style={{ color: color, fontSize: 12 }}>Search</Text>
              </View>
            )}
            </View>
          )
        }}
      />

      <Tab.Screen
        name={"Signals"}
        component={StatsStackScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {!focused && <MaterialIcons
                          name="attach-money"
                          size={focused ? 27 : 25}
                          color={color}
                          style={{ marginRight: 15 }}
                        />     }
            {focused && ( 
            <View
              style={{
                fontSize: 12,
                color: 'white',
                opacity: 1,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 50,
              backgroundColor: '#D9D9D9',
              paddingHorizontal: 10,
              paddingVertical: 4,
              marginLeft: 8,
              width: screenWidth / 4 - 10,
              height: 35
              }}
            >
                <MaterialIcons
                          name="attach-money"
                          size={focused ? 27 : 25}
                          color={color}
                        />
                <Text style={{ color: color, fontSize: 12 }}>Signals</Text>
              </View>
            )}
            </View>
          )
        }}
      />
      
      {/* <Tab.Screen
        name={"Portfolio"}
        component={PortfolioScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <FontAwesome
              name="suitcase"
              size={focused ? 27 : 23}
              // color={focused ? "#ff94f7" : "#bf36b5"}
              color={color}
            />
          ),
        }}
      /> */}
      {/* <Tab.Screen
        name={"Watchlist"}
        component={WatchListScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <AntDesign name="staro" size={focused ? 27 : 23} color={color} />
          ),
        }}
      /> */}
      <Tab.Screen
        name={"Discover"}
        component={NewsStackScreen}
        options={{
          tabBarIcon: ({ focused, color }) => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {!focused && <FontAwesome
                name="newspaper-o"
                size={focused ? 25 : 23}
                color={color}
              />}
              {focused && (
              <View
              style={{
                fontSize: 12,
                color: 'white',
                opacity: 1,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: 50,
              backgroundColor: '#D9D9D9',
              paddingHorizontal: 8,
              paddingVertical: 4,
              marginLeft: 8,
              marginRight: 35,
              width: screenWidth / 3.9,
              height: 35
              }}
            >
                <FontAwesome
                name="newspaper-o"
                size={focused ? 23 : 21}
                color={color}
              />
                <Text style={{ color: color, fontSize: 12, marginLeft: 10}}>Discover</Text>
              </View>
              )}
            </View>
          )
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabNavigator;
