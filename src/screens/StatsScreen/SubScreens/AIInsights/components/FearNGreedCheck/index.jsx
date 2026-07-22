import React, {useState} from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import Svg, { Circle, Line, Text as SvgText } from 'react-native-svg';
import Icon from "react-native-vector-icons/Ionicons";

const FearNGreedMiniGauge = ({ value, value_classification }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
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
      <View style={{display: 'flex', justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center'}}>
        <Text style={{
                        fontSize: 13,
                        fontFamily: 'Poppins_700Bold',
                        fontWeight: 'bold',
                        color: '#FFF',
                        textAlign: 'center'
            }}>{value_classification}</Text>
            {/* Status Icon + Info Button */}
        <View style={styles.infoContainer}>
            <TouchableOpacity onPress={() => setIsModalVisible(true)}>
            <Icon name="help-circle" size={20} color="white" style={styles.questionMarkIcon} />
            </TouchableOpacity>
        </View>
      </View>
      {/* Info Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsModalVisible(false)}>
            <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <Text style={styles.modalText}>
                    <Text style={styles.modalTitle}>📊 Why Fear & Greed Index Matters</Text>
                    <Text style={styles.modalText}>
                    - <Text style={styles.boldText}>Extreme Fear (Buy Opportunity):</Text> When the index is very low, it suggests that investors are overly fearful, often signaling a potential market bottom.{"\n"}
                    - <Text style={styles.boldText}>Extreme Greed (Sell Warning):</Text> A very high index value indicates excessive optimism, which can precede market corrections.{"\n\n"}
                    - The index helps identify <Text style={styles.boldText}>market sentiment shifts</Text>, which can aid in timing entries and exits more effectively.{"\n"}
                    - <Text style={styles.boldText}>Smart money</Text> often acts opposite to extreme sentiment—buying during fear and selling into greed.
                    </Text>
                </Text>
                <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Text style={styles.closeText}>Close</Text>
                </TouchableOpacity>
            </View>
            </View>
        </Modal>
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
    color: '#FF07C9',
  },
  value:{
    marginTop: 10,
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FF07C9',
  }, 
  infoContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  questionMarkIcon: {
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
    maxWidth: 300,
    alignItems: "center",
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
  },
  closeText: {
    color: "blue",
    fontWeight: "bold",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  boldText: {
    fontWeight: "bold",
  },
  modalText: {
    fontSize: 16,
  },
});

export default FearNGreedMiniGauge;
