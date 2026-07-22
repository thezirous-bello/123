import { fetchOpenInterest } from "../../../../services/requests";
import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import Svg, { Rect } from "react-native-svg";

const OpenInterestWidget = ({ symbol = "BTCUSDT" }) => {
  const [data, setData] = useState({ open_interest: 0, dynamic_threshold: 1 });

  useEffect(() => {
    const loadData = async () => {
      const result = await fetchOpenInterest(symbol);
      setData(result);
    };
    loadData();
  }, [symbol]);

  const progress = Math.min(data.open_interest / data.dynamic_threshold, 1);

  return (
    <View style={{ padding: 10, borderRadius: 10 }}>
      <Svg width='80' height="20">
        <Rect x="0" y="0" width="100%" height="20" fill="#333" rx="5" />
        <Rect x="0" y="0" width={`${progress * 100}%`} height="20" fill={progress > 1 ? "rgba(255, 28, 117, 0.9)" : "rgba(28, 255, 142, 0.9)"} rx="5" />
      </Svg>
      <Text style={{ color: "white", fontSize: 13, fontWeight: 'bold', marginTop: 5 }}>
        Open: {data.open_interest.toFixed(2)}
      </Text>
      <Text style={{ color: "white", fontSize: 13, marginTop: 5, fontWeight: 'bold' }}>
        Dynamic Threshold: {data.dynamic_threshold.toFixed(2)}
      </Text>
      
    </View>
  );
};

export default OpenInterestWidget;
