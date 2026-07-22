// import React, { useState, useEffect } from 'react';
// import { View, Text, Dimensions, ActivityIndicator } from 'react-native';
// import { LineChart } from 'react-native-chart-kit';
// import { fetchSuperTrend } from '../../../../services/requests'; // Adjust the path accordingly

// const screenWidth = Dimensions.get('window').width;

// const calculateMean = (closePrices, startIdx, endIdx) => {
//   if (startIdx < 0 || endIdx >= closePrices.length || startIdx > endIdx) {
//     throw new Error('Invalid indices provided');
//   }

//   const subset = closePrices.slice(startIdx, endIdx + 1);
//   const sum = subset.reduce((acc, val) => acc + val, 0);
//   const mean = sum / subset.length;
//   return mean;
// }

// const SuperTrend = ({ isLoggedIn, userId, coinId }) => {
//   const [data, setData] = useState(null);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     const fetchData = async () => {
//       setLoading(true);
//       try {
        
//         const superTrendData = await fetchSuperTrend(coinId, '90m','3','7');

//         if (!superTrendData) {
//           return (
//             <View>
//               <Text>No data available</Text>
//             </View>
//           );
//         }
//         setData(superTrendData[0]);
//         setLoading(false);
//       } catch (error) {
//         console.error('Error fetching super trend data:', error);
//         setError(error.message);
//         setLoading(false);
//       }
//     };

//     fetchData();
//   }, [coinId]);

//   if (loading || !coinId || !data) {
//     return <ActivityIndicator size="large" />;
//   }

//   if (error) {
//     return (
//       <View>
//         <Text>Error: {error}</Text>
//       </View>
//     );
//   }

//   const { trend, ClosePrices } = data;

//   // Ensure ClosePrices is an array and has at least 7 elements before slicing
//   //const chartData = ClosePrices.length >= 7 ? ClosePrices.slice(-7) : ClosePrices;

//   var day1 = calculateMean(ClosePrices, ClosePrices.length - 16, ClosePrices.length);
//   var day2 = calculateMean(ClosePrices, ClosePrices.length - 32, ClosePrices.length-16);
//   var day3 = calculateMean(ClosePrices, ClosePrices.length - 48, ClosePrices.length-32);
//   var day4 = calculateMean(ClosePrices, ClosePrices.length - 64, ClosePrices.length-64);
//   var day5 = calculateMean(ClosePrices, ClosePrices.length - 80, ClosePrices.length -80);
//   var day6 = calculateMean(ClosePrices, ClosePrices.length - 96, ClosePrices.length-96);
//   var day7 = calculateMean(ClosePrices, ClosePrices.length - 112, ClosePrices.length-112);
//   const chartData = [day1, day2, day3, day4, day5, day6, day7];

//   return (
//     <View style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, paddingVertical: 20, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}>
//       <Text style={{ marginBottom: 10, color: 'white', alignSelf: 'center', fontFamily:'Poppins_400Regular', fontSize: 14}}>{`SuperTrend: ${'\n'} ${trend}`}</Text>
//       <Text style={{ marginBottom: 10, color: 'white', alignSelf: 'center', fontFamily:'Poppins_400Regular', fontSize: 12}}>(Short-Term)</Text>
//       <LineChart
//         data={{
//           //labels: ['1', '2', '3', '4', '5', '6', '7'], // Example labels
//           datasets: [
//             {
//               data: chartData, // Display last 7 close prices if available
//             },
//           ],
//         }}
//         ithHorizontalLabels={false}
//         width={screenWidth / 2.5}
//         height={110}
//         yAxisLabel="" // Set yAxisLabel to empty string to remove prices from the left
//         chartConfig={{
//           backgroundGradientFromOpacity: 0,
//           backgroundGradientToOpacity: 0,
//           // backgroundGradientTo: 'transparent', // Set background gradient end color to transparent
//           //color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`, // Set chart color
//           color: () => '#FF07C9', // Set chart color
//           style: {
//             borderRadius: 16,
//           },
//           decimalPlaces: 2, // Set decimal places for chart values
//           propsForLabels: {
//             fontSize: 10,
//           },
//           propsForDots: {
//             r: "0", // Set dot radius to 0 to hide dots
//             strokeWidth: "2", // Set dot stroke width to 2
//           },
//           propsForBackgroundLines: {
//             stroke: "transparent", // Set background line color to transparent
//           },
//         }}
//         bezier
//         style={{
//           marginVertical: 8,
//           borderRadius: 16,
//           paddingRight: 0
//         }}
//       />
//     </View>
//   );
// };
 
