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
  name1: {
    color: "white",
    fontSize: 20,
    paddingLeft: 25,
    fontFamily: "Poppins_400Regular",
  },
  priceContainer: {
    paddingVertical: 20,
    paddingHorizontal: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceChange: { color: "white", fontSize: 16, fontFamily: 'Poppins_500Medium' },
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
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 5,
    paddingTop: 55,
    backgroundColor: 'rgba(0, 0, 0, 1)'
  },
  title2:{
    color: "white",
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
  },
  title3:{
    color: "white",
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    /*fontWeight: 600*/
  },
  transactionItem: {
   
  },
  coinImage: {
    width: 50,
    height: 50,
    marginRight: 10,
  },
  transactionDetails: {
    flex: 1,
  },
  transtitle: {
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
    alignSelf: "flex-end",
  },
  transticker: {
    color: "grey",
    fontWeight: "800",
  },
  transcoinContainer: {
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
  transpriceChangePercentageContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRadius: 5,
    alignSelf: "flex-end",
  },
  transQuantityContainer: {
    marginLeft: "auto",
    alignItems: "flex-end",
  },
});

export default styles;
