// // MarketDataChart.js
// import React, { useRef } from "react";
// import { View, Text } from "react-native";
// import { LineChart, XAxis, YAxis } from "react-native-svg-charts";
// import Tooltip from "react-native-tooltip";
// import * as shape from "d3-shape";

// const calculateSMA = (currentIndex, prices, smaPeriod) => {
//   if (!prices || prices.length < currentIndex + 1) {
//     return undefined;
//   }

//   const startIndex = Math.max(0, currentIndex - smaPeriod + 1);
//   const sum = prices
//     .slice(startIndex, currentIndex + 1)
//     .reduce((acc, price) => acc + price[1], 0);

//   return sum / Math.min(smaPeriod, currentIndex + 1);
// };

// // ... (previous imports)

// const MarketDataChart = ({ prices }) => {
//   // const tooltipRef = useRef(null);

//   const smaPeriod = 200;
//   const smaData = prices.map((item, index) => ({
//     x: item[0], // Use the timestamp as the x value
//     y:
//       index >= smaPeriod - 1
//         ? calculateSMA(index, prices, smaPeriod)
//         : undefined,
//     price: item[1], // Include the price in the tooltip data
//   }));

//   const priceList = prices.map((value) => value[1]); // Extract prices for YAxis

//   //   const data = [
//   //     {
//   //       data: prices.map((value, index) => ({
//   //         x: index,
//   //         y: value[1], // Use the price from the array
//   //       })),
//   //       svg: { stroke: "green" },
//   //     },
//   //     {
//   //       data: smaData,
//   //       svg: { stroke: "blue", strokeDasharray: [4, 4] },
//   //     },
//   //   ];

//   //console.log(smaData);
//   const data = [
//     {
//       data: prices.map((item) => ({
//         x: item[0],
//         y: item[1],
//       })),
//       svg: { stroke: "green" },
//     },
//     {
//       data: smaData,
//       svg: { stroke: "blue", strokeDasharray: [4, 4] },
//     },
//   ];

//   const labels = prices.map((item, index) => index.toString());
//   const labelsList = [];
//   const devider = Math.max(1, Math.ceil(labels.length / 50)); // Adjust the divider as needed

//   for (let i = 0; i < labels.length; i += devider) {
//     labelsList.push(labels[i]);
//   }

//   // const tooltipContent = (value) => (
//   //   <View
//   //     style={{
//   //       padding: 10,
//   //       backgroundColor: "rgba(0, 0, 0, 0.7)",
//   //       borderRadius: 5,
//   //     }}
//   //   >
//   //     <Text style={{ color: "white" }}>{value.toFixed(2)}</Text>
//   //   </View>
//   // );

//   return (
//     <View
//       style={{
//         height: 220,
//         flexDirection: "row",
//         backgroundColor: "white",
//         paddingHorizontal: 20,
//         borderRadius: 15,
//       }}
//     >
//       <YAxis
//         data={priceList}
//         contentInset={{ top: 20, bottom: 20 }}
//         svg={{ fill: "black", fontSize: 10 }}
//         numberOfTicks={5}
//         formatLabel={(value) => value.toFixed(2)}
//       />
//       <View style={{ flex: 1, marginLeft: 0 }}>
//         <LineChart
//           style={{ flex: 1 }}
//           data={data}
//           curve={shape.curveNatural}
//           contentInset={{ top: 20, bottom: 20 }}
//           yAccessor={({ item }) => item.y}
//           // onTooltipDisplay={({ item, x, y }) =>
//           //   item.y !== undefined &&
//           //   tooltipRef.current.showTooltip(tooltipContent(item.y), x, y)
//           // }
//         />
//         <XAxis
//           style={{ marginHorizontal: -10 }}
//           data={labelsList.map((value, index) => index)}
//           formatLabel={(value, index) => labelsList[index]}
//           contentInset={{ left: 10, right: 10 }}
//           svg={{ fontSize: 10, fill: "black" }}
//         />
//       </View>
//       {/* <Tooltip ref={tooltipRef} /> */}
//     </View>
//   );
// };

// export default MarketDataChart;

/// Newest working shit but we testing other stuff
// import React, { useRef } from "react";
// import { View, Text } from "react-native";
// import { LineChart, XAxis, YAxis } from "react-native-svg-charts";
// import Tooltip from "react-native-tooltip";
// import * as shape from "d3-shape";
// import {
//   PinchGestureHandler,
//   RotationGestureHandler,
//   GestureHandlerRootView,
// } from "react-native-gesture-handler";

