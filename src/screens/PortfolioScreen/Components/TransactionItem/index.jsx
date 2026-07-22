import React from "react";
import { View, Text, Image, Pressable } from "react-native";
import Styles from "./styles";
import { AntDesign } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

const TransactionItem = ({ assetsItem }) => {
  const navigation = useNavigation();

  return assetsItem.item && assetsItem.item.transaction_type ? (
    <>
      <Text style={{ color: "white", marginLeft: 15, fontWeight: 600 }}>
        {assetsItem.item.timestamp}
      </Text>

      <Pressable
        style={Styles.coinContainer}
        onPress={() =>
          navigation.navigate("EditTransactionScreen", {
            transaction: assetsItem.item

          })
        }
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignSelf: "flex-start",
              alignItems: "center",
            }}
          >
            <Image
              source={{ uri: assetsItem.item.image }}
              height={30}
              width={30}
              style={{ marginRight: 10, alignSelf: "center" }}
            />
            <Text style={{ color: "white", fontWeight: 700 }}>
              {assetsItem.item.transaction_type.toUpperCase()}
            </Text>
          </View>
          <View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text
                style={{ color: "white", fontWeight: 700, marginRight: 10 }}
              >
                {assetsItem.item.quantityBought}
              </Text>
              <Text style={{ color: "white", fontWeight: 700 }}>
                {assetsItem.item.ticker.toUpperCase()}
              </Text>
            </View>
            <Text style={{ color: "white" }}>
              {assetsItem.item.priceBought}
            </Text>
          </View>
        </View>
      </Pressable>
    </>
  ) : (
    <View></View>
  );
};

export default TransactionItem;
