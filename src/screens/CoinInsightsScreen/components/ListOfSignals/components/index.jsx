import React from "react";
import { View, Text, StyleSheet } from "react-native";

const SignalCard = ({ signal }) => {
  const { date, type, price  } = signal;
  console.log(price)
  return (
    <View style={[styles.card, type === "buy" ? styles.b16c784 : styles.FF07C9]}>
      <Text style={styles.timestamp}>Date: {new Date(date).toLocaleString()}</Text>
      <Text style={styles.price}>Price: ${price.toFixed(2)}</Text>
      <Text style={[styles.type, type === "buy" ? styles.buy : styles.sell]}>
        {type.toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 10,
    marginVertical: 5,
    marginHorizontal: 10,
    borderRadius: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 1,
  },
  timestamp: {
    fontSize: 14,
    marginBottom: 5,
  },
  type: {
    fontSize: 16,
    fontWeight: "bold",
  },
  buy: {
    color: "green",
    //  color: "#fff",
  },
  sell: {
    color: "red",
    // color: "#fff",
  },
  FF07C9: {
    // backgroundColor: "#ee5253",
    backgroundColor: "transparent",
  },
  b16c784: {
    // backgroundColor: "#02884b",
    backgroundColor: "transparent"

  },
});

export default SignalCard;