// const calculateSMA = (currentIndex, prices, smaPeriod) => {
//   if (!prices || prices.length < currentIndex + 1) {
//     return undefined;
//   }

//   const startIndex = Math.max(0, currentIndex - smaPeriod + 1);
//   const sum = prices
//     .slice(startIndex, currentIndex + 1)
//     .reduce((acc, price) => acc + price[1], 0);

//   return sum / Math.min(smaPeriod, currentIndex + 1);
// };

// const MarketDataChart = ({ prices }) => {
//   const smaPeriod = 200;
//   const smaData = prices.map((item, index) => ({
//     x: item[0],
//     y:
//       index >= smaPeriod - 1
//         ? calculateSMA(index, prices, smaPeriod)
//         : undefined,
//     price: item[1],
//   }));

//   const priceList = prices.map((value) => value[1]);
//   const data = [
//     {
//       data: prices.map((item) => ({
//         x: item[0],
//         y: item[1],
//       })),
//       svg: { stroke: "green" },
//     },
//     {
//       data: smaData,
//       svg: { stroke: "blue", strokeDasharray: [4, 4] },
//     },
//   ];

//   const labels = prices.map((item, index) => index.toString());
//   const labelsList = [];
//   const devider = Math.max(1, Math.ceil(labels.length / 50));

//   for (let i = 0; i < labels.length; i += devider) {
//     labelsList.push(labels[i]);
//   }

//   return (
//     <GestureHandlerRootView>
//     <PinchGestureHandler>
//       <RotationGestureHandler>
//         <View
//           style={{
//             height: 220,
//             flexDirection: "row",
//             backgroundColor: "white",
//             paddingHorizontal: 20,
//             borderRadius: 15,
//           }}
//         >
//           <YAxis
//             data={priceList}
//             contentInset={{ top: 20, bottom: 20 }}
//             svg={{ fill: "black", fontSize: 10 }}
//             numberOfTicks={5}
//             formatLabel={(value) => value.toFixed(2)}
//           />
//           <View style={{ flex: 1, marginLeft: 0 }}>
//             <LineChart
//               style={{ flex: 1 }}
//               data={data}
//               curve={shape.curveNatural}
//               contentInset={{ top: 20, bottom: 20 }}
//               yAccessor={({ item }) => item.y}
//             />
//             <XAxis
//               style={{ marginHorizontal: -10 }}
//               data={labelsList.map((value, index) => index)}
//               formatLabel={(value, index) => labelsList[index]}
//               contentInset={{ left: 10, right: 10 }}
//               svg={{ fontSize: 10, fill: "black" }}
//             />
//           </View>
//         </View>
//       </RotationGestureHandler>
//     </PinchGestureHandler>
//     </GestureHandlerRootView>
//   );
// };

// export default MarketDataChart;

// The new newest one
// import React, { useState, useRef } from "react";
// import { View, Text, TouchableOpacity } from "react-native";
// import { LineChart, XAxis, YAxis } from "react-native-svg-charts";
// import Tooltip from "react-native-tooltip";
// import * as shape from "d3-shape";
// import {
//   PinchGestureHandler,
//   RotationGestureHandler,
//   GestureHandlerRootView,
// } from "react-native-gesture-handler";

// const calculateSMA = (currentIndex, prices, smaPeriod) => {
//   if (!prices || prices.length < currentIndex + 1) {
//     return undefined;
//   }

//   const startIndex = Math.max(0, currentIndex - smaPeriod + 1);
//   const sum = prices
//     .slice(startIndex, currentIndex + 1)
//     .reduce((acc, price) => acc + price[1], 0);

//   return sum / Math.min(smaPeriod, currentIndex + 1);
// };

// const MarketDataChart = ({ prices }) => {
//   const [visibleDataPoints, setVisibleDataPoints] = useState(prices.length); // Initial number of visible data points
//   const smaPeriod = 200;

//   const smaData = prices.map((item, index) => ({
//     x: item[0],
//     y:
//       index >= smaPeriod - 1
//         ? calculateSMA(index, prices, smaPeriod)
//         : undefined,
//     price: item[1],
//   }));

//   const limitedPrices = prices.slice(-visibleDataPoints); // Slice the prices to only show the last N data points
//   const limitedSmaData = smaData.slice(-visibleDataPoints);

//   const priceList = limitedPrices.map((value) => value[1]);

