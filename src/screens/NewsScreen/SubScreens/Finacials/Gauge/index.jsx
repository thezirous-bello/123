import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';

const Gauge = ({ value }) => {
  const size = 200;
  const strokeWidth = 10;
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const angle = (value / 100) * 180 + 180; // Adjusted the angle calculation

  const x2 = center + radius * Math.cos((angle * Math.PI) / 180);
  const y2 = center + radius * Math.sin((angle * Math.PI) / 180);

  return (
    <View style={styles.container}>
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
          fontSize={24}
          fill="#FF07C9"
          textAnchor="middle"
        >
          {value}
        </SvgText>
      </Svg>
      <Text style={styles.label}>Fear and Greed Index</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF07C9',
  },
});

export default Gauge;
