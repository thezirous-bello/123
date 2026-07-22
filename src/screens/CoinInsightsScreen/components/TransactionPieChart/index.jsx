//Working 2
import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, ActivityIndicator } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { getTransactionsForBuysAndSellsPerCoinActualNumber } from '../../../../services/requests';

const screenWidth = Dimensions.get('window').width;

const TransactionPieChart = ({ isLoggedIn, userId, coinId, transactions }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  useEffect(() => {
    if (transactions.length === 0) {
      setLoading(false)
      return;
    }

    try {
      const buyTransactions = transactions.find(t => t._id === 'buy')?.totalQuantity || 0;
      const sellTransactions = Math.abs(transactions.find(t => t._id === 'sell')?.totalQuantity || 0);
      const totalTransactions = buyTransactions + sellTransactions;

      if (totalTransactions === 0) {
        throw new Error('No transactions available');
      }

      const chartData = [
        {
          name: 'Buys',
          population: (buyTransactions / totalTransactions) * 100,
          color: '#16c784',
        },
        {
          name: 'Sells',
          population: (sellTransactions / totalTransactions) * 100,
          color: '#FF07C9',
        },
      ];

      setData(chartData);
      setLoading(false);
    } catch (e) {
      console.log(e + "\n" + transactions);
      setError(e);
      setLoading(false);
    }
  }, [transactions]);

  if (transactions.length === 0) {
    return <View><Text style={{color: 'white', alignSelf: 'center'}}>24HR - Buys / Sells</Text><Text style={{ color: 'white', alignSelf:'center', marginTop: 20}}>No data</Text></View>;
  } else if (loading) {
    return <ActivityIndicator size="large" />;
  } else if (error) {
    console.log(error.message);
    return <View><Text style={{color: 'white', alignSelf: 'center'}}>24HR - Buys / Sells</Text><Text style={{ color: 'white', alignSelf:'center'}}>Unable to load data at this time</Text></View>;
  }

  return (
    <View style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 10, paddingVertical: 20, paddingHorizontal: 10}}>
        <Text style={{color: 'white', alignSelf: 'center', fontFamily:'Poppins_400Regular'}}>24HR - Buys / Sells</Text>
        <PieChart
            data={data}
            width={screenWidth/2.5}
            height={110}
            
            chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFrom: 'transparent',
                backgroundGradientTo: 'transparent',
                color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                style: {
                borderWidth: 1,
                borderColor: '#FF07C9',
                },
            }}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft={screenWidth / 8}
            absolute
            hasLegend={false} // Remove the legend from the right
            style={{
                borderRadius: 16, // This is the border radius for the chart container
                alignSelf: 'center', // Center the chart horizontally
            }}
        />

      <View style={{ flexDirection: 'column', justifyContent: 'center', marginTop: 10 }}>
        {data.map((item, index) => (
          <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 5 }}>
            <View style={{ width: 10, height: 10, backgroundColor: item.color, marginRight: 5 }} />
            <Text style={{ color: '#7F7F7F' }}>{item.name}: {item.population.toFixed(2)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default TransactionPieChart;