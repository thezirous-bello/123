import React from "react";
import { View, Text, ImageBackground, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";

const StatsNavigation = (props) => {
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
            marginVertical: 10,
            marginBottom: 20
            }}
        >
            {/* <Pressable style={active === 1 ? styles.navContainerActive : styles.navContainer} onPress={() => navigation.navigate('LongTradeSceen')}>
            <Text style={active === 1 ? styles.navItemActive : styles.navItem}>
                Long Term.
            </Text>
            </Pressable>
            <Pressable style={active === 2 ? styles.navContainerActive : styles.navContainer} onPress={() => navigation.navigate('ShortTermScreen')}>
            <Text style={active === 2 ? styles.navItemActive : styles.navItem}>
                Short Term.
            </Text>
            </Pressable> */}
            <Pressable style={active === 4 ? styles.navContainerActive : styles.navContainer} onPress={() => navigation.navigate('DayTradingScreen')}>
            <Text style={active === 4 ? styles.navItemActive : styles.navItem}>
                Signals.
            </Text>
            </Pressable>
            <Pressable style={active === 3 ? styles.navContainerActive : styles.navContainer} onPress={() => navigation.navigate('AIInsights')}>
            <Text style={active === 3 ? styles.navItemActive : styles.navItem}>
                AI Insights.
            </Text>
            </Pressable>
        </View>

    );
};

export default StatsNavigation;

const styles = StyleSheet.create({

navItem:{
    color: "white",
    fontFamily: "Poppins_700Bold",
    fontSize: 14,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 14,
    alignSelf: 'center'
},
navItemActive:{
    color: "black",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: 'center'
},
navContainerActive:{
    flex: 1,
    borderRadius: 14,
    backgroundColor: 'white',
},
navContainer:{
    flex: 1,
    borderRadius: 14
}

});