// import React, { useState, useEffect } from 'react';
// import { View, Text, ActivityIndicator } from 'react-native';
// import { LineChart, ProgressCircle } from 'react-native-chart-kit';
// import * as shape from 'd3-shape';

// const AIChartComponent = ({ isLoggedIn, userId, coinId, historical_data, markers }) => {
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);
//   const [formattedMarkers, setformattedMarkers] = useState([]);

//   useEffect(() => {
//     if (!historical_data) {
//       setLoading(true)
//       return;
//     }
//     try{

//       setformattedMarkers(markers.buying_dates.map(date => ({ date, type: 'buy' }))
//       .concat(markers.selling_dates.map(date => ({ date, type: 'sell' }))));

//       setLoading(false);
//     } catch (e) {
//       console.log(e + "\n" + historical_data );
//       setError(e);
//       setLoading(false);
//     }
//   }, [historical_data, markers]);

//   if (!loading && !formattedMarkers && !historical_data) {
//     console.log("Formated markers" + formattedMarkers)
//     return <View><Text style={{color: 'white', alignSelf: 'center'}}>AI Buy/Sell trades</Text><Text style={{ color: 'white', alignSelf:'center', marginTop: 20}}>No data</Text></View>;
//   } else if (loading) {
//     return <ActivityIndicator size="large" />;
//   } else if (error) {
//     console.log(error.message);
//     return <View><Text style={{color: 'white', alignSelf: 'center'}}>AI Buy/Sell trades</Text><Text style={{ color: 'white', alignSelf:'center'}}>Unable to load data at this time</Text></View>;
//   }

//   return (
//     <View>
//       <Text style={{color: 'white', alignSelf: 'center'}}>AI Buy/Sell trades</Text>
//       <LineChart
//         data={historical_data}
//         width={350}
//         height={220}
//         chartConfig={{
//           backgroundGradientFrom: '#ffffff',
//           backgroundGradientTo: '#ffffff',
//           color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
//           strokeWidth: 2, // optional, default 3
//           barPercentage: 0.5,
//           useShadowColorFromDataset: false // optional
//         }}
//         bezier
//         style={{ marginVertical: 8, borderRadius: 16 }}
//         curve={shape.curveNatural}
//         verticalLabelRotation={30}
//       />
//       {/* Render markers */}
//       {formattedMarkers && formattedMarkers.map((marker, index) => (
//         <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
//           <ProgressCircle
//             style={{ height: 15, width: 15 }}
//             progress={1}
//             progressColor={'#00ff00'}
//             startAngle={0}
//             endAngle={Math.PI * 2}
//           />
//           <Text style={{ marginLeft: 5 }}>{marker.date}</Text> 
//         </View>
//       ))}
//     </View>
//   );
// };

// export default AIChartComponent;


import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { LineChart, ProgressCircle } from 'react-native-chart-kit';
import * as shape from 'd3-shape';

const AIChartComponent = ({ isLoggedIn, userId, coinId,historical_data, markers }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formattedMarkers, setFormattedMarkers] = useState([]);

  useEffect(() => {

    try {
      const formatted = [
        ...markers.buying_dates.map(date => ({ date, type: 'buy' })),
        ...markers.selling_dates.map(date => ({ date, type: 'sell' }))
      ];
      setFormattedMarkers(formatted);
      setLoading(false);
    } catch (e) {
      console.error('Error formatting markers:', e);
      setError(e);
      setLoading(false);
    }
  }, [historical_data, markers]);

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  if (error || !historical_data || !formattedMarkers.length) {
    return (
      <View>
        <Text>{error ? 'Unable to load data at this time' : 'No data'}</Text>
      </View>
    );
  }

  return (
    <View>
      <LineChart
        data={{
          datasets: [
            {
              data: historical_data.map(item => item['Close']),
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              strokeWidth: 2,
            },
          ],
        }}
        width={350}
        height={220}
        chartConfig={{
          backgroundGradientFrom: '#ffffff',
          backgroundGradientTo: '#ffffff',
          color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          strokeWidth: 2,
          barPercentage: 0.5,
          useShadowColorFromDataset: false,
        }}
        bezier
        style={{ marginVertical: 8, borderRadius: 16 }}
        curve={shape.curveNatural}
        verticalLabelRotation={30}
      />
      {/* Render markers */}
      {formattedMarkers.map((marker, index) => (
        <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
          <ProgressCircle
            style={{ height: 15, width: 15 }}
            progress={1}
            progressColor={marker.type === 'buy' ? '#00ff00' : '#ff0000'}
            startAngle={0}
            endAngle={Math.PI * 2}
          />
          <Text style={{ marginLeft: 5 }}>{marker.date}</Text>
        </View>
      ))}
    </View>
  );

};
export default AIChartComponent;
