import { fetchFundingRates } from "../../../../services/requests";
import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import Svg, { Rect } from "react-native-svg";

const FundingRateWidget = ({ symbol = "BTCUSDT" }) => {
  const [data, setData] = useState({ current_funding_rate: 0, avg_funding_rate: 1 });

  useEffect(() => {
    const loadData = async () => {
      const result = await fetchFundingRates(symbol);
      setData(result);
    };
    loadData();
  }, [symbol]);

  const progress = Math.min(Math.abs(data.current_funding_rate / data.avg_funding_rate), 1);

  return (
    <View style={{ padding: 10, backgroundColor: "#1E1E1E", borderRadius: 10 }}>
      <Text style={{ color: "white", fontSize: 16 }}>Funding Rate</Text>
      <Svg width="100%" height="20">
        <Rect x="0" y="0" width="100%" height="20" fill="#333" rx="5" />
        <Rect x="0" y="0" width={`${progress * 100}%`} height="20" fill={data.current_funding_rate > 0 ? "green" : "red"} rx="5" />
      </Svg>
      <Text style={{ color: "white", fontSize: 14 }}>
        {data.current_funding_rate.toFixed(4)}% (Avg: {data.avg_funding_rate.toFixed(4)}%)
      </Text>
    </View>
  );
};

export default FundingRateWidget;
