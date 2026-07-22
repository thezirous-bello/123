import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tickerContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  tickerTitle: { 
    color: "white", 
    fontWeight: "bold", 
    marginHorizontal: 5,
  fontSize: 18},
  rank: {
    fontWeight: "bold",
    color: "white",
    fontSize: 16,
    marginRight: 5,
    backgroundColor: "#585858",
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 4,
    paddingRight: 4,
    borderRadius: 5
  }
});

export default styles;
