import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';  // Assuming you're using Ionicons

const StochRSIIndicator = ({ stochRSIData }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Logic to check if the Stochastic RSI is overbought or if K < D
  const checkStochRSIStatus = () => {
    if (stochRSIData) {
      const { stoch_rsi_k, stoch_rsi_d } = stochRSIData;
      if (stoch_rsi_k > 80 || stoch_rsi_k < stoch_rsi_d) {
        return 'sell'; // Red circle with X
      } else {
        return 'buy'; // Green circle with check
      }
    }
    return null;
  };

  const renderStatusIcon = () => {
    const status = checkStochRSIStatus();
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
            <Text style={styles.modalText}>Stochastic RSI over 80 indicates an overbought condition. When the K line is below the D line, it is a bearish signal.</Text>
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

export default StochRSIIndicator;
