import React from "react";
import { View, Text, ImageBackground, Pressable, StyleSheet, Dimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";

const screenWidth = Dimensions.get("window").width; // Get the screen width

const SearchNavigation = (props) => {
    const { active } = props;
    const navigation = useNavigation();


    return (
    <View
            style={{
            backgroundColor: "rgba(255,255,255,0.16)",
            borderRadius: 14,
            flexDirection: "row",
            overflow: "scroll",
            justifyContent: "space-between",
            marginHorizontal: 10,
            marginVertical: 10
            }}
        >
            <Pressable style={active === 1 ? styles.navContainerActive : styles.navContainer} onPress={() => navigation.navigate('SearchScreen')}>
            <Text style={active === 1 ? styles.navItemActive : styles.navItem}>
                Coins
            </Text>
            </Pressable>
            {/* <Pressable style={active === 2 ? styles.navContainerActive : styles.navContainer} onPress={() => navigation.navigate('Finance')}>
            <Text style={active === 2 ? styles.navItemActive : styles.navItem}>
                Finacials
            </Text>
            </Pressable> */}
            {/* <Pressable style={active === 3 ? styles.navContainerActive : styles.navContainer} onPress={() => navigation.navigate('Sentiment')}>
            <Text style={active === 3 ? styles.navItemActive : styles.navItem}>
                Sentiment
            </Text>
            </Pressable> */}
            <Pressable style={active === 4 ? styles.navContainerActive : styles.navContainer} onPress={() => navigation.navigate('AllNews')}>
            <Text style={active === 4 ? styles.navItemActive : styles.navItem}>
                News
            </Text>
            </Pressable>
        </View>

    );
};

export default SearchNavigation;

const styles = StyleSheet.create({

navItem:{
    color: "white",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    textAlign: 'center',    
    width: screenWidth / 2 - 20, // Same width as navItem

},
navItemActive:{
    color: "black",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    textAlign: 'center',    
    width: screenWidth / 2 - 20, // Same width as navItem
},
navContainerActive:{
    borderRadius: 14,
    backgroundColor: 'white',
},
navContainer:{
    borderRadius: 14
}

});