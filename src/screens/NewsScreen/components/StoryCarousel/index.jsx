// import React from 'react';
// import { View, Text, Image, StyleSheet, Dimensions, TouchableOpacity, ImageBackground } from 'react-native';
// import PagerView from 'react-native-pager-view';
// import { useNavigation } from '@react-navigation/native';

// const screenWidth = Dimensions.get('window').width;
// const screenHeight = Dimensions.get('window').height;

// const StoryItem = ({ story }) => {
//   const navigation = useNavigation();

//   return (
//     <View style={styles.storyContainer}>
//       <TouchableOpacity onPress={() => navigation.navigate('StoryDetail', { story })}>
//         {/* <ImageBackground source={{ uri: story.image }} style={{ flex: 1 }}> */}
//           <Image source={{ uri: story.image }} style={styles.storyImage} />
//           <View style={styles.storyContent}>
//             <Text style={styles.storyTitle}>{story.title.replace('@WatcherGuru', '')}</Text>
//           </View>
//         {/* </ImageBackground> */}
//       </TouchableOpacity>
//     </View>
//   );
// };

// const StoryCarousel = ({ stories }) => {
//   return (
//     <PagerView style={styles.carousel} initialPage={0}>
//       {stories.map((story, index) => (
//         <View key={index} style={styles.page}>
//           <StoryItem story={story} />
//         </View>
//       ))}
//     </PagerView>
//   );
// };

// const styles = StyleSheet.create({
//   carousel: {
//     width: screenWidth,
//     height: screenHeight
//   },
//   page: {
//     flex: 1,
//   },
//   storyContainer: {
//     overflow: 'hidden',
//     backgroundColor: '#fff',
//   },
//   storyImage: {
//     width: '100%',
//     height: '100%',
//     resizeMode: 'cover',
//   },
//   storyContent: {
//     position: 'absolute',
//     // bottom: screenHeight * .4,
//     left: 0,
//     right: 0,
//     backgroundColor: 'rgba(0, 0, 0, 0.4)',
//     padding: 10,
//     height: screenHeight,
//     paddingVertical: screenHeight * .05,
//     paddingTop: screenHeight * 0.4,
//     alignItems: 'center',
//   },
//   storyTitle: {
//     color: '#fff',
//     fontSize: 40,
//     fontWeight: 'bold',
//   },
// });

// export default StoryCarousel;
import React, { useRef } from 'react';
import { View, Text, Image, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import PagerView from 'react-native-pager-view';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;

// const StoryItem = ({ story, textSize, onNext }) => {
//   return (
//     <View style={styles.storyContainer}>
//       <TouchableOpacity onPress={onNext}>
//         <Image source={{ uri: story.image }} style={styles.storyImage} />
//         <View style={styles.storyContent}>
//           <Text style={[styles.storyTitle, { fontSize: textSize}]}>{story.title.replace('@WatcherGuru', '')}</Text>
//         </View>
//       </TouchableOpacity>
//     </View>
//   );
// };
const StoryItem = ({ story, textSize, onNext }) => {
  // Function to parse and render text with bold formatting
  const renderFormattedText = (text) => {
    const parts = text.split(/(\*\*.*?\*\*)/g); // Split by **bold** patterns
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Bold text
        const boldText = part.slice(2, -2);
        return (
          <Text key={index} style={{ fontWeight: 'bold', textDecorationLine: 'underline'}}>
            {boldText}
          </Text>
        );
      }
      // Normal text
      return <Text key={index}>{part}</Text>;
    });
  };

  return (
    <View style={styles.storyContainer}>
      <TouchableOpacity onPress={onNext} activeOpacity={0.9}>
        <Image source={{ uri: story.image }} style={styles.storyImage} />
        <View style={styles.storyContent}>
          <Text style={[styles.storyTitle, { fontSize: textSize }]}>
            {renderFormattedText(story.title.replace('@WatcherGuru', ''))}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const StoryCarousel = ({ stories, textSize }) => {
  const pagerRef = useRef(null);

  const goToNextPage = (index) => {
    if (pagerRef.current && index < stories.length - 1) {
      pagerRef.current.setPage(index + 1);
    }
  };

  return (
    <PagerView style={styles.carousel} initialPage={0} ref={pagerRef}>
      {stories.map((story, index) => (
        <View key={index} style={styles.page}>
          <StoryItem 
            story={story} 
            textSize={textSize}
            onNext={() => goToNextPage(index)} 
          />
        </View>
      ))}
    </PagerView>
  );
};

const styles = StyleSheet.create({
  carousel: {
    width: screenWidth,
    height: screenHeight,
  },
  page: {
    flex: 1,
  },
  storyContainer: {
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  storyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  storyContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    height: screenHeight,
    paddingVertical: screenHeight * 0.05,
    paddingTop: screenHeight * 0.4,
    alignItems: 'center',
  },
  storyTitle: {
    color: '#fff',
    fontWeight: 500,
  },
});

export default StoryCarousel;
