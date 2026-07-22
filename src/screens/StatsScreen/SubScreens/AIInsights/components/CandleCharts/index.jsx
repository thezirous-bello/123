// import React, { useState } from 'react';
// import { View, Text, ScrollView, Pressable, Modal, StyleSheet } from 'react-native';
// import { Svg, Rect, Line } from 'react-native-svg';

// const candleData = [
    
//   {
//     type: 'Basic Candles',
//     candles: [
//       {
//         name: 'Doji',
//         description: 'Indecision in the market. Open and close prices are nearly the same.',
//         bullish: false,
//         svg: <CandleSvg bodyHeight={2} wickHeight={20} bodyColor="gray" />,
//       },
//       {
//         name: 'Marubozu',
//         description: 'Strong momentum. No wicks, only body.',
//         bullish: true,
//         svg: <CandleSvg bodyHeight={30} wickHeight={0} bodyColor="green" />,
//       },
//     ],
//   },
//   {
//     type: 'Bullish Candles',
//     candles: [
//       {
//         name: 'Hammer',
//         description: 'Bullish reversal. Small body, long lower wick.',
//         bullish: true,
//         svg: <CandleSvg bodyHeight={5} wickHeight={20} bodyColor="green" wickPosition="bottom" />,
//       },
//       {
//         name: 'Bullish Engulfing',
//         description: 'Bullish reversal. Large green body engulfs previous red candle.',
//         bullish: true,
//         svg: <CandleSvg bodyHeight={30} wickHeight={10} bodyColor="green" />,
//       },
//     ],
//   },
//   {
//     type: 'Bearish Candles',
//     candles: [
//       {
//         name: 'Shooting Star',
//         description: 'Bearish reversal. Small body, long upper wick.',
//         bullish: false,
//         svg: <CandleSvg bodyHeight={5} wickHeight={20} bodyColor="#FF07C9" wickPosition="top" />,
//       },
//       {
//         name: 'Bearish Engulfing',
//         description: 'Bearish reversal. Large red body engulfs previous green candle.',
//         bullish: false,
//         svg: <CandleSvg bodyHeight={30} wickHeight={10} bodyColor="#FF07C9" />,
//       },
//     ],
//   },
// ];

// function CandleSvg({ bodyHeight, wickHeight, bodyColor, wickPosition = 'both' }) {
//   return (
//     <Svg height="50" width="30">
//       {wickPosition !== 'bottom' && <Line x1="15" y1="0" x2="15" y2={wickHeight} stroke="white" strokeWidth="2" />}
//       <Rect x="10" y={wickHeight} width="10" height={bodyHeight} fill={bodyColor} />
//       {wickPosition !== 'top' && <Line x1="15" y1={wickHeight + bodyHeight} x2="15" y2="50" stroke="white" strokeWidth="2" />}
//     </Svg>
//   );
// }

// export default function CandleGuide() {
//   const [modalVisible, setModalVisible] = useState(false);
//   const [selectedCandle, setSelectedCandle] = useState(null);

//   const handlePress = (candle) => {
//     setSelectedCandle(candle);
//     setModalVisible(true);
//   };

//   return (
//     <ScrollView style={styles.container}>
//       {candleData.map((group, index) => (
//         <View key={index}>
//           <Text style={styles.sectionTitle}>{group.type}</Text>
//           <View style={styles.grid}>
//             {group.candles.map((candle, i) => (
//               <Pressable key={i} style={styles.card} onPress={() => handlePress(candle)}>
//                 {candle.svg}
//                 <Text style={styles.cardTitle}>{candle.name}</Text>
//               </Pressable>
//             ))}
//           </View>
//         </View>
//       ))}
//       <Modal visible={modalVisible} transparent animationType="slide">
//         <View style={styles.modalContainer}>
//           <View style={styles.modalContent}>
//             <Text style={styles.modalTitle}>{selectedCandle?.name}</Text>
//             <Text style={styles.modalDescription}>{selectedCandle?.description}</Text>
//             <Pressable onPress={() => setModalVisible(false)} style={styles.closeButton}>
//               <Text style={styles.closeButtonText}>Close</Text>
//             </Pressable>
//           </View>
//         </View>
//       </Modal>
//     </ScrollView>
//   );
// }
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, StyleSheet } from 'react-native';
import { Svg, Rect, Line } from 'react-native-svg';