//   const data = [
//     {
//       data: limitedPrices.map((item) => ({
//         x: item[0],
//         y: item[1],
//       })),
//       svg: { stroke: "green" },
//     },
//     {
//       data: limitedSmaData,
//       svg: { stroke: "blue", strokeDasharray: [4, 4] },
//     },
//   ];

//   const labels = limitedPrices.map((item, index) => index.toString());
//   const labelsList = [];
//   const devider = Math.max(1, Math.ceil(labels.length / 50));

//   for (let i = 0; i < labels.length; i += devider) {
//     labelsList.push(labels[i]);
//   }

//   const handleLimitData = () => {
//     // Update the visible data points when the button is pressed
//     setVisibleDataPoints(visibleDataPoints + 60); // Change this value as needed
//   };
//   const removeLimitData = () => {
//     // Update the visible data points when the button is pressed
//     setVisibleDataPoints(visibleDataPoints - 60); // Change this value as needed
//   };

//   return (
//     <GestureHandlerRootView>
//       <PinchGestureHandler>
//         <RotationGestureHandler>
//           <View
//             style={{
//               height: 220,
//               flexDirection: "row",
//               backgroundColor: "white",
//               paddingHorizontal: 20,
//               borderRadius: 15,
//             }}
//           >
//             <YAxis
//               data={priceList}
//               contentInset={{ top: 20, bottom: 20 }}
//               svg={{ fill: "black", fontSize: 10 }}
//               numberOfTicks={5}
//               formatLabel={(value) => value.toFixed(2)}
//             />
//             <View style={{ flex: 1, marginLeft: 0 }}>
//               <LineChart
//                 style={{ flex: 1 }}
//                 data={data}
//                 curve={shape.curveNatural}
//                 contentInset={{ top: 20, bottom: 20 }}
//                 yAccessor={({ item }) => item.y}
//               />
//               <XAxis
//                 style={{ marginHorizontal: -10 }}
//                 data={labelsList.map((value, index) => index)}
//                 formatLabel={(value, index) => labelsList[index]}
//                 contentInset={{ left: 10, right: 10 }}
//                 svg={{ fontSize: 10, fill: "black" }}
//               />
//               <View style={{ flexDirection: "row" }}>
//                 <TouchableOpacity
//                   onPress={removeLimitData}
//                   style={{ padding: 10 }}
//                 >
//                   <Text>Zoom in</Text>
//                 </TouchableOpacity>
//                 <TouchableOpacity
//                   onPress={handleLimitData}
//                   style={{ padding: 10 }}
//                 >
//                   <Text>Zoom out</Text>
//                 </TouchableOpacity>
//               </View>
//             </View>
//           </View>
//         </RotationGestureHandler>
//       </PinchGestureHandler>
//     </GestureHandlerRootView>
//   );
// };

// export default MarketDataChart;

// import React, { useState, useEffect } from "react";
// import { View, Text, TouchableOpacity } from "react-native";
// import { LineChart, XAxis, YAxis } from "react-native-svg-charts";
// import * as shape from "d3-shape";
// import {
//   PinchGestureHandler,
//   RotationGestureHandler,
//   GestureHandlerRootView,
// } from "react-native-gesture-handler";

// const calculateSMA = (currentIndex, prices, smaPeriod) => {
//   if (!prices || prices.length < currentIndex + 1) {
//     return undefined;
//   }

//   const startIndex = Math.max(0, currentIndex - smaPeriod + 1);
//   const sum = prices
//     .slice(startIndex, currentIndex + 1)
//     .reduce((acc, price) => acc + price[1], 0);

//   return sum / Math.min(smaPeriod, currentIndex + 1);
// };

// const MarketDataChart = ({ prices }) => {
//   const [visibleDataPoints, setVisibleDataPoints] = useState(prices.length);
//   const [limitedPrices, setLimitedPrices] = useState(prices);
//   const [limitedSmaData, setLimitedSmaData] = useState([]);

//   const smaPeriod = 200;

//   useEffect(() => {
//     const smaData = prices.map((item, index) => ({
//       x: item[0],
//       y:
//         index >= smaPeriod - 1
//           ? calculateSMA(index, prices, smaPeriod)
//           : undefined,
//       price: item[1],
//     }));

//     setLimitedPrices(prices.slice(-visibleDataPoints));
//     setLimitedSmaData(smaData.slice(-visibleDataPoints));
//   }, [visibleDataPoints, prices]);

//   const priceList = limitedPrices.map((value) => value[1]);

//   const data = [
//     {
//       data: limitedPrices.map((item) => ({
//         x: item[0],
//         y: item[1],
//       })),
//       svg: { stroke: "green" },
//     },
//     {
//       data: limitedSmaData,
//       svg: { stroke: "blue", strokeDasharray: [4, 4] },
//     },
//   ];

