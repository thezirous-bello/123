import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';  // Assuming you're using Ionicons

const OpenInterestIndicator = ({ openInterestData }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Logic to check if the Stochastic RSI is overbought or if K < D
  const checkOpenInterestStatus = () => {
    if (openInterestData) {
      const { dynamic_threshold, open_interest } = openInterestData;
      if (open_interest > dynamic_threshold) {
        return 'sell'; // Red circle with X
      } else {
        return 'buy'; // Green circle with check
      }
    }
    return null;
  };

  const renderStatusIcon = () => {
    const status = checkOpenInterestStatus();
    if (status === 'sell') {
      return (
        <View style={[styles.circle, styles.redCircle]}>
          <Icon name="close" size={24} color="white" />
        </View>
      );
    } else if (status === 'buy') {
      return (
        <View style={[styles.circle, styles.greenCircle]}>
          <Icon name="checkmark" size={24} color="white" />
        </View>
      );
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {renderStatusIcon()}
      
      {/* Question Mark Icon */}
      <TouchableOpacity onPress={() => setIsModalVisible(true)}>
        <Icon name="help-circle" size={20} color="white" style={styles.questionMarkIcon} />
      </TouchableOpacity>

      {/* Modal for showing explanation */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalText}>
            ⚠️ Why This Matters{'\n'}{'\n'}
            🚨 Liquidation Risk{'\n'}{'\n'}

            High open interest means many traders are holding positions with leverage.
            If the price moves sharply against the majority, mass liquidations can trigger forced selling or buying, leading to a cascade effect.
            {'\n'}{'\n'}📊 Market Sentiment & Positioning
            {'\n'}{'\n'}
            Increasing OI + Rising Prices → Bullish confirmation (new money entering long trades).
            Increasing OI + Falling Prices → Bearish confirmation (short traders adding positions).
            Decreasing OI → Traders closing positions, signaling possible trend exhaustion.
            {'\n'}{'\n'}🔄 Market Reversals & Traps
            {'\n'}{'\n'}
            High OI before major news/events can signal an incoming volatility spike.
            Market makers may trigger stop hunts by forcing price movements that liquidate overleveraged traders.
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redCircle: {
    backgroundColor: '#d92222',
  },
  greenCircle: {
    backgroundColor: '#16c784',
  },
  questionMarkIcon: {
    marginLeft: 10,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    maxWidth: 300,
    alignItems: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
  },
  closeText: {
    color: 'blue',
    fontWeight: 'bold',
  },
});

export default OpenInterestIndicator;
