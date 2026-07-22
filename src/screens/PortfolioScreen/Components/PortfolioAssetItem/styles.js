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
    marginHorizontal: 25,
    //alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#3d3e42",
    backgroundColor: "#251231",
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
