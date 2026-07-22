// import React from "react";
// import { View, Dimensions, ActivityIndicator } from "react-native";
// import { LineChart } from "react-native-chart-kit";

// const MacdChart = (props) => {
//   const { macdData } = props;
//   //console.log(macdData);
//   const labels = macdData.map((item, index) => index.toString());
//   const macdValues = macdData.map((item) => item.MACD);
//   const signalValues = macdData.map((item) =>
//     item.signal !== undefined ? item.signal : 1
//   );
//   const histogramValues1 = macdData.map((item) =>
//     item.histogram !== undefined ? item.histogram : 1
//   );

//   const chartData = {
//     labels,
//     datasets: [
//       {
//         data: macdValues,
//         color: (opacity = 1) => `rgba(0, 255, 0, ${opacity})`, // MACD Line color
//       },
//       {
//         data: signalValues,
//         color: (opacity = 1) => `rgba(255, 0, 0, ${opacity})`, // Signal Line color
//       },
//       {
//         data: histogramValues1,
//         color: (opacity = 1) => `rgba(0, 0, 255, ${opacity})`, // Histogram color
//       },
//     ],
//   };

//   //console.log("MACD CHART DATA: " + chartData.datasets[0].data);

//   return (
//     <View>
//       {macdData ? (
//         <LineChart
//           data={chartData}
//           width={Dimensions.get("window").width}
//           height={220}
//           yAxisLabel=""
//           yAxisSuffix=""
//           yAxisInterval={50}
//           verticalLabelRotation={30}
//           chartConfig={{
//             backgroundGradientFrom: "#fff",
//             backgroundGradientTo: "#fff",
//             backgroundColor: "#fff",
//             color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
//             labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
//             style: {
//               borderRadius: 16,
//             },
//             propsForDots: { r: "0", strokeWidth: "0", stroke: "#ffa726" }, // Set propsForDots to null or adjust as needed
//             // {
//             //   r: "6",
//             //   strokeWidth: "2",
//             //   stroke: "#ffa726",
//             // }
//           }}
//           bezier
//           style={{
//             marginVertical: 8,
//             borderRadius: 16,
//           }}
//           decorator={() => (
//             <View
//               style={{
//                 marginTop: 110,
//                 width: "100%",
//                 alignItems: "center",
//               }}
//             >
//               <View
//                 style={{
//                   width: "100%",
//                   height: 2,
//                   backgroundColor: "red", // You can change the color of the reference line
//                 }}
//               />
//             </View>
//           )}
//         />
//       ) : (
//         <ActivityIndicator />
//       )}
//     </View>
//   );
// };

// export default MacdChart;

// import React from "react";
// import { View, Dimensions } from "react-native";
// import { LineChart, XAxis, YAxis } from "react-native-svg-charts";
// import { Grid } from "react-native-svg";

// const MacdChart = (props) => {
//   const { macdData } = props;

//   const labels = macdData.map((item, index) => index.toString());

//   const priceList = [];
//   //console.log(labels.length);
//   if (labels.length > 29 && labels.length < 365) {
//     const devider = 50;
//     for (let i = 0; i < labels.length; i += devider) {
//       if (i < labels.length) {
//         priceList.push(labels[i]);
//       }
//     }
//   } else if (labels.length < 29 && labels.length > 5) {
//     const devider = 2;
//     for (let i = 0; i < labels.length; i += devider) {
//       if (i < labels.length) {
//         priceList.push(labels[i]);
//       }
//     }
//   } else if (labels.length <= 366) {
//     const devider = 65;
//     for (let i = 0; i < labels.length; i += devider) {
//       if (i < labels.length) {
//         priceList.push(labels[i]);
//       }
//     }
//   } else if (labels.length > 366) {
//     const devider = 730;
//     //console.log("devider" + devider);
//     for (let i = 0; i < labels.length; i += devider) {
//       if (i < labels.length) {
//         priceList.push(labels[i]);
//       }
//     }
//   } else {
//     priceList.push(...labels);
//   }

