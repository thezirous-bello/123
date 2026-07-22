import { StyleSheet } from "react-native";

const Styles = StyleSheet.create({
  title: {
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
    alignSelf: "flex-end",
  },
  ticker: {
    color: "grey",
    fontWeight: "800",
  },
  coinContainer: {
    flexDirection: "row",
    padding: 15,
    //alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#3d3e42",
    backgroundColor: "#3b1b3f",
    marginHorizontal: 10,
    marginVertical: 8,
    borderRadius: 15,
  },
  priceChangePercentageContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRadius: 5,
    alignSelf: "flex-end",
  },
  QuantityContainer: {
    marginLeft: "auto",
    alignItems: "flex-end",
  },
});

export default Styles;
