import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  currentPrice: {
    color: "white",
    fontSize: 24,
    letterSpacing: 1,
    fontFamily: "Poppins_400Regular",
  },
  name: {
    color: "white",
    fontSize: 20,
    fontFamily: "Poppins_400Regular",
  },
  priceContainer: {
    paddingVertical: 20,
    paddingHorizontal: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceChange: { color: "white", fontSize: 16, fontFamily: 'Poppins_500Medium'},
  PercentageContainer: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  input: {
    flex: 1,
    height: 20,
    margin: 12,
    //borderBottomWidth: 1,
    //borderBottomColor: "white",
    fontSize: 16,
    color: "white",
  },
  filtersContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#2b2b2b",
    paddingVertical: 5,
    borderRadius: 5,
    margin: 10,
  },
  image:{
    paddingVertical: 15,
    paddingHorizontal: 5,
    paddingTop: 55,
    backgroundColor: 'rgba(0, 0, 0, 1)'
  }
});

export default styles;
