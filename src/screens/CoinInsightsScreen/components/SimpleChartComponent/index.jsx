// import React from 'react';
// import { View, Text, ActivityIndicator } from 'react-native';
// import { LineChart } from 'react-native-chart-kit';
// import { Dimensions } from 'react-native';

// const SimpleChartComponent = ({ data }) => {
//   if (!data) {
//     return <ActivityIndicator size="large" />;
//   }

//   const chartData = data.map(item => item['Close']);
//   const chartLabels = data.map(item => item['date']);

//   return (
//     <View>
//       <Text>Simple Chart</Text>
//       <LineChart
//         data={{
//           labels: chartLabels,
//           datasets: [
//             {
//               data: chartData,
//             },
//           ],
//         }}
//         width={Dimensions.get('window').width - 20} // from react-native
//         height={220}
//         yAxisSuffix=""
//         yAxisInterval={1} // optional, defaults to 1
//         chartConfig={{
//           backgroundColor: '#000',
//           backgroundGradientFrom: '#000',
//           backgroundGradientTo: '#000',
//           decimalPlaces: 2, // optional, defaults to 2dp
//           color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
//           labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
//           style: {
//             borderRadius: 16,
//           },
//           propsForDots: {
//             r: '6',
//             strokeWidth: '2',
//             stroke: '#ffa726',
//           },
//         }}
//         bezier
//         style={{
//           marginVertical: 8,
//           borderRadius: 16,
//         }}
//       />
//     </View>
//   );
// };

// export default SimpleChartComponent;
import React, { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { LineChart } from "react-native-wagmi-charts";
import { Dimensions } from "react-native";

const SimpleChartComponent = ({ data }) => {

    
  const [allPrices, setAllPrices] = useState([]);
  if (!data) {
    return <ActivityIndicator size="large" />;
  }

  const screenWidth = Dimensions.get("window").width;

  useEffect(()=>{
    setAllPrices(data.map(([firstValue]) => firstValue));
  },[data])

  if(!data || allPrices.length == 0){
    return <ActivityIndicator size={'large'} />
  }

  console.log("This is the data: " + allPrices)
  console.log("Type of: " + typeof(allPrices))

  const priceList = [];
  if (allPrices.length > 29 && allPrices.length < 365) {
    const devider = 7;
    for (let i = 0; i < allPrices.length; i += devider) {
      if (i < allPrices.length) {
        priceList.push(allPrices[i]);
      }
    }
  } else if (allPrices.length < 29 && allPrices.length > 5) {
    const devider = 2;
    for (let i = 0; i < allPrices.length; i += devider) {
      if (i < allPrices.length) {
        priceList.push(allPrices[i]);
      }
    }
  } else if (allPrices.length <= 366) {
    const devider = 65;
    for (let i = 0; i < allPrices.length; i += devider) {
      if (i < allPrices.length) {
        priceList.push(allPrices[i]);
      }
    }
  } else if (allPrices.length > 366) {
    const devider = 730;
    for (let i = 0; i < allPrices.length; i += devider) {
      if (i < allPrices.length) {
        priceList.push(allPrices[i]);
      }
    }
  } else {
    priceList.push(...allPrices);
  }

  
  const chartData = allPrices.map(([key, value]) => ({
    timestamp: key,
    value: value,
  }));


  if (chartData){ 
  return (
    <View>
      <LineChart height={250} data={chartData}>
        <LineChart.Path color="#FF07C9">
          <LineChart.Gradient />
          <LineChart.HorizontalLine at={{ index: 0 }} />
        </LineChart.Path>
        <LineChart.Tooltip style={{ alignItems: "center" }}>
          <LineChart.DatetimeText style={{ color: "white", fontSize: 12, margin: 5 }} />
          <LineChart.PriceText style={{ color: "white" }} />
        </LineChart.Tooltip>
        <LineChart.CursorLine />
        <LineChart.CursorCrosshair color="white" />
      </LineChart>
    </View>
  );
};
}

export default SimpleChartComponent;