//   const macdValues = macdData.map((item) => item.MACD);
//   const signalValues = macdData.map((item) =>
//     item.signal !== undefined ? item.signal : 1
//   );
//   const histogramValues = macdData.map((item) =>
//     item.histogram !== undefined ? item.histogram : 1
//   );

//   const data = [
//     {
//       data: macdValues,
//       svg: { stroke: "green" },
//     },
//     {
//       data: signalValues,
//       svg: { stroke: "red" },
//     },
//     {
//       data: histogramValues,
//       svg: { stroke: "blue"},
//     },
//   ];

//   return (
//     <View
//       style={{ height: 220, flexDirection: "row", backgroundColor: "white" }}
//     >
//       <YAxis
//         data={macdValues.concat(signalValues, histogramValues)}
//         contentInset={{ top: 20, bottom: 20 }}
//         svg={{ fill: "black", fontSize: 10 }}
//         numberOfTicks={5}
//         formatLabel={(value) => value.toFixed(2)}
//       />
//       <View style={{ flex: 1, marginLeft: 0 }}>
//         <LineChart
//           style={{ flex: 1 }}
//           data={data}
//           svg={{ stroke: "rgb(134, 65, 244)" }}
//           contentInset={{ top: 20, bottom: 20 }}
//         >
//           {/* <Grid /> */}
//         </LineChart>
//         <XAxis
//           style={{ marginHorizontal: -10 }}
//           data={priceList.map((value, index) => index)}
//           formatLabel={(value, index) => priceList[index]}
//           contentInset={{ left: 10, right: 10 }}
//           //interval={Math.ceil(labels.length / 5) - 1} // Adjusted interval
//           svg={{ fontSize: 10, fill: "black" }}
//         />
//       </View>
//     </View>
//   );
// };

// export default MacdChart;

// Same as the one above except i think its a zero line chart

// import React from "react";
// import { View, Dimensions } from "react-native";
// import { LineChart, XAxis, YAxis, BarChart } from "react-native-svg-charts";
// import { Grid } from "react-native-svg";

// const MacdChart = (props) => {
//   const { macdData } = props;

//   const labels = macdData.map((item, index) => index.toString());

//   const priceList = [];
//   if (labels.length > 29 && labels.length < 365) {
//     const devider = 50;
//     for (let i = 0; i < labels.length; i += devider) {
//       if (i < labels.length) {
//         priceList.push(labels[i]);
//       }
//     }
//   } else if (labels.length < 29 && labels.length > 5) {
//     const devider = 2;
//     for (let i = 0; i < labels.length; i += devider) {
//       if (i < labels.length) {
//         priceList.push(labels[i]);
//       }
//     }
//   } else if (labels.length <= 366) {
//     const devider = 65;
//     for (let i = 0; i < labels.length; i += devider) {
//       if (i < labels.length) {
//         priceList.push(labels[i]);
//       }
//     }
//   } else if (labels.length > 366) {
//     const devider = 730;
//     for (let i = 0; i < labels.length; i += devider) {
//       if (i < labels.length) {
//         priceList.push(labels[i]);
//       }
//     }
//   } else {
//     priceList.push(...labels);
//   }

//   const macdValues = macdData.map((item) => item.MACD);
//   const signalValues = macdData.map((item) =>
//     item.signal !== undefined ? item.signal : 0
//   );
//   const histogramValues = macdData.map((item) =>
//     item.histogram !== undefined ? item.histogram : 0
//   );

//   const data = [
//     {
//       data: macdValues,
//       svg: { stroke: "green" },
//     },
//     {
//       data: signalValues,
//       svg: { stroke: "red" },
//     },
//   ];
//   const otherData = [
//     {
//       data: histogramValues,
//       svg: { stroke: "blue" },
//     },
//   ];

