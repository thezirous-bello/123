
// import React, { useState, useEffect } from 'react';
// import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';

// const ListOfSignals = ({ data }) => {
//   const [isLoading, setIsLoading] = useState(true);
//   const [signals, setSignals] = useState([]);

//   useEffect(() => {
//     if (data) {
//       const fetchSignals = async () => {
//         const fetchedSignals = await Promise.all(
//           data.map(async (item) => {
//             const price = item.price !== undefined ? item.price.toFixed(6) : 'N/A';
//             const priceMinus5 = item.price_minus_5 !== undefined ? item.price_minus_5.toFixed(6) : 'N/A';
//             const pricePlus5 = item.price_plus_5 !== undefined ? item.price_plus_5.toFixed(6) : 'N/A';

//             return {
//               ...item,
//               formattedPrice: price,
//               formattedPriceMinus5: priceMinus5,
//               formattedPricePlus5: pricePlus5,
//             };
//           })
//         );
//         // Reverse the fetched signals array
//         setSignals(fetchedSignals.reverse());
//         setIsLoading(false);
//       };

//       fetchSignals();
//     }
//   }, [data]);

//   if (isLoading) {
//     return <ActivityIndicator size="large" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} />;
//   }

//   return (
//     <>
//       <Text style={{ color: 'white', fontSize: 18, marginTop: 40, alignSelf: 'center' }}>Signals (not financial advice)</Text>
//       <FlatList
//         data={signals}
//         renderItem={({ item }) => (
//           <View style={[styles.card, item.value === 'buy' ? styles.buyCard : styles.sellCard]}>
//             <Text style={styles.text}>Timestamp: {new Date(item.timestamp).toLocaleString()}</Text>
//             <Text style={styles.text}>Action: {item.value.toUpperCase()}</Text>
//             <Text style={styles.text}>Price: ${item.formattedPrice}</Text>
//             {item.value == 'buy' ? 
//             <>
//             <Text style={styles.text}>Stop Loss (5%): ${item.formattedPriceMinus5 != 'N/A' ? item.formattedPriceMinus5 : ((parseFloat(item.formattedPrice) * 0.05) - parseFloat(item.formattedPrice)).toFixed(6)}</Text>
//             <Text style={styles.text}>Take Profit (5%): ${item.formattedPricePlus5 != 'N/A' ? item.formattedPricePlus5 : ((parseFloat(item.formattedPrice) * 0.05) + parseFloat(item.formattedPrice)).toFixed(6)}</Text>
//             <Text style={styles.text}>We will send a sell signal as well but it is way riskier!</Text>
//             </> : <></>}
//             </View>
//         )}
//         keyExtractor={(item, index) => index.toString()}
//         contentContainerStyle={styles.container}
//       />
//     </>
//   );
// };

// const styles = StyleSheet.create({
//   container: {
//     paddingBottom: 20,
//   },
//   card: {
//     marginVertical: 10,
//     marginHorizontal: 20,
//     padding: 15,
//     borderRadius: 10,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.25,
//     shadowRadius: 3.84,
//     elevation: 5,
//   },
//   buyCard: {
//     backgroundColor: '#119f69',
//   },
//   sellCard: {
//     backgroundColor: '#7f0364',
//   },
//   text: {
//     color: '#fff',
//     fontSize: 16,
//   },
// });

// export default ListOfSignals;

// components/ListOfSignals.js

// components/ListOfSignals.js

import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Image } from 'react-native';

