import React, { useState } from 'react';
import { View, TouchableOpacity, Image, StyleSheet, Modal, Dimensions, SafeAreaView, Text,  ImageBackground} from 'react-native';
import StoryCarousel from '../StoryCarousel';
import AntDesign from '@expo/vector-icons/AntDesign';


const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

const RoundButtonWithModal = ({ stories, textSize, image, storyText }) => {
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
      <TouchableOpacity style={styles.button} onPress={handlePress}>
        <ImageBackground source={{ uri: image}} style={styles.buttonImage} imageStyle={{ borderRadius: 50 }}>
        </ImageBackground>
      </TouchableOpacity>
      <Text style={{fontSize: 10,
    fontFamily: 'Poppins_400Regular',
    color: 'white', textAlign: 'center', marginTop: 2}}>{storyText}</Text>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleClose}
      >
        <SafeAreaView style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <AntDesign name="close" size={30} color="black" style={{textShadowColor: 'white', textShadowOffset: {width: 0, height: 0}, textShadowRadius: 4, stroke: 'white', strokeWidth: 4}} />
          </TouchableOpacity>
          <StoryCarousel stories={stories} textSize={textSize}/>
        </SafeAreaView>
      </Modal>
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
    borderTopColor: '#00000080',
    borderLeftColor: '#00000090',
    borderRightColor: '#00000070',
    borderBottomColor: '#00000060',
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

export default RoundButtonWithModal;
