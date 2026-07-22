import React, { useRef, useState } from 'react';
import { StyleSheet, View, Pressable, ImageBackground, Text, ActivityIndicator } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useNavigation } from '@react-navigation/native';

const MyPager = ({ data }) => {
  const navigation = useNavigation();
  const pagerRef = useRef(null);
  const [activePage, setActivePage] = useState(0);

  const setThePage = (num) => {
    if (pagerRef.current) {
      pagerRef.current.setPage(num);
    }
  }

  return (
    <View>
      {!data ? 
      <ActivityIndicator size={'large'} style={styles.pagerView}/>
      :
      <>
      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={e => setActivePage(e.nativeEvent.position)}
      >
        {data.map((item, index) => (
          <Pressable onPress={() => navigation.navigate('WebViewScreen', { url: item.url })} key={index} style={styles.page} >
            <ImageBackground source={item.image} style={styles.image}>
              {item.text && <Text style={styles.text}>{item.text}</Text>}
            </ImageBackground>
          </Pressable>
        ))}
      </PagerView>
      <View style={styles.dotsContainer}>
        {data.map((_, index) => (
          <Pressable
            key={index}
            onPress={() => setThePage(index)}
            style={[styles.dot, activePage === index && styles.activeDot]}
          ></Pressable>
        ))}
      </View>
      </>}
    </View>
  );
};

const styles = StyleSheet.create({
  pagerView: {
    marginHorizontal: 10,
    marginTop: 20,
    marginBottom: 10,
    height: 150,
  },
  page: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: 'bold',
  },
  dotsContainer: {
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 10,
  },
  dot: {
    backgroundColor: 'grey',
    height: 7,
    width: 7,
    borderRadius: 50,
    margin: 3,
  },
  activeDot: {
    backgroundColor: 'black',
    width:10
  },
});

export default MyPager;
