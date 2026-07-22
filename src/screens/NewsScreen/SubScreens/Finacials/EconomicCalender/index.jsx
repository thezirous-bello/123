import React, { useEffect, useState } from "react";
import { View, Text, ImageBackground, StyleSheet, Dimensions, ActivityIndicator, ScrollView, TouchableOpacity } from "react-native";
import bg from '../../../../../imgs/bgimg.png';
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { getMyFXBookData } from '../../../../../services/requests';
import auth from '@react-native-firebase/auth';
import Purchases from "react-native-purchases";
import GetPremium from "../../../../../components/GetPremium";

const screenWidth = Dimensions.get("window").width;

const EconomicCalender = () => {
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 
  const [economicCalender, setEconomicCalender] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const [purchaseInfo, setPurchaseInfo] = useState([]);

  useEffect(() => {
    const getPurchaserInfo = async () => {
      setLoading(true)
      try {
        const purchaserInfo = await Purchases.getCustomerInfo();
        setPurchaseInfo(purchaserInfo.activeSubscriptions[0]);
      } catch (e) {
        console.error("Error fetching purchaser info:", e);
      }
    };
    getPurchaserInfo();
    const fetchData = async () => {
      try {
        const info = await getMyFXBookData(isLoggedIn, 1000, 1000, true);
        setEconomicCalender(info);
        setLoading(false);
      } catch (e) {
        console.log(e);
      }
    };
    fetchData();
  }, []);

  // Format date to a more readable form
  const formatDate = (dateString) => {
    const options = { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  return (
    <View style={{ padding: 30, flex: 1, paddingTop: 55 }}>
      <TouchableOpacity style={styles.headerContainer}  onPress={() => navigation.goBack()}>
          <Ionicons
            name="chevron-back-sharp"
            size={29}
            color="white"
            style={{ position: 'absolute', left: 0}}
          />
        <Text style={styles.headerText}>
          Economic Calendar
        </Text>
      </TouchableOpacity>
      {purchaseInfo ? 
      <ScrollView style={{ paddingHorizontal: 0, paddingVertical: 20 }}>
        {loading ? (
          <ActivityIndicator size={"large"} color={'white'} />
        ) : economicCalender.length > 0 ? (
          <View style={styles.eventList}>
            {economicCalender.map((item, index) => (
              <View key={index} style={styles.card}>
                <Text style={styles.date}>{formatDate(item.date_time)}</Text>
                <Text style={styles.country}>{item.country}</Text>
                <Text style={styles.event}>{item.event}</Text>

                {/* Display Previous, Actual, and Consensus Values */}
                <View style={styles.valueRow}>
                  <View style={styles.valueContainer}>
                    <Text style={styles.valueLabel}>Previous:</Text>
                    <Text style={styles.valueText}>{item.previous_value || "N/A"}</Text>
                  </View>
                  <View style={styles.valueContainer}>
                    <Text style={styles.valueLabel}>Actual:</Text>
                    <Text style={styles.valueText}>{item.actual_value || "N/A"}</Text>
                  </View>
                  <View style={styles.valueContainer}>
                    <Text style={styles.valueLabel}>Consensus:</Text>
                    <Text style={styles.valueText}>{item.consensus_value || "N/A"}</Text>
                  </View>
                </View>

                <Text style={[styles.impact, { color: item.impact === "Low" ? "#16c784" : item.impact === "High" ? "#d92222" : "orange" }]}>
                  {item.impact} Impact
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: 'white', fontSize: 15 }}>No urgent news/alerts at this time</Text>
        )}
      </ScrollView>
      : <GetPremium/> }
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'center',
  },
  headerText: {
    color: "white",
    fontSize: 23,
    letterSpacing: 1,
    paddingHorizontal: 20,
    fontFamily: "Poppins_700Bold",
    textAlign: 'center',
  },
  eventList: {
    flexDirection: "column",
    justifyContent: "center",
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginVertical: 10,
    marginHorizontal: 10,
  },
  date: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    marginBottom: 5,
  },
  country: {
    color: "#aaa",
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
    marginBottom: 5,
  },
  event: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Poppins_500Medium",
    marginBottom: 10,
    lineHeight: 22,
  },
  impact: {
    fontSize: 14,
    fontFamily: "Poppins_500Medium",
    marginTop: 10,
  },
  valueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 5,
  },
  valueContainer: {
    flex: 1,
    alignItems: "center",
  },
  valueLabel: {
    color: "#aaa",
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
  },
  valueText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
  },
});

export default EconomicCalender;
