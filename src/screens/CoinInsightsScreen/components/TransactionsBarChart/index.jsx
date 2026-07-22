import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { getTransactionsForBuysAndSellsPerCoinActualNumber } from '../../../../services/requests';

const screenWidth = Dimensions.get('window').width;

const TransactionBarChart = ({ isLoggedIn, userId, coinId, transactions }) => {
  const [chartData, setChartData] = useState(null);
  const [TransData, setTransData] = useState(null);

  useEffect(() => {
    // const fetchData = async () => {
    //   const transactions = await getTransactionsForBuysAndSellsPerCoinActualNumber(isLoggedIn, userId, coinId);
    //   processChartData(transactions);
    //   setTransData(transactions);
    // };

    // fetchData();
    console.log(transactions)
    processChartData(transactions);
  }, [isLoggedIn, userId, coinId, transactions]);

  const processChartData = (transactions) => {
    if (!transactions || transactions.length === 0) {
      return;
    }

    const buys = transactions.find(t => t._id === 'buy');
    const sells = transactions.find(t => t._id === 'sell');

    const data = {
      labels: ['Buys', 'Sells'],
      datasets: [
        {
          data: [
            buys ? buys.totalQuantity : 0,
            sells ? Math.abs(sells.totalQuantity) : 0,
          ],
        },
      ],
    };

    setChartData(data);
  };

  if (!chartData) {
    return <Text>Loading...</Text>;
  }

  return (
    <View>
      <Text style={{ textAlign: 'center', fontSize: 18, marginBottom: 10 }}>Buys and Sells</Text>
      <BarChart
        style={{ marginVertical: 8, borderRadius: 16 }}
        data={chartData}
        width={screenWidth - 16}
        height={220}
        yAxisLabel=""
        chartConfig={{
          backgroundColor: '#e26a00',
          backgroundGradientFrom: '#fb8c00',
          backgroundGradientTo: '#ffa726',
          decimalPlaces: 2,
          color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          style: {
            borderRadius: 16,
          },
          propsForDots: {
            r: '6',
            strokeWidth: '2',
            stroke: '#ffa726',
          },
        }}
        verticalLabelRotation={30}
      />
    </View>
  );
};

export default TransactionBarChart;

// import React, { useEffect, useState } from 'react';
// import { View, Text } from 'react-native';
// import { BarChart } from 'react-native-chart-kit';
// import { Dimensions } from 'react-native';
// import { getTransactionsForBuysAndSellsPerCoin } from '../../../../services/requests';

// const screenWidth = Dimensions.get('window').width;

// const TransactionBarChart = ({ isLoggedIn, userId, coinId }) => {
//   const [chartData, setChartData] = useState(null);

//   useEffect(() => {
//     const fetchData = async () => {
//       const transactions = await getTransactionsForBuysAndSellsPerCoin(isLoggedIn, userId, coinId);
//       processChartData(transactions);
//     };

//     fetchData();
//   }, [isLoggedIn, userId, coinId]);

//   const processChartData = (transactions) => {
//     if (!transactions || transactions.length === 0) {
//       return;
//     }

//     const buys = transactions.find(t => t.type === 'buy');
//     const sells = transactions.find(t => t.type === 'sell');


//     const data = {
//         labels: ['Buys', 'Sells'],
//         datasets: [
//           {
//             data: [
//               buys ? buys.percentage : 0,
//               sells ? (sells.percentage * -1) : 0,
//             ],
//             colors: [
//               () => `rgba(22, 199, 132, 1)`,  // Color for buys
//               () => `rgba(255, 7, 201, 1)`,   // Color for sells
//             ],
//           },
//         ],
//       };

//     setChartData(data);
//   };

//   if (!chartData) {
//     return <Text>Loading...</Text>;
//   }

//   return (
//     <View style={{marginHorizontal: 15,}}>
//       <Text style={{ textAlign: 'center', fontSize: 18, marginBottom: 10 }}>Buys and Sells (Percentage)</Text>
//       <BarChart
//         style={{ 
//           marginVertical: 8, 
//           borderRadius: 16, 
//           backgroundColor: 'transparent', 
//           borderWidth: 1, 
//           borderColor: '#FF07C9' 
//         }}
//         data={chartData}
//         width={screenWidth -43}
//         height={220}
//         yAxisLabel="%"
//         // chartConfig={{
//         //   backgroundColor: '#2c2c2c',
//         //   backgroundGradientFrom: '#2c2c2c',
//         //   backgroundGradientTo: '#2c2c2c',
//         //   decimalPlaces: 2,
//         //   color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
//         //   labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
//         //   style: {
//         //     borderRadius: 16,
//         //   },
//         //   propsForBackgroundLines: { 
//         //     strokeWidth: 1,
//         //     stroke: "#fff",
//         //     strokeDasharray: "0",
//         //   },
//         // }}
//         chartConfig={{
//                       backgroundColor: '#e26a00',
//                       backgroundGradientFrom: '#fb8c00',
//                       backgroundGradientTo: '#ffa726',
//                       decimalPlaces: 2,
//                       color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
//                       labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
//                       style: {
//                         borderRadius: 16,
//                       },
//                       propsForDots: {
//                         r: '6',
//                         strokeWidth: '2',
//                         stroke: '#ffa726',
//                       },
//                     }}

//       />
//     </View>
//   );
// };

// export default TransactionBarChart;




