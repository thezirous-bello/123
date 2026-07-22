import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Image
} from "react-native";
import SearchableDropDown from "react-native-searchable-dropdown";
import { AntDesign, FontAwesome } from "@expo/vector-icons";
import { searchNewsByKeywords, getAllCoinsMongoDB, getRecentNews, getMongoDBData, getMarketData } from "../../services/requests";
import LoadingFullScreen from "../../components/LoadingFullScreen";
import SearchNavigation from "./Component/SearchNav/searchNav";
import auth from '@react-native-firebase/auth';
import Purchases from "react-native-purchases";
import { useCoins } from "../../services/CoinsContext";
import { useNavigation } from '@react-navigation/native';


const screenWidth = Dimensions.get("window").width;

const SearchScreen = () => {
    const id = auth().currentUser.uid;
    const isLoggedIn = auth().currentUser.uid ? true : false;
    const [search, onChangeSearch] = useState("");
    const [selectedItem, setSelectedItem] = useState();
    const [searchResults, setSearchResults] = useState({ coins: [], news: [] });
    const [loading, setLoading] = useState(false);
    const [isMenuVisible, setIsMenuVisible] = useState(false);
    const [purchaseInfo, setPurchaseInfo] = useState([]);
    const [topCoinsToTrade, setTopCoinsToTrade] = useState([]);
    const { coinsList } = useCoins(); // Access coins from the context
    const [allCoins, setAllCoins] = useState(coinsList || []); // Initialize state with passed data
    const navigation = useNavigation();
    

  const fetchAllCoins = async () => {
    const allCoins = await getAllCoinsMongoDB(isLoggedIn);
    const coinsWithId = allCoins.map((coin) => ({
      id: coin._id,
      ticker: coin.symbol,
      name: coin.name,
    }));
    setAllCoins(coinsWithId);
  };

  useEffect(() => {
    const getPurchaserInfo = async () => {
      try {
        const purchaserInfo = await Purchases.getCustomerInfo();
        setPurchaseInfo(purchaserInfo.activeSubscriptions[0]);
      } catch (e) {
        console.error("Error fetching purchaser info:", e);
      }
    };
  
    const getTopCoinsToTrade = async () => {
      try {
        const info = await getMongoDBData('TopCoinsToTrade', {}, { _id: -1 }, 10);
        if (info) {
          const uniqueCoins = {};
          info.forEach((coin) => {
            if (!uniqueCoins[coin.symbol]) {
              uniqueCoins[coin.symbol] = coin;
            }
          });
          setTopCoinsToTrade(Object.values(uniqueCoins));
        }
      } catch (error) {
        console.error("Error fetching top coins to trade:", error);
      }
    };
  
    const fetchRecentNewsAndCorrelate = async () => {
      try {
        const recentNews = await getRecentNews();
        await getTopCoinsToTrade();

        if (!coinsList || coinsList.length === 0) {
            // Fallback: Fetch coins if not passed
            const fetchCoins = async () => {
              const fetchedCoins = await getMarketData(0); // Example API call
              setAllCoins(fetchedCoins);
            };
            await fetchCoins();
        }
        // Map coinsList to extract required fields
        const coinsWithId = coinsList.map((coin) => ({
            id: coin.id,
            image: coin.image || require('../../imgs/logo.png'), // Default to logo if image is null
            name: coin.name,
            ticker: coin.symbol,
            marketCap: coin.market_cap,
            priceChangePercentage24h: coin.price_change_percentage_24h,
        }));
        const sortedCoins = coinsWithId.sort((a, b) => b.marketCap - a.marketCap);

        setAllCoins(sortedCoins);
  
        await getPurchaserInfo();
  
        let correlatedCoins = [];
        if (topCoinsToTrade.length > 0) {
            correlatedCoins = sortedCoins.filter((coin) =>
                topCoinsToTrade.some((topCoin) => {
                  const trimmedSymbol = topCoin.symbol.replace(/usdt$/i, ""); // Remove 'usdt' from the end of the string
                  return trimmedSymbol.toLowerCase() === coin.ticker.toLowerCase();
                })
              );
        }

        // Ensure at least 6 coins are returned
        if (correlatedCoins.length < 6) {
          const missingCount = 6 - correlatedCoins.length;
          const topMarketCapCoins = sortedCoins
            .filter((coin) => !correlatedCoins.some((c) => c.ticker === coin.ticker))
            .sort((a, b) => b.marketCap - a.marketCap) // Sort by market cap descending
            .slice(0, missingCount);
  
          correlatedCoins = [...correlatedCoins, ...topMarketCapCoins];
        }
  
        const combinedResults = {
          coins: correlatedCoins,
          news: recentNews,
        };
  
        setSearchResults(combinedResults);
      } catch (error) {
        console.error("Error fetching recent news and correlating:", error);
      }
    };
  
    fetchRecentNewsAndCorrelate();
  }, []);

  const handleSearch = async (item = false) => {
    try {
      setLoading(true);
      const keyword = selectedItem ? selectedItem.name : item ? item.name: search;

      // Filter coins based on the search keyword
      const filteredCoins = allCoins.filter((coin) =>
        coin.name.toLowerCase().includes(keyword.toLowerCase()) ||
        coin.ticker.toLowerCase().includes(keyword.toLowerCase())
      );
  
      // Fetch news based on the search keyword
      const newsResults = await searchNewsByKeywords(isLoggedIn,[keyword]);
  
      // Combine results
      const combinedResults = {
        coins: filteredCoins,
        news: newsResults,
      };
  
      setSearchResults(combinedResults);
    } catch (error) {
      console.error("Error fetching search results:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleMenu = () => {
    setIsMenuVisible(!isMenuVisible);
  };

  const handleSelectedItem = (item) => {
    setSelectedItem(item);
    setIsMenuVisible(false);
    handleSearch(item); // Trigger search when an option is selected
  };

  const handleKeyPress = (event) => {
    if (event.nativeEvent.key === "Enter") {
      handleSearch(); // Trigger search when Enter is pressed
    }
  };

  if (searchResults.coins.length === 0 || searchResults.news.length === 0) {
    return (
      <LoadingFullScreen 
        spinnerSource={require('../../imgs/ngjyra.png')}
        backgroundSource={require('../../imgs/back that.png')}
      />
    );
  }

  return (
    loading ? (
        <LoadingFullScreen 
        spinnerSource={require('../../imgs/ngjyra.png')}
        backgroundSource={require('../../imgs/back that.png')}
      />
    ) : (
      <ScrollView style={{ flex: 1, paddingTop: 60 }}>
        <View style={styles.InputContainer}>
          {/* <Pressable style={styles.barsButton} onPress={toggleMenu}>
            <FontAwesome name="bars" size={24} color="rgba(25,25,25,0.9)" />
          </Pressable> */}
          <Pressable style={styles.searchButton} onPress={handleSearch}>
            <AntDesign name="search1" size={27} color="rgba(147, 147, 147, 0.9)" />
          </Pressable>
          <SearchableDropDown
            onTextChange={(text) => {
                onChangeSearch(text);
            }}
            onItemSelect={(item) => handleSelectedItem(item)}
            containerStyle={styles.dropdownContainer}
            textInputStyle={styles.input}
            itemStyle={styles.dropdownItem}
            itemTextStyle={styles.dropdownItemText}
            itemsContainerStyle={styles.itemsContainer}
            items={allCoins}
            defaultIndex={0}
            placeholder="Select an item"
            placeholderTextColor="rgba(147, 147, 147, 0.9)"
            resetValue={false}
            underlineColorAndroid="transparent"
            onKeyPress={handleKeyPress} // Add key press listener
            />
        </View>
        {/* <View style={{ marginTop: 10, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 10 }}>
            <SearchNavigation active={1} />
        </View> */}
        <View style={{ paddingHorizontal: 20, marginTop: 15 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>   
                <Text style={{ fontSize: 18, fontWeight: "bold", color: "rgba(255,255,255,0.9)" }}>Trending Coins</Text>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "rgba(147, 147, 147, 0.9)" }}>24h Change</Text>
            </View>
            <View>

                {searchResults?.coins.length > 0 ? (
                    searchResults?.coins.map((coin, index) => (
                    <Pressable
                          onPress={() =>
                            navigation.navigate("CoinDetailScreen", {
                              coinID: coin.id,
                              symbolz: coin.ticker,
                              market_cap: coin.marketCap,
                            })
                          }
                        >
                        <View key={index} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: 10, borderRadius: 10 }}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <Image source={{
                                    uri: coin.image,
                                    }} style={{ width: 30, height: 30, borderRadius: 10 }} />
                            <Text style={{ fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginLeft: 10 }}>{coin.name}</Text>
                            </View>
                            <Text style={{ fontSize: 16, fontWeight: '600', color: coin.priceChangePercentage24h > 0 ? 'rgba(29, 224, 58, 0.9)' : 'rgba(224, 45, 29, 0.9)' }}>
                            {coin.priceChangePercentage24h ? `${coin.priceChangePercentage24h.toFixed(2)}%` : 'N/A'}
                            </Text>
                        </View>
                    </Pressable>
                    ))
                ) : (
                    <Text style={{ textAlign: "center", marginTop: 20 }}>No trending coins found.</Text>
                )}
            </View>
        </View>
        <View style={{ paddingHorizontal: 20, marginTop: 20, marginBottom: 100 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>   
                <Text style={{ fontSize: 18, fontWeight: "bold", color: "rgba(255,255,255,0.9)" }}>Trending News</Text>
            </View>



            {isMenuVisible && (
            <ScrollView style={styles.menu}>
                {allCoins.map((item) => (
                <TouchableOpacity key={item.id} onPress={() => handleSelectedItem(item)} style={styles.menuItem}>
                    <Text style={styles.menuItemText}>{item.name}</Text>
                </TouchableOpacity>
                ))}
            </ScrollView>
            )}
        
        
            <View style={{ marginTop: 20, marginBottom: 100 }}>
                {searchResults && searchResults.news.length > 0 ? (
                    searchResults?.news.map((item, index) => (
                    <Pressable onPress={() => navigation.navigate('WebViewScreen', { url: item.url })} > 
                        <View key={index} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10, padding: 10, borderRadius: 10 }}>
                            <Image source={item.image_url ? { uri: item.image_url } : require('../../imgs/breakingnews.jpg')} style={{ width: 100, height: 70, borderRadius: 10 }} />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={{ fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.9)' }}>{item.title}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
                                
                                {purchaseInfo ?
                                <View style={{ backgroundColor: item.sentiment === 'Positive' ? 'rgba(86, 242, 19, 0.9)' : item.sentiment === 'Negative' ? 'rgba(224, 45, 29, 0.9)' : 'rgba(214, 214, 214, 0.9)', padding: 5, borderRadius: 5 }}>
                                <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(39, 39, 39, 0.9)' }}>{item.sentiment || 'Neutral'}</Text>
                                </View>
                                :
                                <View style={[styles.keywordSubContainerSentiment, {marginLeft: 10, backgroundColor: '#FF07C9'}]}>
                                <Text style={styles.keyword}>Get Premium!</Text>
                                </View> 
                                }
                                <Text style={{ fontSize: 12, fontWeight: '400', color: 'rgba(147, 147, 147, 0.9)', marginLeft: 5 }}>|</Text>
                                <Text style={{ fontSize: 12, fontWeight: '400', color: 'rgba(147, 147, 147, 0.9)', marginLeft: 5 }}>{item.source} - {item.published_at || 'Unknown time'}</Text>
                            </View>
                            </View>
                        </View>
                    </Pressable>
                    ))
                ) : (
                    <Text style={{ textAlign: "center", marginTop: 20 }}>No results found.</Text>
                )}
            </View>
        </View>
      </ScrollView>
    )
  );
};

const styles = StyleSheet.create({
  InputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 10,
    borderRadius: 25,
    justifyContent: "space-between",
    position: "relative",
    zIndex: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  input: {
    margin: 0,
    height: 40,
    width: screenWidth / 1.3,
    fontFamily: "Poppins_600SemiBold",
    padding: 10,
    color: "rgba(147, 147, 147, 0.9)",
    borderRadius: 25,
  },
  barsButton: {
    paddingLeft: 20,
    backgroundColor: "white",
    borderTopLeftRadius: 25,
    borderBottomLeftRadius: 25,
    margin: 0,
    paddingHorizontal: 10,
    height: 40,
    justifyContent: "center",
  },
  searchButton: {
    paddingRight: 5,
    paddingLeft: 15,
    borderTopLeftRadius: 25,
    borderBottomLeftRadius: 25,
    margin: 0,
    height: 40,
    justifyContent: "center",
  },
  dropdownContainer: {
    flex: 1,
    position: "relative",
  },
  dropdownItem: {
    padding: 10,
    marginTop: 2,
    backgroundColor: "#FAF9F8",
  },
  dropdownItemText: {
    color: "#222",
  },
  itemsContainer: {
    maxHeight: screenWidth / 3,
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: "#FFF",
    borderBottomRightRadius: 5,
    borderBottomLeftRadius: 5,
  },
  menu: {
    position: "absolute",
    top: 200,
    left: 20,
    right: 20,
    height: screenWidth / 1.5,
    backgroundColor: "rgba(0, 0, 0, 0.93)",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
    zIndex: 1000,
  },
  menuItem: {
    padding: 15,
    borderBottomColor: "#ddd",
    borderBottomWidth: 1,
  },
  menuItemText: {
    fontSize: 16,
    color: "#333",
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
  resultItem: {
    padding: 15,
    borderBottomColor: "#ddd",
    borderBottomWidth: 1,
  },
  resultText: {
    fontSize: 16,
    color: "#333",
  },
});

export default SearchScreen;