const ListOfSignals = ({ data, image }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [signals, setSignals] = useState([]);

  useEffect(() => {
    const fetchSignals = async () => {
      if (!data || data.length === 0) {
        setSignals([]);
        setIsLoading(false);
        return;
      }

      const formattedSignals = await Promise.all(
        data.map(async (item, index) => {
          const price = item.price !== undefined ? item.price.toFixed(6) : 'N/A';
          const priceMinus5 = item.price_minus_5 !== undefined ? item.price_minus_5.toFixed(6) : 'N/A';
          const pricePlus5 = item.price_plus_5 !== undefined ? item.price_plus_5.toFixed(6) : 'N/A';

          let profitLossText = '';
          let profitLossTextPercent = '';

          if (item.value === 'sell') {
            const previousBuy = findPreviousBuySignal(data, index);
            
            if (previousBuy && previousBuy.price) {
              const buyPrice = parseFloat(previousBuy.price);
              const sellPrice = parseFloat(price);
              
              if (!isNaN(buyPrice) && !isNaN(sellPrice)) {
                const profitLoss = sellPrice - buyPrice;
                const profitLossPerc = 1 - (buyPrice / sellPrice);
                profitLossText = `Profit/Loss: $${profitLoss.toFixed(6)}`;
                profitLossTextPercent = `P/L %: ${profitLossPerc.toFixed(3) * 100}%`;
              }
            }
          }

          return {
            ...item,
            formattedPrice: price,
            formattedPriceMinus5: priceMinus5,
            formattedPricePlus5: pricePlus5,
            profitLossText: profitLossText,
            profitLossTextPercent: profitLossTextPercent,
          };
        })
      );

      setSignals(formattedSignals.reverse());
      setIsLoading(false);
    };

    fetchSignals();
  }, [data]);

  const findPreviousBuySignal = (data, currentIndex) => {
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (data[i].value === 'buy') {
        return data[i];
      }
    }
    return null;
  };

  if (isLoading) {
    return <ActivityIndicator size="large" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} />;
  }

  return (
    <View>
      <Text style={{ color: 'white', fontSize: 18, marginTop: 40, alignSelf: 'left', fontFamily:'Poppins_400Regular', marginLeft: 20 }}>Buy / Sell Signals <Text style={{fontSize: 10}}>{"\n"}(Only use Sell signal if buy was in up trend)</Text></Text>
      <FlatList
        data={signals}
        renderItem={({ item }) => (
          // <View style={[styles.card, item.value === 'buy' ? styles.buyCard : styles.sellCard]}>
          //   <Text style={styles.text}>Timestamp: {new Date(item.timestamp).toLocaleString()}</Text>
          //   <Text style={styles.text}>Action: {item.value.toUpperCase()}</Text>
          //   <Text style={styles.text}>Price: ${item.formattedPrice}</Text>
          //   {item.value === 'sell' ? 
          //       <>
          //         <Text style={styles.text}>{item.profitLossText}</Text>
          //         <Text style={styles.text}>{item.profitLossTextPercent}{console.log("jhsdbg   " + item.profitLossTextPercent)}</Text>
          //       </> 
          //   : null
          //   }

          //   {item.value === 'buy' ? 
          //     <>
          //       <Text style={styles.text}>Stop Loss (5%): ${item.formattedPriceMinus5 !== 'N/A' ? item.formattedPriceMinus5 : ((parseFloat(item.formattedPrice) * 0.95)).toFixed(6)}</Text>
          //       <Text style={styles.text}>Take Profit (5%): ${item.formattedPricePlus5 !== 'N/A' ? item.formattedPricePlus5 : ((parseFloat(item.formattedPrice) * 1.05)).toFixed(6)}</Text>
          //     </>
          //     : null}
          // </View>
          <View style={[styles.card, item.value === 'buy' ? styles.buyCard : styles.sellCard]}>
            <View style={{display: 'flex', flexDirection: 'row', justifyContent:'space-between', borderBottomWidth: 2, borderBottomColor:'rgba(127,3,100,0.8)'}}>
              <Text style={styles.signal}>{item.value.toUpperCase()}</Text>
              <Text style={styles.timeStamp}>{new Date(item.timestamp).toLocaleString()}</Text>
            </View>
            
            <View style={{display:'flex', flexDirection: 'row', paddingTop: 10}}>
              <View style={{backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, marginRight: 15, height:60}}>
                <Image source={{ uri: image }} style={styles.image} />
              </View>
              <View>
                
                <Text style={styles.text}>${item.formattedPrice > 0.1 ? parseFloat(item.formattedPrice).toFixed(2) : parseFloat(item.formattedPrice).toFixed(6)}</Text>
                {item.value === 'sell' ? 
                <>
                  <Text style={styles.text}>{item.profitLossText}</Text>
                  <Text style={styles.text}>{item.profitLossTextPercent}{console.log("jhsdbg   " + item.profitLossTextPercent)}</Text>
                </> 
                : null
                }

                {item.value === 'buy' ? 
                  <>
                    <Text style={styles.text}>Stop Loss (5%): ${item.formattedPriceMinus5 !== 'N/A' ? item.formattedPriceMinus5 : item.formattedPrice > 0.1 ? ((parseFloat(item.formattedPrice) * 0.95)).toFixed(2) : ((parseFloat(item.formattedPrice) * 0.95)).toFixed(6)}</Text>
                    <Text style={styles.text}>Take Profit (5%): ${item.formattedPricePlus5 !== 'N/A' ? item.formattedPricePlus5 : item.formattedPrice > 0.1 ? ((parseFloat(item.formattedPrice) * 1.05)).toFixed(2) : ((parseFloat(item.formattedPrice) * 1.05)).toFixed(6)}</Text>
                  </>
                  : null}
              </View>
              <View></View>
            </View>
          
          
        </View>
        )}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={styles.container}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 20,
  },
  card: {
    marginVertical: 10,
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 10
  },
  buyCard: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderColor: 'rgba(127,3,100,1)',
    borderWidth: 2
  },
  sellCard: {
    backgroundColor: 'rgba(127,3,100,0.5)',
  },
  text: {
    color: '#fff',
    fontFamily:'Poppins_400Regular',
    fontSize: 16,
  },
  signal: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Poppins_700Bold'
  },
  timeStamp: {
    color: '#fff',
    fontSize: 14,
    fontFamily:'Poppins_400Regular',
    textAlign: 'right'
  },
  image:{
    width: 60,
    height: 60,
    borderRadius: 20,
    opacity: 0.8,
    

  },
  // card: {
  //   marginVertical: 10,
  //   marginHorizontal: 20,
  //   padding: 15,
  //   borderRadius: 10,
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: 2 },
  //   shadowOpacity: 0.25,
  //   shadowRadius: 3.84,
  //   elevation: 5,
  // },
  // buyCard: {
  //   backgroundColor: '#119f69',
  // },
  // sellCard: {
  //   backgroundColor: '#7f0364',
  // },
  // text: {
  //   color: '#fff',
  //   fontSize: 16,
  // },
});

export default ListOfSignals;
