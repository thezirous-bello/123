import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#222222",
    paddingTop: 40,
    padding: 10,
  },
  coinContainer: {
    flexDirection: "row",
    alignSelf: "baseline",
    borderBottomWidth: 0.5,
    padding: 15,
    borderBottomColor: "#585858",
    width: "100%",
  },

  title: {
    color: "white",
    fontSize: 16,
    marginBottom: 3,
    fontWeight: "bold",
  },
  text: {
    color: "white",
    fontSize: 14,
    marginRight: 5,
  },
  rank: {
    fontWeight: "bold",
    color: "white",
    fontSize: 12,
    marginRight: 5,
    backgroundColor: "#8930D5",
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 5,
    paddingRight: 5,
    borderRadius: 5,
  },
});
