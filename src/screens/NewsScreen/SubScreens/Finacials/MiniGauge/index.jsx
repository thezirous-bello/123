import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

const MiniGauge = ({ value }) => {
  const size = 100;
  const strokeWidth = 5;
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const angle = (value / 100) * 180 + 180; // Adjusted the angle calculation

  const x2 = center + radius * Math.cos((angle * Math.PI) / 180);
  const y2 = center + radius * Math.sin((angle * Math.PI) / 180);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Fear & Greed Index</Text>
      <Svg width={size} height={size / 2}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#ddd"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Line
          x1={center}
          y1={center}
          x2={x2}
          y2={y2}
          stroke="#FF07C9"
          strokeWidth={strokeWidth}
        />
        <SvgText
          x={center}
          y={center + 30}
          fontSize={18}
          fill="#FF07C9"
          textAnchor="middle"
        >
          {value}
        </SvgText>
      </Svg>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    marginBottom: 10,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFF',
  },
  value:{
    marginTop: 10,
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFF',
  }
});

export default MiniGauge;
