import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { fetchSentimentData } from "../../../../../services/requests"; // Import fetch function

const NewsSentimentCircle = () => {
  const [sentimentData, setSentimentData] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const data = await fetchSentimentData();
      setSentimentData(data);
    };
    loadData();
  }, []);

  const getCurrentDate = () => {
    const date = new Date();
    return date.toLocaleDateString(); // Format: MM/DD/YYYY
  };

  return (
    sentimentData ? 
    <View style={{ alignItems: "center", marginTop: 20 }}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 75,
          backgroundColor: sentimentData.positive > sentimentData.negative ? "rgba(28, 255, 142, 0.9)" : "rgba(255, 28, 117, 0.9)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: "bold", color: "#000" }}>
          {sentimentData.positive > sentimentData.negative ? "Positive" : "Negative"}
        </Text>
      </View>
      <Text style={{ fontSize: 14, color: "#888", marginTop: 10 }}>
        {getCurrentDate()}
      </Text>
    </View>
  : <ActivityIndicator />
  );
};

export default NewsSentimentCircle;