//   return (
//     <View
//       style={{ height: 220, flexDirection: "row", backgroundColor: "white" }}
//     >
//       <YAxis
//         data={macdValues.concat(signalValues, histogramValues)}
//         contentInset={{ top: 20, bottom: 20 }}
//         svg={{ fill: "black", fontSize: 10 }}
//         numberOfTicks={5}
//         formatLabel={(value) => value.toFixed(2)}
//       />
//       <View style={{ flex: 1, marginLeft: 0 }}>
//         <LineChart
//           style={{ flex: 1 }}
//           data={data}
//           svg={{ stroke: "rgb(134, 65, 244)" }}
//           contentInset={{ top: 20, bottom: 20 }}
//         >
//           {/* <Grid /> */}
//         </LineChart>
//         <BarChart
//           style={{ flex: 1 }}
//           data={otherData}
//           spacingInner={0.1}
//           contentInset={{ top: 20, bottom: 20 }}
//         ></BarChart>

//         <XAxis
//           style={{ marginHorizontal: -10 }}
//           data={priceList.map((value, index) => index)}
//           formatLabel={(value, index) => priceList[index]}
//           contentInset={{ left: 10, right: 10 }}
//           svg={{ fontSize: 10, fill: "black" }}
//         />
//       </View>
//     </View>
//   );
// };

// export default MacdChart;

// Some random bar chart shit that dont work
// import React from "react";
// import { View } from "react-native";
// import { BarChart, XAxis, YAxis } from "react-native-svg-charts";

// const MacdChart = (props) => {
//   const { macdData } = props;

//   const labels = macdData.map((item, index) => index.toString());

//   const macdValues = macdData.map((item) => item.MACD);
//   const signalValues = macdData.map((item) =>
//     item.signal !== undefined ? item.signal : 0
//   );
//   const histogramValues = macdData.map((item) =>
//     item.histogram !== undefined ? item.histogram : 0
//   );

//   const data = [
//     {
//       data: macdValues.map((value, index) => ({
//         value,
//         svg: { fill: value >= 0 ? "green" : "red" },
//       })),
//     },
//     {
//       data: signalValues.map((value, index) => ({
//         value,
//         svg: { fill: "red" },
//       })),
//     },
//     {
//       data: histogramValues.map((value, index) => ({
//         value,
//         svg: { fill: value >= 0 ? "green" : "red" },
//       })),
//     },
//   ];

//   return (
//     <View style={{ flex: 1, flexDirection: "row" }}>
//       <YAxis
//         data={macdValues.concat(signalValues, histogramValues)}
//         contentInset={{ top: 20, bottom: 20 }}
//         svg={{ fill: "black", fontSize: 10 }}
//         numberOfTicks={5}
//         formatLabel={(value) => value.toFixed(2)}
//       />
//       <View style={{ flex: 1, marginLeft: 0 }}>
//         <BarChart
//           style={{ flex: 1 }}
//           data={data}
//           spacingInner={0.1}
//           contentInset={{ top: 20, bottom: 20 }}
//         >
//           {/* <Grid /> */}
//         </BarChart>
//         <XAxis
//           style={{ marginHorizontal: -10 }}
//           data={data[0].data} // Use the data array for the first dataset
//           formatLabel={(value, index) => labels[index]}
//           contentInset={{ left: 10, right: 10 }}
//           svg={{ fontSize: 10, fill: "black" }}
//         />
//       </View>
//     </View>
//   );
// };

// export default MacdChart;

import React, { useState, useEffect } from "react";
import {
  View,
  Dimensions,
  TouchableOpacity,
  Text,
  Image,
  ActivityIndicator,
} from "react-native";
import {
  LineChart,
  XAxis,
  YAxis,
  BarChart,
  //Tooltip,
} from "react-native-svg-charts";
import { FontAwesome } from "@expo/vector-icons";

