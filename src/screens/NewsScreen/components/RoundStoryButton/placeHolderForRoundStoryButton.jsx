import React, { useState } from 'react';
import { View, TouchableOpacity, Image, StyleSheet, Modal, Dimensions, SafeAreaView, Text,  ImageBackground, ActivityIndicator} from 'react-native';
import StoryCarousel from '../StoryCarousel';
import AntDesign from '@expo/vector-icons/AntDesign';


const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const PlaceHolderForRoundStoryButton = ({ storyText }) => {
  const [modalVisible, setModalVisible] = useState(false);

  const handlePress = () => {
    setModalVisible(true);
  };

  const handleClose = () => {
    console.log("Close")
    setModalVisible(false);
  };
  

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button}>
        <ActivityIndicator size="large" color="#0000ff" />
      </TouchableOpacity>
      <Text style={{fontSize: 10,
    fontFamily: 'Poppins_400Regular',
    color: 'white', textAlign: 'center', marginTop: 2}}>{storyText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // position: 'absolute',
    // bottom: 20,
    // right: 20,
  },
  button: {
    width: 80,
    height: 80,
    borderRadius: 50,
    backgroundColor: 'rgba(254,253,240,1)',
    borderWidth: 4,
    borderTopColor: '#FF07C9',
    borderLeftColor: '#fd8fe5',
    borderRightColor: '#b90792',
    borderBottomColor: '#e005bb',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    zIndex: 10,

  },
  buttonImage: {
    minWidth: 60,
    minHeight: 60,
    resizeMode: 'contain',

  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(254,253,240,1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    // color: 'white',
    position: 'absolute',
    top: 80,
    right: 20,
    zIndex: 1,
  },
  closeIcon: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
});

export default PlaceHolderForRoundStoryButton;
