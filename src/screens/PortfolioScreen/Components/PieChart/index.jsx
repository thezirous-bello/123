import React from "react";
import { View, Text, ScrollView } from "react-native";
import { PieChart } from "react-native-svg-charts";

const DonutPieChart = ({ data }) => {
  const getRandomColor = (index) => {
    // Generate a random color based on the index
    const colors = [
      "#33b5e6",
      "#c8741c",
      "#991099",
      "#ffff00",
      "#e91e63",
      "#009688",
    ];
    return colors[index % colors.length];
  };

  const chartData = data.map((item, index) => ({
    value: item.totalSpent,
    svg: { fill: getRandomColor(index) },
    key: item.name,
    // arc: { outerRadius: "80%", cornerRadius: 10 },
    arc: { outerRadius: "70%", cornerRadius: 0 },
    ticker: item.ticker,
    percentage: (
      (item.totalSpent / data.reduce((acc, i) => acc + i.totalSpent, 0)) *
      100
    ).toFixed(2),
  }));

  const totalSpending = data.reduce((acc, item) => acc + item.totalSpent, 0);

  const threshold = 10;
  const filteredData = chartData.filter(
    (item) => (item.value / totalSpending) * 100 >= threshold
  );

  const otherTotal =
  totalSpending -
  filteredData.reduce((acc, item) => acc + item.value, 0);
  const otherPercentage = (otherTotal / totalSpending) * 100;

  if (otherTotal > 0) {
    filteredData.push({
      value: otherTotal, // Use the remaining value, not just the percentage
      svg: { fill: "#CCCCCC" },
      key: "Other",
      arc: { outerRadius: "70%", cornerRadius: 0 },
      ticker: "",
      percentage: otherPercentage.toFixed(2),
    });
  }
  // const otherPercentage =
  //   (1 -
  //     filteredData.reduce((acc, item) => acc + item.value, 0) / totalSpending) *
  //   100;

  // if (otherPercentage > 0) {
  //   filteredData.push({
  //     value: otherPercentage,
  //     svg: { fill: "#CCCCCC" },
  //     key: "Other",
  //     //arc: { outerRadius: "80%", cornerRadius: 10 },
  //     arc: { outerRadius: "70%", cornerRadius: 0 },
  //     ticker: "",
  //     percentage: otherPercentage.toFixed(2),
  //   });
  // }

  const renderLegend = () => {
    return filteredData.map((item) => (
      <View
        key={item.key}
        style={{
          flexDirection: "column",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <View
          style={{
            width: 10,
            height: 10,
            backgroundColor: item.svg.fill,
            marginRight: 15,
            borderRadius: 30,
          }}
        />
        <Text
          style={{
            fontSize: 12,
            marginRight: 10,
            color: "white",
            fontFamily: "Poppins_600SemiBold",
            fontWeight: 600,
          }}
        >
          {item.key}
        </Text>
        <Text
          style={{
            fontSize: 12,
            marginRight: 10,
            color: "white",
            fontFamily: "Poppins_400Regular",
            fontWeight: 400,
          }}
        >
          {item.percentage}%
        </Text>
      </View>
    ));
  };

  const renderLabels = () => {
    return filteredData.map((item) => (
      <Text
        key={item.key}
        style={{ fontSize: 12, color: "white", textAlign: "center" }}
      >
        {item.ticker} - {item.percentage}%
      </Text>
    ));
  };

  return (
    <ScrollView>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <PieChart style={{ height: 250, width: 250 }} data={filteredData} />
        <View
          style={{
            flexDirection: "row",
            marginTop: 10,
            marginLeft: 10,
            flexWrap: "wrap",
          }}
        >
          {renderLegend()}
        </View>
        {/* <View style={{ marginTop: 10 }}>{renderLabels()}</View> */}
        {/* <Text>Total Spending: ${totalSpending.toFixed(2)}</Text> */}
      </View>
    </ScrollView>
  );
};

export default DonutPieChart;
