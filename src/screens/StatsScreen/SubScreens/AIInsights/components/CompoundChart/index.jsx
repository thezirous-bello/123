import React from "react";
import { View, Text, Dimensions } from "react-native";
import { LineChart } from "react-native-wagmi-charts";
import { XAxis } from "react-native-svg-charts";
import { GestureHandlerRootView } from "react-native-gesture-handler";

const CompoundInvestmentChart = () => {
    const generateInvestmentData = () => {
        const initialInvestment = 1000;
        const dailyRate = 1.02; // 2% daily increase
        const days = 365; // One year
        const monthlyData = [];
      
        let value = initialInvestment;
        for (let day = 1; day <= days; day++) {
          value *= dailyRate;
          if (day % 30 === 0) {
            monthlyData.push({
              timestamp: new Date().setMonth(new Date().getMonth() - (12 - monthlyData.length)), 
              value,
            });
          }
        }
      
        return monthlyData;
      };
      
      const investmentData = generateInvestmentData();
      

  const screenWidth = Dimensions.get("window").width;

  return (
    <GestureHandlerRootView> 
    <View>
        <LineChart.Provider data={investmentData}>
        <LineChart height={250}>
            <LineChart.Path color={"#4CAF50"}>
            <LineChart.Gradient />
            </LineChart.Path>
            <LineChart.Tooltip>
            <LineChart.DatetimeText style={{ color: "white", fontSize: 12, margin: 5 }} />
            <LineChart.PriceText variant="value" style={{ color: "white" }} />
            </LineChart.Tooltip>
            <LineChart.CursorLine />
            <LineChart.CursorCrosshair color="white" />
        </LineChart>
        </LineChart.Provider>

          </View>
          <View style={{ height: 30, zIndex: 997, width: "100%" }}>
          <XAxis
            data={investmentData}
            formatLabel={(value, index) => {
                const date = new Date(investmentData[index].timestamp);
                return date.toLocaleString("en-US", { month: "short"});
            }}
            contentInset={{ left: 30, right: 30 }}
            svg={{ fontSize: 12, fill: "white", textAnchor: "middle" }}
            />
          </View>
   </GestureHandlerRootView>
  );
};

export default CompoundInvestmentChart;