//   const labels = limitedPrices.map((item, index) => index.toString());
//   const labelsList = labels.filter(
//     (_, index) => index % Math.ceil(labels.length / 50) === 0
//   );

//   const handleLimitData = (increment) => {
//     setVisibleDataPoints(visibleDataPoints + increment);
//   };

//   return (
//     <GestureHandlerRootView>
//       <PinchGestureHandler>
//         <RotationGestureHandler>
//           <View
//             style={{
//               height: 220,
//               flexDirection: "row",
//               backgroundColor: "white",
//               paddingHorizontal: 20,
//               borderRadius: 15,
//             }}
//           >
//             <YAxis
//               data={priceList}
//               contentInset={{ top: 20, bottom: 20 }}
//               svg={{ fill: "black", fontSize: 10 }}
//               numberOfTicks={5}
//               formatLabel={(value) => value.toFixed(2)}
//             />
//             <View style={{ flex: 1, marginLeft: 0 }}>
//               <LineChart
//                 style={{ flex: 1 }}
//                 data={data}
//                 curve={shape.curveNatural}
//                 contentInset={{ top: 20, bottom: 20 }}
//                 yAccessor={({ item }) => item.y}
//               />
//               <XAxis
//                 style={{ marginHorizontal: -10 }}
//                 data={labelsList}
//                 formatLabel={(value, index) => labelsList[index]}
//                 contentInset={{ left: 10, right: 10 }}
//                 svg={{ fontSize: 10, fill: "black" }}
//               />
//               <View style={{ flexDirection: "row" }}>
//                 <TouchableOpacity
//                   onPress={() => handleLimitData(-60)}
//                   style={{ padding: 10 }}
//                 >
//                   <Text>Zoom in</Text>
//                 </TouchableOpacity>
//                 <TouchableOpacity
//                   onPress={() => handleLimitData(60)}
//                   style={{ padding: 10 }}
//                 >
//                   <Text>Zoom out</Text>
//                 </TouchableOpacity>
//               </View>
//             </View>
//           </View>
//         </RotationGestureHandler>
//       </PinchGestureHandler>
//     </GestureHandlerRootView>
//   );
// };

