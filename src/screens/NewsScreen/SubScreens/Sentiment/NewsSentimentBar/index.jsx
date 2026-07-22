// import React, { useEffect, useState } from "react";
// import { View, Text } from "react-native";
// import { BarChart } from "react-native-chart-kit";
// import { Dimensions } from "react-native";

// import { fetchSentimentData } from "../../../../../services/requests"; // Import fetch function

// const NewsSentimentBar = () => {
//   const [sentimentData, setSentimentData] = useState({ positive: 0, negative: 0 });

//   useEffect(() => {
//     const loadData = async () => {
//       const data = await fetchSentimentData();
//       setSentimentData(data);
//     };
//     loadData();
//   }, []);

//   const chartData = {
//     labels: ["Positive", "Negative"],
//     datasets: [{ data: [sentimentData.positive, sentimentData.negative] }],
//   };

//   return (
//     <View>
//       <Text style={{ textAlign: "center", fontSize: 18, marginBottom: 10 }}>Sentiment Analysis</Text>
//       <BarChart
//         data={chartData}
//         width={Dimensions.get("window").width - 20}
//         height={220}
//         chartConfig={{
//           backgroundGradientFrom: "#f4f4f4",
//           backgroundGradientTo: "#ffffff",
//           color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
//           strokeWidth: 2,
//           barPercentage: 0.6,
//         }}
//         style={{ marginVertical: 8, borderRadius: 8 }}
//       />
//     </View>
//   );
// };

// export default NewsSentimentBar;

import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { fetchSentimentData } from "../../../../../services/requests"; // Import fetch function

const NewsSentimentBar = () => {
  const [sentimentData, setSentimentData] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const data = await fetchSentimentData();
      setSentimentData(data);
    };
    loadData();
  }, []);

  const totalWidth = 300; // Width of the bar
  const positiveWidth = (sentimentData.positive / 100) * totalWidth;
  const negativeWidth = (sentimentData.negative / 100) * totalWidth;

  return (
    sentimentData ? 
    <View style={{ alignItems: "center", marginTop: 20 }}>
      <Text style={{ fontSize: 18, marginBottom: 10, fontWeight: 'bold', color: positiveWidth > negativeWidth ? "rgba(28, 255, 142, 0.9)" : 'rgba(255, 28, 117, 0.9)' }}>Today is {positiveWidth > negativeWidth ? "positive!" : "negative!"}</Text>
      <Svg width={totalWidth} height={15}>
        {/* Negative (Left Side) */}
        <Rect x="0" y="0" width={negativeWidth} height="30" fill="rgba(255, 28, 117, 0.9)" />
        {/* Positive (Right Side) */}
        <Rect x={negativeWidth} y="0" width={positiveWidth} height="30" fill="rgba(28, 255, 142, 0.9)" />
      </Svg>
      <View style={{ flexDirection: "row", width: totalWidth, justifyContent: "space-between", marginTop: 5 }}>
        <Text style={{ color: "rgba(255, 28, 117, 0.9)", fontSize: 16, fontWeight: 'bold' }}>{sentimentData.negative.toFixed(1)}% Negative</Text>
        <Text style={{ color: "rgba(28, 255, 142, 0.9)", fontSize: 16, fontWeight: 'bold' }}>{sentimentData.positive.toFixed(1)}% Positive</Text>
      </View>
    </View>
  : <ActivityIndicator />
  );
};

export default NewsSentimentBar;