const MacdChart = (props) => {
  const { macdData, zoom, xAxisLabels } = props;

  const [visibleDataPoints, setVisibleDataPoints] = useState(zoom);
  const [macd, setMacd] = useState([]);
  const [signal, setSignal] = useState([]);
  const [histogram, setHistogram] = useState([]);
  const [xAxiss, setXAxiss] = useState([]);
  const [labelsList, setLabelsList] = useState([]);

  const labels = macdData.map((item, index) => index.toString());

  const priceList = [];
  if (labels.length > 29 && labels.length < 365) {
    // ... (same as before)
  } else {
    priceList.push(...labels);
  }

  const macdValues = macdData.map((item) => item.MACD);
  const signalValues = macdData.map((item) =>
    item.signal !== undefined ? item.signal : 0
  );
  const histogramValues = macdData.map((item) =>
    item.histogram !== undefined ? item.histogram : 0
  );

  useEffect(() => {
    setXAxiss(xAxisLabels);
  }, [xAxisLabels]);

  useEffect(() => {
    setMacd(macdValues.slice(-visibleDataPoints));
    setSignal(signalValues.slice(-visibleDataPoints));
    setHistogram(histogramValues.slice(-visibleDataPoints));
    //setXAxiss(xAxisLabels.slice(-visibleDataPoints));
  }, [zoom, visibleDataPoints]);

  // useEffect(() => {
  //   console.log(xAxiss);
  //   const filteredLabelsList = xAxiss
  //     .slice(-visibleDataPoints)
  //     .filter((_, index) => index % Math.ceil(labels.length / 5) === 0);
  //   setLabelsList(filteredLabelsList);
  //   console.log(filteredLabelsList);
  // }, [xAxiss, visibleDataPoints]);
  useEffect(() => {
    const availableLabels = xAxiss.slice(-visibleDataPoints);

    // Ensure that labelsList always contains 5 dates, evenly distributed
    const step = Math.max(1, Math.ceil(availableLabels.length / 5));
    const filteredLabelsList = availableLabels
      .filter((_, index) => index % step === 0)
      .slice(-5);

    setLabelsList(filteredLabelsList);
  }, [xAxiss, visibleDataPoints]);

  const data = [
    {
      data: macd,
      svg: { stroke: "green", strokeWidth: 2.5 },
    },
    {
      data: signal,
      svg: { stroke: "red", strokeWidth: 2.5 },
    },
  ];

  const otherData = [
    {
      data: histogram,
      // svg: { fill: "#8930D5", opacity: 0.6 }, // Use fill property for BarChart
      svg: { fill: "#ff00fe", opacity: 0.6 }, // Use fill property for BarChart
    },
  ];
  const handleLimitData = (increment) => {
    setVisibleDataPoints(visibleDataPoints + increment);
  };
  return macdData ? (
    <View>
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#222222",
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderRadius: 15,
        }}
      >
        <YAxis
          data={macdValues.concat(signalValues, histogramValues)}
          contentInset={{ top: 20, bottom: 20 }}
          svg={{ fill: "#ff94f7", fontSize: 10 }}
          numberOfTicks={5}
          formatLabel={(value) => value.toFixed(2)}
          style={{ height: 240 }}
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
            <BarChart
              style={{ flex: 1 }}
              data={otherData}
              spacingInner={0.1}
              contentInset={{ top: 20, bottom: 20 }}
            />
          </View>
          <LineChart
            style={{ flex: 1 }}
            data={data}
            svg={{ stroke: "rgb(134, 65, 244)" }}
            contentInset={{ top: 20, bottom: 20 }}
          />
          <XAxis
            style={{ marginHorizontal: 10 }}
            data={labelsList}
            formatLabel={(value, index) => labelsList[index]}
            contentInset={{ left: 25, right: 25 }}
            svg={{ fontSize: 10, fill: "#ff94f7" }}
          />
        </View>
      </View>
      <View style={{ flexDirection: "row" }}>
        <TouchableOpacity
          onPress={() => handleLimitData(-60)}
          style={{ padding: 10, color: "white" }}
        >
          <Text style={{ color: "white" }}>
            {/* Zoom in{" "} */}
            <FontAwesome
              name="search-plus"
              size={20}
              color="white"
              style={{ marginLeft: 2 }}
            />
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleLimitData(60)}
          style={{ padding: 10, color: "white" }}
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

export default MacdChart;
