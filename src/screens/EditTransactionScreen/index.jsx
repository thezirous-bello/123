import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { editTransaction } from '../../services/requests';
import { useNavigation } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import auth from '@react-native-firebase/auth';
//import DateTimePicker from '@react-native-community/datetimepicker';
//import DatePicker from 'react-native-date-picker';
import moment from 'moment';
import { Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback, Platform } from 'react-native';

const EditTransactionPage = () => {
    const {
        params: { transaction },
      } = useRoute();
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 
  const navigation = useNavigation();
  const [priceBought, setPriceBought] = useState(null);
  const [quantityBought, setQuantityBought] = useState(null);
  const [timestamp, setTimestamp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('date');
  const [show, setShow] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);


  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });
  
    // Cleanup listeners on component unmount
    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);  

  useEffect(() => {
    setLoading(true);
    setPriceBought(transaction.priceBought);
    setQuantityBought(transaction.quantityBought);
    setTimestamp(transaction.timestamp)
    setLoading(false);
  }, [transaction]);

  const handleSave = async () => {
    console.log(timestamp)
    const timeValue = convertLocaleStringToISO(timestamp);
    console.log("Time Value : " + timeValue)
    if (validateTimestamp(timeValue)) {
      console.log('Date converted');
      let adjustedQuantity = parseFloat(quantityBought);
      if (transaction.transaction_type === 'sell') {
        adjustedQuantity = -Math.abs(adjustedQuantity);
      }
      const updatedData = {
          priceBought: parseFloat(priceBought),
          quantityBought: adjustedQuantity,
          timestamp: timeValue,
      };

      try {
        const response = await editTransaction(transaction._id, id, updatedData);
        if (response.status === 200) {
          Alert.alert('Success', 'Transaction updated successfully');
          console.log('Transaction updated successfully');
          navigation.navigate('Portfolio');
        } else {
          Alert.alert('Error', 'Failed to update transaction');
          console.log('Failed to update transaction');
          navigation.navigate('Portfolio');
        }
      } catch (error) {
        Alert.alert('Error', 'An error occurred while updating the transaction');
        console.log(error);
        navigation.navigate('Portfolio');
      }
    } else {
      Alert.alert('Error', 'Failed to update transaction');
      console.log('Invalid date');
    }
    
    
  };

  const onChange = (event, selectedDate) => {
    const currentDate = selectedDate;
    setShow(false);
    setTimestamp(currentDate);
  };

  const showMode = (currentMode) => {
    setShow(true);
    setMode(currentMode);
  };

  const showDatepicker = () => {
    showMode('date');
  };

  const showTimepicker = () => {
    showMode('time');
  };

  const convertLocaleStringToISO = (localeString) => {
    const date = new Date(localeString);
    return moment(date).format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
  };

  const validateTimestamp = (timestamp) => {
    const format = 'YYYY-MM-DDTHH:mm:ss.SSS[Z]';
    return moment(timestamp, format, true).isValid();
  };

  const handleLeave = () => {
    return navigation.navigate('Home');
  }

  if (!transaction || loading) { 
    return <ActivityIndicator size="large" />
  }
  const percentageColor =
  transaction.transaction_type == 'sell' ? "#FF07C9" : "#16c784" || "white";

  const dismissKeyboard = () => {
    Keyboard.dismiss(); // Close the keyboard when the Done button is pressed
  };
  
  return (
    
    <ScrollView contentContainerStyle={styles.container}>
    <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  >
    {/* Dismiss keyboard when tapping outside */}
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
    <View style={{ flex: 1 }}>

        {/* Your SearchableDropDown and other components */}
        
        {keyboardVisible && (
          <Pressable onPress={Keyboard.dismiss} style={styles.doneButton}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        )}
      <Text style={{color: '#fff', fontFamily: "Poppins_400Regular", fontSize: 24, alignSelf: 'center', paddingBottom: 12}}>Update Transaction</Text>
      <View style={{ justifyContent:'center',marginHorizontal: '35%',display: 'flex', flexDirection: 'row', marginBottom: 50, borderWidth: 1, borderColor: percentageColor, borderRadius: 25, paddingHorizontal: 10, paddingVertical: 5}}>
        <View style={{backgroundColor: percentageColor, width: 6, height: 6, borderRadius: 25, alignSelf: 'center', marginRight: 10}}></View>
        <Text style={{color: percentageColor, fontFamily: "Poppins_400Regular", fontSize: 22, alignSelf: 'center', textTransform: 'uppercase'}}>{transaction.transaction_type}</Text>
      </View>
      <Text style={styles.label}>Price (USD)</Text>
      <TextInput
        style={styles.input}
        value={priceBought.toString()}
        onChangeText={setPriceBought}
        keyboardType="numeric"
      />
      <Text style={styles.label}>Quantity</Text>
      <TextInput
        style={styles.input}
        value={Math.abs(quantityBought).toString()}
        onChangeText={setQuantityBought}
        keyboardType="numeric"
      />
      <Text style={styles.label}>Timestamp</Text>
      <View>
      
      <TextInput
        style={styles.input}
        value={(timestamp)}
        onChangeText={setTimestamp}
        keyboardType="default"
      />
      </View>
        <Pressable style={{backgroundColor: '#16c784', borderRadius: 25, padding: 10, color: 'white'}} onPress={handleSave}><Text style={{color: 'white', alignSelf: 'center', fontSize: 17, fontFamily: 'Poppins_600SemiBold'}}>Save</Text></Pressable>
        <Pressable style={{backgroundColor: '#FF07C9', borderRadius: 25, padding: 10, color: 'white', marginTop: 15}} onPress={handleLeave} ><Text style={{color: 'white', alignSelf: 'center', fontSize: 17, fontFamily:'Poppins_600SemiBold'}}>Cancel</Text></Pressable>
      
      </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#1e1e1e",
    flexGrow: 1,
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: 'white',
    fontFamily: "Poppins_400Regular",
  },
  input: {
    height: 40,
    color: '#fff',
    borderWidth: 1,
    marginBottom: 16,
    borderColor: 'gray',
    borderRadius: 12,
    paddingHorizontal: 8,
    fontFamily: "Poppins_400Regular",
  },
  doneButton: {
    padding: 10,
    backgroundColor: '#4169e1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
  },
});

export default EditTransactionPage;
