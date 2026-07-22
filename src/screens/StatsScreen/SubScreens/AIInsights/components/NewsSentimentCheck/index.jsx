import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import Svg, { Rect } from "react-native-svg";
import Icon from "react-native-vector-icons/Ionicons";

const NewsSentimentIndicator = ({ sentimentData }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  const totalWidth = 300; // Width of sentiment bar
  const positiveWidth = (sentimentData.positive / 100) * totalWidth;
  const negativeWidth = (sentimentData.negative / 100) * totalWidth;

  // Determine Buy/Sell status
  const sentimentStatus = sentimentData.positive > sentimentData.negative ? "buy" : "sell";

  // Render status icon
  const renderStatusIcon = () => {
    if (sentimentStatus === "buy") {
      return (
        <View style={[styles.circle, styles.greenCircle]}>
          <Icon name="checkmark" size={24} color="white" />
        </View>
      );
    } else {
      return (
        <View style={[styles.circle, styles.redCircle]}>
          <Icon name="close" size={24} color="white" />
        </View>
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.statusText, sentimentStatus === "buy" ? styles.greenText : styles.redText]}>
        {sentimentStatus === "buy" ? "Positive! ✅" : "Negative! ❌"}
      </Text>

      {/* Status Icon + Info Button */}
      <View style={styles.infoContainer}>
        {renderStatusIcon()}
        <TouchableOpacity onPress={() => setIsModalVisible(true)}>
          <Icon name="help-circle" size={20} color="white" style={styles.questionMarkIcon} />
        </TouchableOpacity>
      </View>

      {/* Info Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true} onRequestClose={() => setIsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>
            <Text style={styles.modalTitle}>📊 Why Sentiment Matters</Text>
                <Text style={styles.modalText}>
                - <Text style={styles.boldText}>Bullish Sentiment (Buy):</Text> Market confidence, potential upward movement.{"\n"}
                - <Text style={styles.boldText}>Bearish Sentiment (Sell):</Text> Market fear, potential downward pressure.{"\n\n"}
                - Sentiment changes can indicate <Text style={styles.boldText}>trend reversals</Text> or <Text style={styles.boldText}>continuation signals</Text>.
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

// Styles
const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginTop: 20,
  },
  statusText: {
    fontSize: 15,
    marginBottom: 10,
    fontWeight: "bold",
  },
  greenText: {
    color: "#16c784",
  },
  redText: {
    color: "#d92222",
  },
  percentageLabels: {
    flexDirection: "row",
    width: 300,
    justifyContent: "space-between",
    marginTop: 5,
  },
  percentageText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  infoContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  redCircle: {
    backgroundColor: "#d92222",
  },
  greenCircle: {
    backgroundColor: "#16c784",
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

export default NewsSentimentIndicator;
