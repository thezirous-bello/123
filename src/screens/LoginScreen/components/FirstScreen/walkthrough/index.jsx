// import React, { useState, useEffect } from 'react';
// import { ImageBackground } from 'react-native';
// import { View, Text, Image, StyleSheet } from 'react-native';
// import AppIntroSlider from 'react-native-app-intro-slider';

// import AsyncStorage from '@react-native-async-storage/async-storage';

// const slides = [
//   {
//     key: '1',
//     title: 'Welcome to the World\'s Most Advanced Al Trading Platform',
//     text: 'Track, trade, and stay updated with crypto in one place.',
//     image: require('../../../../../imgs/backgroundWalkThorugh.png'),
//     backgroundColor: '#1E1E1E',
//   },
//   {
//     key: '2',
//     title: 'Trade with Confidence',
//     text: 'Buy and sell crypto with real-time market insights.',
//     image: require('../../../../../imgs/bg.png'),
//     backgroundColor: '#141414',
//   },
//   {
//     key: '3',
//     title: 'Track Your Portfolio',
//     text: 'Monitor your assets and set custom alerts.',
//     image: require('../../../../../imgs/bg.png'),
//     backgroundColor: '#222222',
//   },
//   {
//     key: '4',
//     title: 'Stay Updated',
//     text: 'Get the latest crypto news and updates instantly.',
//     image: require('../../../../../imgs/bg.png'),
//     backgroundColor: '#121212',
//   },
// ];

// export default function Walkthrough({ navigation }) {
//   const [showHome, setShowHome] = useState(false);

//   const onDone = async () => {
//     await AsyncStorage.setItem('hasSeenIntro', 'true');
//     navigation.replace('FirstScreen');
//   };
  
//   useEffect(() => {
//     const checkIntro = async () => {
//       const seenIntro = await AsyncStorage.getItem('hasSeenIntro');
//       if (seenIntro) navigation.replace('FirstScreen');
//     };
//     checkIntro();
//   }, []);

//   return showHome ? (
//     <HomeScreen />
//   ) : (
//     <AppIntroSlider
//       data={slides}
//       renderItem={({ item }) => (
//         <ImageBackground resizeMode='cover' source={item.image} style={[styles.slide, { backgroundColor: item.backgroundColor }]}>
//           {/* <Image source={item.image} style={styles.image} /> */}
//           <Text style={styles.title}>{item.title}</Text>
//           {/* <Text style={styles.text}>{item.text}</Text> */}
//         </ImageBackground>
//       )}
//       onDone={onDone}
//       showSkipButton
//       onSkip={onDone}
//     />
//   );
// }

// const styles = StyleSheet.create({
//   slide: {
//     flex: 1,
//     alignItems: 'center',
//     justifyContent: 'center',
//     padding: 20,
//   },
//   image: {
//     width: 250,
//     height: 250,
//     marginBottom: 20,
//     resizeMode: 'contain',
//   },
//   title: {
//     fontSize: 22,
//     // fontWeight: 'bold',
//     color: '#fff',
//     textAlign: 'center',
//   },
//   text: {
//     fontSize: 16,
//     color: '#ccc',
//     textAlign: 'center',
//     marginTop: 10,
//   },
// });
import React, { useState, useEffect } from 'react';
import { ImageBackground } from 'react-native';
import { View, Text, StyleSheet } from 'react-native';
import AppIntroSlider from 'react-native-app-intro-slider';
import AsyncStorage from '@react-native-async-storage/async-storage';

const slides = [
  {
    key: '1',
    title: '**Welcome** to the World\'s Most Advanced **AI** Trading **Platform**',
    text: 'Built for **traders** of all levels, from **beginners** to **pros**. Stay **ahead** of the **market** with cutting-edge tools designed to maximize your **success**.',
    image: require('../../../../../imgs/backgroundWalkThorugh.png'),
    backgroundColor: '#1E1E1E',
    marginTop: 0
  },
  {
    key: '2',
    title: '**AI Signals:** High-accuracy **trades** powered by **AI**.',
    text: 'Track your **Buy** and **sell** crypto transactions with **real-time** market insights.',
    image: require('../../../../../imgs/buySell.png'),
    backgroundColor: '#141414',
    marginTop: 200
  },
  {
    key: '3',
    title: '**News Filter:** Spot **positive** or **negative** news **insantly**.',
    text: '',
    image: require('../../../../../imgs/newsWalkBG.png'),
    backgroundColor: '#222222',
    marginTop: 200
  },
  {
    key: '4',
    title: 'Stay Updated with **Smart Alerts:** Real-time **updates** on key **market moves**.',
    text: 'Get the latest crypto news and updates instantly.',
    image: require('../../../../../imgs/signalsWalkBG.png'),
    backgroundColor: '#121212',
    marginTop: 300
  },
];

export default function Walkthrough({ navigation }) {
  const [showHome, setShowHome] = useState(false);

  const onDone = async () => {
    await AsyncStorage.setItem('hasSeenIntro', 'true');
    navigation.replace('FirstScreen');
  };

  useEffect(() => {
    const checkIntro = async () => {
      const seenIntro = await AsyncStorage.getItem('hasSeenIntro');
      if (seenIntro) navigation.replace('FirstScreen');
    };
    checkIntro();
  }, []);

  // Function to parse and render title with bold parts
  const renderFormattedTitle = (title) => {
    const parts = title.split(/\*\*(.*?)\*\*/g); // Split by **bold** sections

    return parts.map((part, index) => (
      <Text key={index} style={index % 2 === 1 ? styles.bold : styles.normal}>
        {part}
      </Text>
    ));
  };

  // Function to parse and render title with bold parts
  const renderFormattedSubTitle = (title) => {
    const parts = title.split(/\*\*(.*?)\*\*/g); // Split by **bold** sections

    return parts.map((part, index) => (
      <Text key={index} style={index % 2 === 1 ? styles.boldSub : styles.normalSub}>
        {part}
      </Text>
    ));
  };

  return showHome ? (
    <HomeScreen />
  ) : (
    <AppIntroSlider
      data={slides}
      renderItem={({ item }) => (
        <ImageBackground resizeMode="cover" source={item.image} style={[styles.slide, { backgroundColor: item.backgroundColor }]}>
          <Text style={[styles.title, {marginTop: item.marginTop}]}>{renderFormattedTitle(item.title)}</Text>
          <Text style={styles.text}>{renderFormattedSubTitle(item.text)}</Text>
        </ImageBackground>
      )}
      onDone={onDone}
      showSkipButton
      onSkip={onDone}
    />
  );
}

const styles = StyleSheet.create({
  slide: {
    flex: 1,
    alignItems: 'left',
    justifyContent: 'center',
    padding: 32,
  },
  title: {
    fontSize: 27,
    color: '#fff',
    textAlign: 'left',
  },
  normal: {
    fontSize: 27,
    color: '#fff',
  },
  bold: {
    fontSize: 27,
    fontWeight: 'bold',
    color: '#fff',
  },
  text: {
        fontSize: 15,
        color: '#ccc',
        textAlign: 'left',
        marginTop: 10,
      },
  normalSUb: {
    color: '#fff',
  },
  boldSub: {
    fontWeight: 'bold',
    color: '#fff',
  }
});