const candleData = [
  {
    type: 'Understanding Candlesticks',
    candles: [
      {
        name: 'Candle Anatomy',
        description: 'A candlestick has a body (price range between open and close) and wicks (high and low price range). Green means price closed higher, red means it closed lower.',
        svg: <CandleSvg bodyHeight={20} wickHeight={15} bodyColor="green" />,
      },
      {
        name: 'Wicks and Shadows',
        description: 'The wicks show the highest and lowest prices reached during the time period. Long wicks can signal price rejection or volatility.',
        svg: <CandleSvg bodyHeight={10} wickHeight={30} bodyColor="#FF07C9" />,
      },
    ],
  },
  {
    type: 'Bullish Candlestick Patterns',
    candles: [
      { name: 'Bullish Engulfing', description: 'A large green candle that fully engulfs the previous smaller red candle, signaling a reversal.', svg: <CandleSvg bodyHeight={25} wickHeight={10} bodyColor="green" /> },
      { name: 'Hammer', description: 'Bullish reversal. Small body, long lower wick.', svg: <CandleSvg bodyHeight={5} wickHeight={20} bodyColor="green" wickPosition="bottom" /> },
      { name: 'Morning Star', description: 'Bullish reversal pattern with a small-bodied candle between a long red and long green candle.', svg: <CandleSvg bodyHeight={15} wickHeight={10} bodyColor="green" /> },
      { name: 'Piercing Line', description: 'Reversal pattern where a green candle opens below the previous red close but closes above its midpoint.', svg: <CandleSvg bodyHeight={20} wickHeight={10} bodyColor="green" /> },
      { name: 'Marubozu', description: 'Strong momentum. No wicks, only body.', svg: <CandleSvg bodyHeight={30} wickHeight={0} bodyColor="green" /> },
      { name: 'Three White Soldiers', description: 'Three consecutive long green candles that close progressively higher, signaling a strong uptrend.', svg: <CandleSvg bodyHeight={30} wickHeight={5} bodyColor="green" /> },
    ],
  },
  {
    type: 'Bearish Candlestick Patterns',
    candles: [
      { name: 'Bearish Engulfing', description: 'A large red candle that fully engulfs the previous smaller green candle, signaling a reversal.', svg: <CandleSvg bodyHeight={25} wickHeight={10} bodyColor="#FF07C9" /> },
      { name: 'Shooting Star', description: 'Bearish reversal. Small body, long upper wick.', svg: <CandleSvg bodyHeight={5} wickHeight={20} bodyColor="#FF07C9" wickPosition="top" /> },
      { name: 'Evening Star', description: 'Bearish reversal pattern with a small-bodied candle between a long green and long red candle.', svg: <CandleSvg bodyHeight={15} wickHeight={10} bodyColor="#FF07C9" /> },
      { name: 'Dark Cloud Cover', description: 'Reversal pattern where a red candle opens above the previous green close but closes below its midpoint.', svg: <CandleSvg bodyHeight={20} wickHeight={10} bodyColor="#FF07C9" /> },
      { name: 'Three Black Crows', description: 'Three consecutive long red candles that close progressively lower, indicating a strong downtrend.', svg: <CandleSvg bodyHeight={30} wickHeight={5} bodyColor="#FF07C9" /> },
    ],
  },
  {
    type: 'Neutral Candlestick Patterns',
    candles: [
      { name: 'Doji', description: 'Indecision in the market. Open and close prices are nearly the same.', svg: <CandleSvg bodyHeight={2} wickHeight={20} bodyColor="gray" /> },
      { name: 'Spinning Top', description: 'Small body, long upper and lower wicks, indicating indecision.', svg: <CandleSvg bodyHeight={5} wickHeight={15} bodyColor="gray" /> },
      { name: 'Marubozu', description: 'Strong price movement in a single direction, no wicks.', svg: <CandleSvg bodyHeight={30} wickHeight={0} bodyColor="gray" /> },
    ],
  },
  {
    type: 'Continuation Candlestick Patterns',
    candles: [
      { name: 'Rising Three Methods', description: 'Bullish continuation pattern with small candles within a large green candle.', svg: <CandleSvg bodyHeight={20} wickHeight={10} bodyColor="green" /> },
      { name: 'Falling Three Methods', description: 'Bearish continuation pattern with small candles within a large red candle.', svg: <CandleSvg bodyHeight={20} wickHeight={10} bodyColor="#FF07C9" /> },
      { name: 'Mat Hold', description: 'A continuation pattern with a large candle followed by smaller ones, continuing the trend.', svg: <CandleSvg bodyHeight={25} wickHeight={10} bodyColor="green" /> },
    ],
  },
];

function CandleSvg({ bodyHeight, wickHeight, bodyColor, wickPosition = 'both' }) {
  return (
    <Svg height="50" width="30">
      {wickPosition !== 'bottom' && <Line x1="15" y1="0" x2="15" y2={wickHeight} stroke="white" strokeWidth="2" />}
      <Rect x="10" y={wickHeight} width="10" height={bodyHeight} fill={bodyColor} />
      {wickPosition !== 'top' && <Line x1="15" y1={wickHeight + bodyHeight} x2="15" y2="50" stroke="white" strokeWidth="2" />}
    </Svg>
  );
}

export default function CandleGuide() {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCandle, setSelectedCandle] = useState(null);

  const handlePress = (candle) => {
    setSelectedCandle(candle);
    setModalVisible(true);
  };

  return (
    <ScrollView style={styles.container}>
      {candleData.map((group, index) => (
        <View key={index}>
          <Text style={styles.sectionTitle}>{group.type}</Text>
          <View style={styles.grid}>
            {group.candles.map((candle, i) => (
              <Pressable key={i} style={styles.card} onPress={() => handlePress(candle)}>
                {candle.svg}
                <Text style={styles.cardTitle}>{candle.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        
      ))}
       <Modal visible={modalVisible} transparent animationType="slide">
         <View style={styles.modalContainer}>
           <View style={styles.modalContent}>
             <Text style={styles.modalTitle}>{selectedCandle?.name}</Text>
             <Text style={styles.modalDescription}>{selectedCandle?.description}</Text>
             <Pressable onPress={() => setModalVisible(false)} style={styles.closeButton}>
               <Text style={styles.closeButtonText}>Close</Text>
             </Pressable>
           </View>
         </View>
       </Modal>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#2D033B', marginVertical: 30, borderRadius: 25 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#E0B1CB', marginVertical: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', backgroundColor: '#810CA8', padding: 10, borderRadius: 10, marginVertical: 10, alignItems: 'center' },
  cardTitle: { marginTop: 10, color: '#FFF', fontWeight: 'bold' },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)' },
  modalContent: { padding: 20, backgroundColor: '#5B0888', borderRadius: 10, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFF' },
  modalDescription: { marginTop: 10, color: '#FFF', textAlign: 'center' },
  closeButton: { marginTop: 20, backgroundColor: '#E0B1CB', padding: 10, borderRadius: 5 },
  closeButtonText: { color: '#2D033B', fontWeight: 'bold' },
});

// Let me know if you want me to add more candle types or tweak the visuals! 🚀
