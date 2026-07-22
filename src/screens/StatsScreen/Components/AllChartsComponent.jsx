import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { LineChart, XAxis } from "react-native-svg-charts";
import * as shape from "d3-shape";

const CombinedChart = ({ prices, zoom }) => {
  const [fibonacciLevels, setFibonacciLevels] = useState([]);

  const calculateFibonacciLevels = (swingLow, swingHigh) => {
    const retracementLevels = [0.236, 0.382, 0.5, 0.618, 0.786];

    const fibonacciLevels = retracementLevels.map((level) => {
      const retracement = swingLow + level * (swingHigh - swingLow);
      return retracement;
    });

    return fibonacciLevels;
  };

  const identifySwings = (prices) => {
    const swingHighs = [];
    const swingLows = [];

    for (let i = 2; i < prices.length - 2; i++) {
      const current = prices[i];
      const prev1 = prices[i - 1];
      const prev2 = prices[i - 2];
      const next1 = prices[i + 1];
      const next2 = prices[i + 2];

      if (prev2 < prev1 && current > next1 && current > next2) {
        swingHighs.push(current);
      }

      if (prev2 > prev1 && current < next1 && current < next2) {
        swingLows.push(current);
      }
    }

    return { swingHighs, swingLows };
  };

  useEffect(() => {
    const thePrices = prices.map((item) => item[1]);
    const { swingHighs, swingLows } = identifySwings(thePrices);

    if (swingLows.length > 0) {
      const fibLevelsLow = calculateFibonacciLevels(
        Math.min(...swingLows),
        Math.max(...swingHighs)
      );
      setFibonacciLevels(fibLevelsLow.splice(-zoom));
    } else {
      setFibonacciLevels([]);
    }
  }, [prices, zoom]);

  const data = [
    ...fibonacciLevels.map((level) => ({
      data: prices.map((item) => ({ x: item[0], y: level })),
      svg: { stroke: "purple", strokeDasharray: [4, 4], strokeWidth: 1 },
      //svg: { stroke: "purple", strokeWidth: 1 },
    })),
  ];

  const labelsList = prices.map((item) => item[0]);

  return (
    <View style={{ flex: 1, marginLeft: 0 }}>
      <LineChart
        style={{ flex: 1 }}
        data={data}
        curve={shape.curveNatural}
        contentInset={{ top: 20, bottom: 20 }}
        yAccessor={({ item }) => item.y}
      />
    </View>
  );
};

export default CombinedChart;