// export default SuperTrend;

import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, ActivityIndicator } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { fetchSuperTrend } from '../../../../services/requests'; // Adjust the path accordingly

const screenWidth = Dimensions.get('window').width;

const calculateMean = (closePrices, startIdx, endIdx) => {
  if (startIdx < 0 || endIdx >= closePrices.length || startIdx > endIdx) {
    throw new Error('Invalid indices provided');
  }

  const subset = closePrices.slice(startIdx, endIdx + 1);
  const sum = subset.reduce((acc, val) => acc + val, 0);
  const mean = sum / subset.length;
  return mean;
};

const SuperTrend = ({ isLoggedIn, userId, coinId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const superTrendData = await fetchSuperTrend(coinId, '90m', '3', '7');

        if (!superTrendData || superTrendData.length === 0) {
          throw new Error('No data available');
        }

        setData(superTrendData[0]);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching super trend data:', error);
        setError(error.message);
        setLoading(false);
      }
    };

    fetchData();
  }, [coinId]);

  if (loading || !coinId || !data) {
    return <ActivityIndicator size="large" />;
  }

  if (error) {
    return (
      <View>
        <Text>Error: {error}</Text>
      </View>
    );
  }

  const { trend, ClosePrices } = data;

  // Calculate means for the past 7 periods (90 minutes each)
  const day1 = calculateMean(ClosePrices, ClosePrices.length - 16, ClosePrices.length - 1);
  const day2 = calculateMean(ClosePrices, ClosePrices.length - 32, ClosePrices.length - 17);
  const day3 = calculateMean(ClosePrices, ClosePrices.length - 48, ClosePrices.length - 33);
  const day4 = calculateMean(ClosePrices, ClosePrices.length - 64, ClosePrices.length - 49);
  const day5 = calculateMean(ClosePrices, ClosePrices.length - 80, ClosePrices.length - 65);
  const day6 = calculateMean(ClosePrices, ClosePrices.length - 96, ClosePrices.length - 81);
  const day7 = calculateMean(ClosePrices, ClosePrices.length - 112, ClosePrices.length - 97);
  // const day1 = ClosePrices[ClosePrices.length - 1];
  // const day2 = ClosePrices[ClosePrices.length - 17];
  // const day3 = ClosePrices[ClosePrices.length - 33];
  // const day4 = ClosePrices[ClosePrices.length - 49];
  // const day5 = ClosePrices[ClosePrices.length - 65];
  // const day6 = ClosePrices[ClosePrices.length - 81];
  // const day7 = ClosePrices[ClosePrices.length - 97];

  const chartData = [day7, day6, day5, day4, day3, day2, day1];

  console.log(ClosePrices)
  console.log(chartData)

  return (
    <View style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }}>
      {/* <Text style={{ marginBottom: 10, color: 'white', alignSelf: 'center', fontFamily: 'Poppins_400Regular', fontSize: 14 }}>{`SuperTrend: ${'\n'} ${trend}`}</Text> */}
      <Text style={{ marginBottom: 10, color: 'white', alignSelf: 'center', fontFamily: 'Poppins_400Regular', fontSize: 14 }}>{`SuperTrend`}</Text>
      <Text style={{ marginBottom: 10, color: 'white', alignSelf: 'center', fontFamily: 'Poppins_400Regular', fontSize: 12 }}>(Short-Term)</Text>
      <LineChart
        data={{
          datasets: [
            {
              data: chartData,
            },
          ],
        }}
        width={screenWidth / 2.5}
        height={110}
        yAxisLabel=""
        chartConfig={{
          backgroundGradientFromOpacity: 0,
          backgroundGradientToOpacity: 0,
          color: () => '#FF07C9',
          style: {
            borderRadius: 16,
          },
          decimalPlaces: 2,
          propsForLabels: {
            fontSize: 10,
          },
          propsForDots: {
            r: "0",
            strokeWidth: "2",
          },
          propsForBackgroundLines: {
            stroke: "transparent",
          },
        }}
        bezier
        style={{
          marginVertical: 8,
          borderRadius: 16,
          paddingRight: 0
        }}
      />
    </View>
  );
};

export default SuperTrend;
