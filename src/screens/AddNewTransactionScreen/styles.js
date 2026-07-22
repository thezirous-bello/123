import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  dropdownContainer: {
    width: "100%",
    paddingHorizontal: 10,
    paddingVertical: 20,
  },
  itemStyle: {
    padding: 10,
    marginTop: 2,
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#444444",
    borderRadius: 5,
  },
  textInputProps: {
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#444444",
    borderRadius: 5,
    backgroundColor: "#1e1e1e",
    color: "white",
  },
  ticker: {
    color: "grey",
    fontWeight: "700",
    fontSize: 20,
    marginTop: 25,
    marginLeft: 5,
  },
  boughtQTYContainer: {
    flex: 1,
    alignItems: "center",
    marginTop: 50,
  },
  buttonContainer: {
    marginVertical: 25,
    marginHorizontal: 20,
    width: "90%",
    borderRadius: 5,
    padding: 10,
    paddingVertical: 7,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "600",
  },
  pricePerCoin: {
    color: "grey",
    fontWeight: "700",
    fontSize: 17,
    letterSpacing: 1,
  },
  doneButton: {
    padding: 10,
    backgroundColor: '#4169e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
  },
});

export default styles;
