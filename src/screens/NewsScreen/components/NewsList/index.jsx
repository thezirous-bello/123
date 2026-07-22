import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Image, FlatList, ActivityIndicator, Dimensions, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TouchableOpacity } from 'react-native-gesture-handler';

const screenWidth = Dimensions.get('screen').width;

const NewsList = ({ data }) => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState([]);


  const renderItem = ({ item }) => (
    <Pressable onPress={() => navigation.navigate('WebViewScreen', { url: item.url })}>
      <View style={styles.newsItem}>
        <Image source={item.image} style={styles.image} />
        <View style={{ width: screenWidth / 1.8 }}>
          <View style={styles.keywordContainer}>
            <View style={styles.keywordSubContainer}>
              <Text style={styles.keyword}>{item.keyword}</Text>
            </View>
            {item.purchaseInfo ? 
            <View style={[styles.keywordSubContainerSentiment, {marginLeft: 10, backgroundColor: item.sentiment == 'positive' ? '#16c784' : item.sentiment == 'negative' ? '#d92222' : 'pink'}]}>
              <Text style={styles.keyword}>{item.sentiment}</Text>
            </View>
            :
              <View style={[styles.keywordSubContainerSentiment, {marginLeft: 10, backgroundColor: '#FF07C9'}]}>
                <Text style={styles.keyword}>Get Premium!</Text>
              </View>            }
          </View>
          <Text style={styles.text}>{item.text}</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <>
      {!data ? (
        <ActivityIndicator size={'large'} style={{ height: 300 }} />
      ) : (
        <FlatList
          style={{ marginBottom: 120 }}
          data={data}
          renderItem={renderItem}
          keyExtractor={(item, index) => index.toString()}
          ListFooterComponent={<View style={{ height: 370 }} />}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  newsItem: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
  },
  image: {
    width: screenWidth / 3,
    height: 100,
    marginRight: 10,
    borderRadius: 15,
  },
  text: {
    fontSize: 16,
    fontFamily: 'Poppins_600SemiBold',
    color: 'white',
  },
  keyword: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    color: 'black',
  },
  keywordSubContainer:{
    backgroundColor: 'white',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 7,
  },
  keywordSubContainerSentiment:{
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 7,
  },
  keywordContainer: {
    display:'flex',
    flexDirection: 'row',
    marginBottom: 5,
    alignSelf: 'flex-start', // Ensure the container wraps the text
  },
});

export default NewsList;
