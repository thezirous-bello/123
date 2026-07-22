import React, { useState, useEffect } from 'react';
import { View, Text, Dimensions, ActivityIndicator } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

const HoldingStatusPieChart = ({ transactions }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (transactions.length === 0) {
      return;
    }

    try {
      // Count the number of users with buy and sell transactions
      let longTermHolders = 0;
      let shortTermHolders = 0;

      transactions.forEach(transaction => {
        if (transaction.transaction_type === 'buy') {
          const buyQuantity = transaction.quantityBought;
          const sellTransactions = transactions.filter(
            t => t.user_id === transaction.user_id && t.transaction_type === 'sell'
          );
          const totalSellQuantity = sellTransactions.reduce((total, t) => total + t.quantityBought, 0);

          if (totalSellQuantity >= 0.5 * buyQuantity) {
            shortTermHolders++;
          } else {
            longTermHolders++;
          }
        }
      });

      const totalUsers = transactions.reduce((users, t) => (users.includes(t.user_id) ? users : [...users, t.user_id]), []).length;

      const chartData = [
        {
          name: 'Long-term',
          population: (longTermHolders / totalUsers) * 100,
          color: '#16c784',
        },
        {
          name: 'Short-term',
          population: (shortTermHolders / totalUsers) * 100,
          color: '#FF07C9',
        },
      ];

      setData(chartData);
      setLoading(false);
    } catch (e) {
      console.log(e);
      setError(e);
      setLoading(false);
    }
  }, [transactions]);

  if (!transactions) {
    return <Text style={{ color: 'white' }}>No data</Text>;
  } else if (loading) {
    return <ActivityIndicator size="large" />;
  } else if (error) {
    console.log(error.message);
    return <Text style={{ color: 'white' }}>Unable to load data at this time</Text>;
  }

  return (
    <View style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
        <Text style={{color: 'white', alignSelf: 'center'}}>Users Holding Status</Text>
        <PieChart
            data={data}
            width={screenWidth}
            height={220}
            
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
            paddingLeft={screenWidth / 4}
            absolute
            hasLegend={false} // Remove the legend from the right
            style={{
                borderRadius: 16, // This is the border radius for the chart container
                alignSelf: 'center', // Center the chart horizontally
            }}
        />

      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
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

export default HoldingStatusPieChart;
