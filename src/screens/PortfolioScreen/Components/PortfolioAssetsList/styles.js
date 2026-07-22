import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  currentBalance: {
    fontFamily: "Poppins_600SemiBold",
    color: "white",
    fontWeight: "600",
    fontSize: 15,
  },
  currentBalanceValue: {
    fontFamily: "Poppins_700Bold",
    color: "white",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 1,
  },
  valueChange: {
    fontFamily: "Poppins_600SemiBold",
    fontWeight: "600",
    fontSize: 14,
  },
  percentageChange: {
    fontFamily: "Poppins_500Medium",
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  balanceContainer: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
    marginHorizontal: 15,
  },
  priceChangePercentageContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "green",
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 5,
  },
  AssetsLabel: {
    fontFamily: "Poppins_400Regular",
    color: "white",
    fontSize: 20,
    fontWeight: "400",
  },
  buttonContainer: {
    marginVertical: 15,
    marginHorizontal: 25,
    borderRadius: 5,
    padding: 10,
    paddingVertical: 7,
    alignItems: "center",
    // backgroundColor: "#8930D5",
    backgroundColor: "#98188d",
  },
  buttonText: {
    color: "white",
    fontSize: 17,
    fontFamily: "Poppins_600SemiBold",
    fontWeight: "600",
  },
  rowBack: {},
});

export default styles;
