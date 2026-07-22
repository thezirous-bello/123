import React, { useEffect, useState } from "react";
import { View, Text, ImageBackground, Pressable, TextInput, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, ScrollView } from "react-native";
import bg from "../../../../imgs/bgimg.png";
import SearchableDropDown from "react-native-searchable-dropdown";
import NewsNavigation from "../../components/NewsNav/newsNav";
import { getNews, getRecentNews, getNewsByKeyword, getAllCoinsMongoDB, getRecentNewsMongoDB, searchNewsByKeywords } from "../../../../services/requests";
import img1 from '../../../../imgs/breakingnews.jpg';
import img2 from '../../../../imgs/bg2.png';
import { AntDesign, FontAwesome } from "@expo/vector-icons";
const screenWidth = Dimensions.get("window").width;
import auth from '@react-native-firebase/auth';
import MyPager from "../../components/Carousel";
import NewsList from "../../components/NewsList";
import Purchases from "react-native-purchases";
import GetPremiumButton from "../../../../components/GetPremiumButton";
import { Platform } from "react-native";
import LoadingFullScreen from "../../../../components/LoadingFullScreen";
var padding = 30;
var paddingBG = 40;
if (Platform.OS === 'ios') {
  padding = 30;
  paddingBG = 40;
} else if (Platform.OS === 'android') {
  padding = 15;
  paddingBG = 20;
}
const AllNews = () => {

  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 
  const [search, onChangeSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState();
  const [selectedItemForQuery, setSelectedItemForQuery] = useState('All');
  const [news, setNews] = useState([]);
  const [recentNews, setRecentNews] = useState([]);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allCoins, setAllCoins] = useState([]);
  const [categoryCryptoSelection, setCategoryCryptoSelection] = useState('All');

  const data = [
    { image: img1, text: 'Breaking News' },
    { image: img2, text: 'Background 2' },
    { image: img1, text: 'Breaking News' },
    { image: img2, text: 'Background 2' },
  ];

  const items = [
    { id: 1, name: 'Bitcoin', ticker: 'BTC' },
    { id: 2, name: 'Ethereum', ticker: 'ETH' },
    { id: 3, name: 'Ripple', ticker: 'XRP' },
  ];

  const fetchAllCoins = async () => {
    const allCoins = await getAllCoinsMongoDB(isLoggedIn);
    const coinsWithId = allCoins.map(coin => ({
      id: coin._id, // Rename _id to id
      ticker: coin.symbol,
      name: coin.name,
      market_cap: coin.market_cap,
      // Add other fields as necessary
    }));
    const sortedCoins = coinsWithId ? 
    coinsWithId.sort((a, b) => b.market_cap - a.market_cap) :
          [];
    setAllCoins(sortedCoins);
  };

  useEffect(() => {

    fetchAllCoins();
    if(categoryCryptoSelection == 'All'){
        const fetchNews = async () => {
        try {
            const info = await getRecentNewsMongoDB(isLoggedIn, 24,1000);
            if (info) {
            setNews(info);
            }
        } catch (error) {
            console.error("Error fetching news:", error);
        } finally {
            setLoading(false);
        }
        };
        const fetchRecentNews = async () => {
        try {
            setLoading(true);
            const info = await getRecentNewsMongoDB(isLoggedIn, 24,10);
            if (info.length > 0) {
              // console.log(info.length)
              setRecentNews(info);
            }
        } catch (error) {
            console.error("Error fetching news:", error);
        } finally {
            setLoading(false);
        }
        };

        fetchRecentNews();
        fetchNews();
    }else{
        const fetchNews = async () => {
            try {
                setLoading(true)
                // const info = await getNewsByKeyword(categoryCryptoSelection[0],categoryCryptoSelection[1]);
                const info = await searchNewsByKeywords(isLoggedIn, [categoryCryptoSelection[0],categoryCryptoSelection[1]]);

                if (info) {
                setNews(info);
                setRecentNews(info.slice(0, 7));
                }
            } catch (error) {
                console.error("Error fetching news:", error);
            } finally {
                setLoading(false);
            }
            };
            fetchNews();
    }
  }, [isLoggedIn, categoryCryptoSelection]);

  useEffect(() => {

    if(selectedItemForQuery != 'All'){
        const fetchNews = async () => {
            try {
                setLoading(true)
                const info = await searchNewsByKeywords(isLoggedIn, selectedItemForQuery);
                if (info) {
                setNews(info);
                setRecentNews(info.slice(0, 7));
                }
            } catch (error) {
                console.error("Error fetching news:", error);
            } finally {
                setLoading(false);
            }
            };
            fetchNews();
    }
  }, [selectedItemForQuery]);

  const toggleMenu = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const handleSelectedItem = (payload) => {
    setSelectedItem(payload.name);
    setSelectedItemForQuery([payload.ticker, payload.name]);
    console.log('Selected option:', payload);
    setIsMenuVisible(false);
  }
  const handleMenuSelect = (payload) => {
    setCategoryCryptoSelection(payload);
    console.log('Selected option:', payload);
    setIsMenuVisible(false);
  };

  const [purchaseInfo, setPurchaseInfo] = useState([]);

  useEffect(() => {
    const getPurchaserInfo = async () => {
      setLoading(true)
      try {
        const purchaserInfo = await Purchases.getCustomerInfo();
        setPurchaseInfo(purchaserInfo.activeSubscriptions[0]);
      } catch (e) {
        console.error("Error fetching purchaser info:", e);
      }
    };
    getPurchaserInfo();
    setLoading(false);
  },[])

  return (
    loading  || !news.length > 0?
    <LoadingFullScreen spinnerSource={require('../../../../imgs/ngjyra.png')} backgroundSource={require('../../../../imgs/back that.png')}/>
    :
    <View style={{ flex: 1, paddingTop: paddingBG }}>
      <View style={{ paddingHorizontal: padding }}>
        <Text style={styles.headerText}>News.</Text>
        <Text style={styles.subHeaderText}>News, Financials, Sentiment, and AI Analysis!</Text>
      </View>
      <NewsNavigation active={4} />
      <View style={styles.InputContainer}>
        <Pressable style={styles.barsButton} onPress={toggleMenu}>
          <FontAwesome name="bars" size={24} color="rgba(25,25,25,0.9)" />
        </Pressable>
        <SearchableDropDown
          onTextChange={onChangeSearch}
          onItemSelect={(item) => handleSelectedItem(item)}
          containerStyle={styles.dropdownContainer}
          textInputStyle={styles.input}
          itemStyle={styles.dropdownItem}
          itemTextStyle={styles.dropdownItemText}
          itemsContainerStyle={styles.itemsContainer}
          items={allCoins}
          defaultIndex={0}
          placeholder="Select an item"
          resetValue={false}
          underlineColorAndroid="transparent"
        />
        <Pressable style={styles.searchButton}>
          <AntDesign name="search1" size={24} color="rgba(25,25,25,0.9)" />
        </Pressable>
      </View>
      {isMenuVisible && (
        <ScrollView style={styles.menu}>
          <TouchableOpacity onPress={() => handleMenuSelect(['All', 'All'])} style={styles.menuItem}>
            <Text>All News</Text>
          </TouchableOpacity>
          {
            allCoins.map(item => (
                <TouchableOpacity onPress={() => handleMenuSelect([item.ticker, item.name])} style={styles.menuItem}>
                    <Text>{item.name}</Text>
                </TouchableOpacity>
            ))
          }
        </ScrollView>
      )}
      <View>
        {loading ? (
          <LoadingFullScreen spinnerSource={require('../../../../imgs/ngjyra.png')} backgroundSource={require('../../../../imgs/back that.png')}/>
          ) : news.length > 0 ? (
          <>
            <MyPager data={recentNews.map(item => ({
              image: item.image_url ? { uri: item.image_url } : img1,
              text: item.title.length > 100 ? item.title.substring(0, 100) + '...' : item.title,
              keyword: item.source,
              url: item.link
            }))} />
            {purchaseInfo ? <></> : <GetPremiumButton/>}
            <NewsList data={news.map(item => ({
              image: item.image_url ? { uri: item.image_url } : img1,
              text: item.title,
              keyword: item.source,
              url: item.link,
              sentiment: item.sentiment,
              purchaseInfo: purchaseInfo
            }))} />
          </>
        ) : (
          <LoadingFullScreen spinnerSource={require('../../../../imgs/ngjyra.png')} backgroundSource={require('../../../../imgs/back that.png')}/>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  InputContainer: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    borderRadius: 25,
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 10, // Ensure this is above other views
  },
  input: {
    margin: 0,
    height: 40,
    width: screenWidth / 1.3,
    backgroundColor: 'white',
    fontFamily: 'Poppins_600SemiBold',
    padding: 10,
  },
  barsButton: {
    paddingLeft: 20,
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderBottomLeftRadius: 25,
    margin: 0,
    paddingHorizontal: 10,
    height: 40,
    justifyContent: 'center',
  },
  searchButton: {
    paddingRight: 15,
    paddingLeft: 5,
    backgroundColor: 'white',
    borderTopRightRadius: 25,
    borderBottomRightRadius: 25,
    margin: 0,
    height: 40,
    justifyContent: 'center',
  },
  dropdownContainer: {
    flex: 1,

    position: 'relative',
  },
  dropdownItem: {
    padding: 10,
    marginTop: 2,
    backgroundColor: '#FAF9F8',
    //borderColor: '#bbb',
    //borderWidth: 1,
    //borderRadius: 5,
  },
  dropdownItemText: {
    color: '#222',
  },
  itemsContainer: {
    maxHeight: screenWidth/3,
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: '#FFF',
    //borderColor: '#bbb',
    //borderWidth: 1,
    borderBottomRightRadius: 5,
    borderBottomLeftRadius: 5,
    //elevation: 5,
  },
  menu: {
    position: 'absolute',
    top: 200,
    left: 20,
    right: 20,
    height: screenWidth/1.5,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
    zIndex: 1000,
  },
  menuItem: {
    padding: 15,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
  },
  headerText: {
    color: "white",
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    paddingTop: 30,
  },
  subHeaderText: {
    color: "white",
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
  },
});

export default AllNews;
