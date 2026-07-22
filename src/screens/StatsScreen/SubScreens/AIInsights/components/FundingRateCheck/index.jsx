import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';  // Assuming you're using Ionicons

const FundingRateIndicator = ({ fundingRateData }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Logic to check if the Stochastic RSI is overbought or if K < D
  const checkFundingRateStatus = () => {
    if (fundingRateData) {
      const { avg_funding_rate, funding_rates } = fundingRateData;
      if (avg_funding_rate > 0.1 || avg_funding_rate < -0.1) {
        return 'sell'; // Red circle with X
      } else {
        return 'buy'; // Green circle with check
      }
    }
    return null;
  };

  const renderStatusIcon = () => {
    const status = checkFundingRateStatus();
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
            ⚠️ Why This Matters {'\n'}{'\n'}
            🚨 Liquidation Risk{'\n'}{'\n'}

            If funding rates are extremely high, traders are forced to pay excessive fees, which can lead to forced liquidations of overleveraged positions.
            {'\n'}{'\n'}📊 Market Overheating & Reversals{'\n'}{'\n'}

            High positive funding rate → Many traders are long → Market may be overleveraged → Possible price correction.
            High negative funding rate → Many traders are short → Potential short squeeze if the price moves up.
            {'\n'}{'\n'}🔄 Mean Reversion & Trading Strategy{'\n'}{'\n'}

            Many professional traders monitor extreme funding rates to trade against the crowd (mean reversion strategies).
            Example: If funding is too high, they might short expecting a pullback.{'\n'}
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
    marginTop: 25
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

export default FundingRateIndicator;
