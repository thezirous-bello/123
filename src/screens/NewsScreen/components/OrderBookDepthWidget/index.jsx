import { fetchOrderBookDepth } from "../../../../services/requests";
import React, { useEffect, useState } from "react";
import { View, Text } from "react-native";
import Svg, { Rect } from "react-native-svg";

const OrderBookDepthWidget = ({ symbol = "XXBTZUSD" }) => {
  const [data, setData] = useState({ sell_depth: 0, buy_depth: 0 });

  useEffect(() => {
    const loadData = async () => {
      const result = await fetchOrderBookDepth(symbol);
      setData(result);
    };
    loadData();
  }, [symbol]);

  const totalDepth = data.sell_depth + data.buy_depth;
  const sellRatio = totalDepth ? data.sell_depth / totalDepth : 0.5;
  const buyRatio = totalDepth ? data.buy_depth / totalDepth : 0.5;

  return (
    <View style={{ padding: 10, borderRadius: 10 }}>
      <Svg width="100%" height="20">
        <Rect x="0" y="0" width="100%" height="20" fill="#333" rx="5" />
        <Rect x="0" y="0" width={`${sellRatio * 100}%`} height="20" fill="rgba(255, 28, 117, 0.9)" rx="5" />
        <Rect x={`${sellRatio * 100}%`} y="0" width={`${buyRatio * 100}%`} height="20" fill="rgba(28, 255, 142, 0.9)" rx="5" />
      </Svg>
      <Text style={{ color: "white", fontSize: 14, marginTop: 5 }}>
        Asks: {`${(sellRatio * 100).toFixed(2)}%`}
      </Text>
      <Text style={{ color: "white", fontSize: 14, marginTop: 5 }}>
        Bids: {`${(buyRatio * 100).toFixed(2)}%`}
      </Text>
    </View>
  );
};

export default OrderBookDepthWidget;
