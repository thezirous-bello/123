import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from "@react-navigation/native";

const GetPremiumInner = ({ onBuyPremium }) => {
  const navigation = useNavigation();

  return (
    <View>
      <View style={styles.glossyBackground}>
        <Text style={styles.heading}>Go Premium!</Text>
        <Text style={styles.description}>
          Unlock all features and finally start trading like a pro!
        </Text>

        <TouchableOpacity onPress={() => navigation.navigate('Subscriptions')} style={styles.button}>
          <Text style={styles.buttonText}>Buy Premium Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
      glossyBackground: {
        width: '100%',
        padding: 20,
        borderRadius: 15,
        alignItems: 'center',
        //backgroundColor: 'rgba(255, 255, 255, 0.2)',
        overflow: 'hidden',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10, // For Android shadow
      },
      // Simulated glossy effect using a transparent white gradient
      heading: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
        textAlign: 'center',
      },
      description: {
        fontSize: 16,
        color: '#fff',
        textAlign: 'center',
        marginBottom: 20,
      },
      button: {
        backgroundColor: '#FF07C9',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
        elevation: 5, // For Android shadow
      },
      buttonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
      }
});

export default GetPremiumInner;