// export default MarketDataChart;

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from "react-native";
import { LineChart, XAxis, YAxis } from "react-native-svg-charts";
import * as indicators from "technicalindicators";
import CombinedChart from "./AllChartsComponent";
import * as shape from "d3-shape";
import {
  PinchGestureHandler,
  RotationGestureHandler,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { FontAwesome } from "@expo/vector-icons";

const calculateSMA = (currentIndex, prices, smaPeriod) => {
  if (!prices || prices.length < currentIndex + 1) {
    return undefined;
  }

  const startIndex = Math.max(0, currentIndex - smaPeriod + 1);
  const sum = prices
    .slice(startIndex, currentIndex + 1)
    .reduce((acc, price) => acc + price[1], 0);

  return sum / Math.min(smaPeriod, currentIndex + 1);
};

const MarketDataChart = ({ prices, zoom }) => {
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

  const [visibleDataPoints, setVisibleDataPoints] = useState(zoom);
  const [limitedPrices, setLimitedPrices] = useState(prices);
  const [limitedSmaData, setLimitedSmaData] = useState([]);
  const [newPriceList, setNewPriceList] = useState([]);
  const [EMA, setEMA] = useState([]);
  const [HPDR, setHPDR] = useState([]);

  const smaPeriod = 200;

  useEffect(() => {
    const smaData = prices.map((item, index) => ({
      x: item[0],
      y:
        index >= smaPeriod - 1
          ? calculateSMA(index, prices, smaPeriod)
          : undefined,
      price: item[1],
    }));

    const thePrices = prices.map((item) => item[1]);
    setLimitedPrices(prices.slice(-visibleDataPoints));
    setNewPriceList(thePrices.slice(-visibleDataPoints));
    //console.log(newPriceList);
    setLimitedSmaData(smaData.slice(-visibleDataPoints));
  }, [zoom, visibleDataPoints, prices]);

  //OTHER EMA
  // useEffect(() => {
  //   const thePrices = prices.map((item) => item[1]);

  //   //console.log("Input Prices:", thePrices[0]);

  //   const EMAResult = indicators.EMA.calculate({
  //     period: 200,
  //     values: thePrices,
  //   });

  //   //console.log("EMA Result:", EMAResult);

  //   setEMA(EMAResult.slice(-visibleDataPoints));
  // }, [limitedPrices, prices, visibleDataPoints]);

  // useEffect(() => {
  //   const thePrices = prices.map((item) => item[1]);

  // }, [prices, visibleDataPoints]);

  useEffect(() => {
    const thePrices = prices.map((item) => item[1]);
    const { swingHighs, swingLows } = identifySwings(thePrices);

    if (swingLows.length > 0) {
      const fibLevelsLow = calculateFibonacciLevels(
        Math.min(...swingLows),
        Math.max(...swingHighs)
      );
      setFibonacciLevels(fibLevelsLow.splice(-visibleDataPoints));
    } else {
      setFibonacciLevels([]);
    }
  }, [prices, visibleDataPoints]);

  const priceList = limitedPrices.map((value) => value[1]);
  //console.log(priceList);

  const data = [
    {
      data: limitedPrices.map((item) => ({
        x: item[0],
        y: item[1],
      })),
      svg: { stroke: "green", strokeWidth: 2.2 },
    },
    {
      data: limitedSmaData,
      svg: { stroke: "blue", strokeDasharray: [2, 2], strokeWidth: 3 },
    },

    // {
    //   data: EMA,
    //   svg: { stroke: "yellow", strokeDasharray: [4, 4] },
    // },
  ];

  const fibData = [
    ...fibonacciLevels.map((level) => ({
      data: prices
        .map((item) => ({ x: item[0], y: level }))
        .splice(-visibleDataPoints),
      // svg: { stroke: "purple", strokeDasharray: [4, 4], strokeWidth: 3 },
      svg: { stroke: "purple", strokeWidth: 2 },
    })),
  ];

  const labels = limitedPrices.map((item) => {
    const date = new Date(item[0]);
    return `${date.getMonth() + 1}/${date.getDate()}/${
      date.getFullYear() - 2000
    }`;
  });

  const labelsList = labels.filter(
    (_, index) => index % Math.ceil(labels.length / 5) === 0
  );

  const handleLimitData = (increment) => {
    setVisibleDataPoints(visibleDataPoints + increment);
  };

  return limitedPrices && limitedSmaData && fibData ? (
    <View style={{ marginBottom: 20 }}>
      <GestureHandlerRootView>
        <PinchGestureHandler>
          <RotationGestureHandler>
            <View
              style={{
                height: 220,
                flexDirection: "row",
                backgroundColor: "white",
                paddingHorizontal: 20,
                borderRadius: 15,
                paddingVertical: 20,
              }}
            >
              <YAxis
                data={newPriceList}
                //contentInset={{ top: 20, bottom: 20 }}
                svg={{ fill: "black", fontSize: 10 }}
                numberOfTicks={5}
                formatLabel={(value) => value.toFixed(2)}
              />
              <View style={{ flex: 1, marginLeft: 0 }}>
                <Image
                  style={{
                    position: "absolute",
                    alignSelf: "flex-end",
                    width: "25%",
                    height: "30%",
                    opacity: 0.3, // Adjust the opacity as needed
                  }}
                  source={require("../../../imgs/logo.png")} // Replace with the path to your image
                />
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                  }}
                >
                  <CombinedChart
                    prices={prices}
                    zoom={visibleDataPoints}
                    xAxisLabels={labelsList}
                  />
                </View>
                <LineChart
                  style={{ flex: 1 }}
                  data={data}
                  curve={shape.curveNatural}
                  contentInset={{ top: 20, bottom: 20 }}
                  yAccessor={({ item }) => item.y}
                />
                <XAxis
                  style={{ marginHorizontal: 10 }}
                  data={labelsList}
                  formatLabel={(value, index) => labelsList[index]}
                  contentInset={{ left: 25, right: 25 }}
                  svg={{ fontSize: 10, fill: "black" }}
                />
              </View>
            </View>
          </RotationGestureHandler>
        </PinchGestureHandler>
      </GestureHandlerRootView>
      <View style={{ flexDirection: "row" }}>
        <TouchableOpacity
          onPress={() => handleLimitData(-60)}
          style={{ padding: 10 }}
        >
          <Text style={{ color: "white" }}>
            <FontAwesome name="search-plus" size={20} color="white" />
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleLimitData(60)}
          style={{ padding: 10 }}
        >
          <Text style={{ color: "white" }}>
            <FontAwesome name="search-minus" size={20} color="white" />
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : (
    <ActivityIndicator size={"large"} />
  );
};

export default MarketDataChart;
