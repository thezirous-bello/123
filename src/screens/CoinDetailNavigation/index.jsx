import React from "react";
import { View, Text, Image, Pressable } from "react-native";
import { AntDesign } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

const CoinDetailNavigation = ({ asset }) => {
  const navigation = useNavigation();
  //console.log(assetsItem);

  const {coinID, symbolz, market_cap_rank, CSD, CSH, CIH} = asset

  return (



<View style={{display: 'flex', flexDirection: 'row', marginTop: 15}}>
    <Pressable style={{margin: 10, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: CSD ? '#FF07C9' : '#fff', backgroundColor: CSD ? 'transparent' : '#2c2c2c'}} onPress={
                                                                                                                                                () => navigation.navigate("CoinDetailScreen", {
                                                                                                                                                    coinID: coinID,
                                                                                                                                                    symbolz: symbolz,
                                                                                                                                                    market_cap: market_cap_rank,
                                                                                                                                                })}>
    <Text style={{color: CSD ? '#FF07C9' : "#fff", fontWeight: 600}}>Overview</Text>
    </Pressable>
    <Pressable style={{margin: 10, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: CSH ? '#FF07C9' : '#fff', backgroundColor: CSH ? 'transparent' : '#2c2c2c'}} onPress={
                                                                                                                                                () => navigation.navigate("CoinHoldingsScreen", {
                                                                                                                                                    coinID: coinID,
                                                                                                                                                    symbolz: symbolz,
                                                                                                                                                    market_cap: market_cap_rank,
                                                                                                                                                })}>
    <Text style={{color: CSH ? '#FF07C9' : "#fff", fontWeight: 600}}>Holdings</Text>
    </Pressable>
    <Pressable style={{margin: 10, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: CIH ? '#FF07C9' : '#fff', backgroundColor: CIH ? 'transparent' : '#2c2c2c'}} onPress={
                                                                                                                                                () => navigation.navigate("CoinInsightsScreen", {
                                                                                                                                                    coinID: coinID,
                                                                                                                                                    symbolz: symbolz,
                                                                                                                                                    market_cap: market_cap_rank,
                                                                                                                                                })}>
    <Text style={{color: CIH ? '#FF07C9' : "#fff", fontWeight: 600}}>Insights</Text>
    </Pressable>
</View>

)

}

export default CoinDetailNavigation;
