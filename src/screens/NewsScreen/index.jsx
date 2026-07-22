import React, { useEffect, useState } from "react";
import { View, Text, ImageBackground, Pressable, Image,TextInput, StyleSheet, Dimensions, ActivityIndicator, TouchableOpacity, ScrollView } from "react-native";
import bg from "../../imgs/bgimg.png";
import auth from '@react-native-firebase/auth';
import NewsNavigation from "./components/NewsNav/newsNav";
import { AntDesign, FontAwesome } from "@expo/vector-icons";
const screenWidth = Dimensions.get("window").width;
import MyPager from "./components/Carousel";
// import NewsList from "./components/NewsList";
import img1 from '../../imgs/breakingnews.jpg';
import img2 from '../../imgs/bg2.png';
import { getNews, getRecentNews, getFearAndGreedIndex, getBtcDominance, getRecentCoinWatcher, getMongoDBData, getMyFXBookData} from "../../services/requests";
import StoryCarousel from "./components/StoryCarousel";
import RoundButtonWithModal from "./components/RoundStoryButton";
import MiniGauge from './SubScreens/Finacials/MiniGauge';
import { formatNumber } from "../../services/dataManipulation";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import Purchases from "react-native-purchases";
import GetPremiumButton from "../../components/GetPremiumButton";
import OpenInterestWidget from "./components/OpenInterestWidget";
import FundingRateWidget from "./components/FundingRateWidget";
import OrderBookDepthWidget from "./components/OrderBookDepthWidget";
import { Platform } from 'react-native';
import LoadingFullScreen from "../../components/LoadingFullScreen";
import PlaceHolderForRoundStoryButton from "./components/RoundStoryButton/placeHolderForRoundStoryButton";
import NewsSentimentCircle from "./SubScreens/Sentiment/NewsSentimentCircle";

var padding = 30;
var paddingBG = 40;
if (Platform.OS === 'ios') {
  padding = 30;
  paddingBG = 40;
} else if (Platform.OS === 'android') {
  padding = 15;
  paddingBG = 20;
}
const NewsScreen = () => {
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false;
  const [number, onChangeNumber] = useState('');
  const [news, setNews] = useState([]);
  const [urgent, setUrgent] = useState();
  const [recentNews, setRecentNews] = useState([]);
  const [fearAndGreed, setFearAndGreed] = useState();
  const [btcDominance, setBtcDominance] = useState(null);
  const navigation = useNavigation();
  const [dailySummary, setDailySummary] = useState([]);
  const [purchaseInfo, setPurchaseInfo] = useState([]);
  const [aiDailySummary, setAIDailySummary] = useState([]);
  const [canWeTradeToday, setCanWeTradeToday] = useState([]);
  const [canWeTradeTodayValue, setCanWeTradeTodayValue] = useState([]);
  const [topCoinsToTrade, setTopCoinsToTrade] = useState([]);
  const [ economicCalender,setEconomicCalender] = useState();  

  const [loading, setLoading] = useState(true);

  const stories = [
    { id: '1', image: "https://static.vecteezy.com/system/resources/previews/033/113/436/large_2x/graph-and-chart-backdrop-embodies-forex-trading-market-dynamics-and-investment-concepts-vertical-mobile-wallpaper-ai-generated-free-photo.jpg", title: 'Yes! All our indicators are pointing to yes!' },
    // Add more stories as needed
  ];
  const stories1 = [
    { id: '1', image: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png', title: 'Story 1' },
    { id: '2', image: 'https://images.emojiterra.com/google/noto-emoji/unicode-16.0/color/share/1f914.jpg', title: 'Story 2' },
    { id: '3', image: 'https://www.barnacleai.com/Images/AIPic.webp', title: 'Story 2' },

    // Add more stories as needed
  ];
  const data = [
        { image: img1, text: 'Breaking News' },
        { image: img2, text: 'Background 2' },
        { image: img1, text: 'Breaking News' },
        { image: img2, text: 'Background 2' },
        // Add more items as needed
      ];
  
  useFocusEffect(
    React.useCallback(() => {
      const getPurchaserInfo = async () => {
        try {
          const purchaserInfo = await Purchases.getCustomerInfo();
          setPurchaseInfo(purchaserInfo.activeSubscriptions[0]);
        } catch (e) {
          console.error("Error fetching purchaser info:", e);
        }
      };
      getPurchaserInfo();
      const fetchUrgentData = async () => {
        try{
          const info = await getRecentCoinWatcher(isLoggedIn, 30,3, false);
  
          setUrgent(info);
          if(info){
            const transformedStories = info.map((item, index) => ({
              id: (index + 1).toString(), // Ensure a unique id for each story
              image: index == 0 ? 'https://images.pexels.com/photos/7078525/pexels-photo-7078525.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
              : index == 1 ? 'https://images.pexels.com/photos/9492550/pexels-photo-9492550.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
              : 'https://images.pexels.com/photos/16610730/pexels-photo-16610730/free-photo-of-modern-skyscrapers-in-vancouver-british-columbia-canada.jpeg', // Default image URL
              title: item.message_text.replace('JUST IN:', '') || 'That\'s all for toady!', // Use event as title, fallback to 'Untitled Event' if missing
            }));
      
            setDailySummary(transformedStories)
          }
        }catch(e){
          console.log(e)
        }
      }
      // fetchUrgentData();
  }, [isLoggedIn])
  );
  
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
    setLoading(true);
    const fetchNews = async () => {
        try {
          const info = await getNews();
          if (info) {
            setNews(info);
          }
        } catch (error) {
          console.error("Error fetching news:", error);
        }
    };
    const fetchRecentNews = async () => {

        try {
          const info = await getRecentNews();
          if (info) {
            setRecentNews(info);
          }
        } catch (error) {
          console.error("Error fetching news:", error);
        } 
    };
    const fetchData = async () => {
      try{
        const info = await getFearAndGreedIndex();

        setFearAndGreed(info);
      }catch(e){
        console.log(e)
      }
    }
    const fetchBtcDominance = async () => {
      setLoading(true)
      try {
        const dominance = await getBtcDominance();

        setBtcDominance(dominance);
      } catch (error) {
        setError('Failed to fetch BTC dominance');
      } finally {
        
      }
    };
    const fetchUrgentData = async () => {
      try{
        const info = await getRecentCoinWatcher(isLoggedIn, 30,3, false);

        setUrgent(info);
        if(info){
          const transformedStories = info.map((item, index) => ({
            id: (index + 1).toString(), // Ensure a unique id for each story
            image: index == 0 ? 'https://images.pexels.com/photos/7078525/pexels-photo-7078525.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
            : index == 1 ? 'https://images.pexels.com/photos/9492550/pexels-photo-9492550.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
            : 'https://images.pexels.com/photos/16610730/pexels-photo-16610730/free-photo-of-modern-skyscrapers-in-vancouver-british-columbia-canada.jpeg', // Default image URL
            title: item.message_text.replace('JUST IN:', '') || 'That\'s all for toady!', // Use event as title, fallback to 'Untitled Event' if missing
          }));
    
          setDailySummary(transformedStories)
        }
        setLoading(false);
      }catch(e){
        console.log(e)
      }
    }

    const getDailySummary = async () => {
      try {
        const info = await getMongoDBData('DailySummary', {},{ _id: -1 }, 1);
        if (info) {
          const summaryText = info[0].summary.text;
          const targetLength = 400; // Target length for each story
          const stories = [];
          let currentPosition = 0;

          while (currentPosition < summaryText.length) {
            // Find the next bullet point after the target length
            let nextBreak = summaryText.indexOf('-', currentPosition + targetLength);
            
            // If no more bullet points, use the end of the text
            if (nextBreak === -1) {
              nextBreak = summaryText.length;
            }
            
            // Extract the story part
            const storyPart = summaryText.slice(currentPosition, nextBreak).trim();
            
            if (storyPart) {
              stories.push({
                id: stories.length.toString(),
                image: stories.length === 0 ? 'https://www.barnacleai.com/Images/Background.gif'
                  : stories.length === 1 ? 'https://www.barnacleai.com/Images/_81cfad27-dfe6-4f37-a6a4-64dba5549ee1.jpeg'
                  : 'https://www.barnacleai.com/Images/bg_whale_fix_divers.jpeg',
                title: storyPart.replace('JUST IN:', '').trim() || 'That\'s all for today!',
              });
            }
            
            currentPosition = nextBreak;
          }

          // If no stories were created (unlikely), add a default message
          if (stories.length === 0) {
            stories.push({
              id: '0',
              image: 'https://images.pexels.com/photos/7078525/pexels-photo-7078525.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
              title: 'No news stories available',
            });
          }

          setAIDailySummary(stories);

        }
      } catch (error) {
        console.error("Error fetching news:", error);
      }
    };

    const getCanWeTradeToday = async () => {
      try {
        const info = await getMongoDBData('ShouldWeTradeToday', {},{ _id: -1 }, 1);
        if (info) {
          setCanWeTradeTodayValue(info[0].summary.text);
          const summaryText = info[0].summary.text;
          const targetLength = 400; // Target length for each story
          const stories = [];
          let currentPosition = 0;

          while (currentPosition < summaryText.length) {
            // Find the next bullet point after the target length
            let nextBreak = summaryText.indexOf('-', currentPosition + targetLength);
            
            // If no more bullet points, use the end of the text
            if (nextBreak === -1) {
              nextBreak = summaryText.length;
            }
            
            // Extract the story part
            const storyPart = summaryText.slice(currentPosition, nextBreak).trim();
            
            if (storyPart) {
              stories.push({
                id: stories.length.toString(),
                image: stories.length === 0 ? 'https://static.vecteezy.com/system/resources/previews/033/113/436/large_2x/graph-and-chart-backdrop-embodies-forex-trading-market-dynamics-and-investment-concepts-vertical-mobile-wallpaper-ai-generated-free-photo.jpg'
                  : stories.length === 1 ? 'https://www.barnacleai.com/Images/_81cfad27-dfe6-4f37-a6a4-64dba5549ee1.jpeg'
                  : 'https://www.barnacleai.com/Images/bg_whale_fix_divers.jpeg',
                title: storyPart.replace('JUST IN:', '').trim() || 'That\'s all for today!',
              });
            }
            
            currentPosition = nextBreak;
          }

          // If no stories were created (unlikely), add a default message
          if (stories.length === 0) {
            stories.push({
              id: '0',
              image: 'https://static.vecteezy.com/system/resources/previews/033/113/436/large_2x/graph-and-chart-backdrop-embodies-forex-trading-market-dynamics-and-investment-concepts-vertical-mobile-wallpaper-ai-generated-free-photo.jpg',
              title: 'No news stories available',
            });
          }

          setCanWeTradeToday(stories);

        }
      } catch (error) {
        console.error("Error fetching news:", error);
      }
    };

    const getTopCoinsToTrade = async () => {
      try {
        const info = await getMongoDBData('TopCoinsToTrade', {},{ _id: -1 }, 5);
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
        console.error("Error fetching news:", error);
      }
    };
    const fetchEconomicCalender = async () => {
      try{
        const info = await getMyFXBookData(isLoggedIn, 24, 6, true);
        const filteredInfo = info.filter(item => item.impact === 'High').concat(info.filter(item => item.impact !== 'High'));
        setEconomicCalender(filteredInfo);
      }catch(e){
        console.log(e)
      }
    }

    fetchEconomicCalender();
    getTopCoinsToTrade(); // Fetch top coins to trade
    getCanWeTradeToday();
    getDailySummary();
    fetchUrgentData();
    fetchBtcDominance();
    fetchData();
    fetchRecentNews();
    fetchNews();
    setLoading(false);

  }, [isLoggedIn]);

  return (
    loading || !fearAndGreed  || !btcDominance ?
      <LoadingFullScreen 
        spinnerSource={require('../../imgs/ngjyra.png')}
        backgroundSource={require('../../imgs/back that.png')}
      />
      :
    <View style={{ flex: 1, paddingTop: paddingBG }}>
      <ScrollView>
        <View style={{ paddingHorizontal: padding }}>
          <Text
            style={{
              color: "white",
              fontSize: 28,
              fontFamily: "Poppins_700Bold",
              paddingTop: padding,
            }}
          >
            Discover.
          </Text>
          <Text style={{
              color: "white",
              fontSize: 14,
              fontFamily: "Poppins_600SemiBold",
            }}>
              News, Financials, Sentiment, and AI Analysis!
          </Text>
        </View>
        <NewsNavigation active={1}/>
        {/* <View style={styles.InputContainer}>
          <Pressable style={{ paddingLeft: 20 }}>
            <FontAwesome name="bars" size={24} color="rgba(25,25,25,0.9)" />
          </Pressable>
          <TextInput
            style={styles.input}
            onChangeText={onChangeNumber}
            value={number}
            placeholder="Search Anything..."
          />
          <Pressable style={{ paddingRight: 15, paddingLeft: 5 }}>
            <AntDesign name="search1" size={24} color="rgba(25,25,25,0.9)" />
          </Pressable>
        </View> */}
        <View>
        {loading || !fearAndGreed  || !btcDominance? (
            <LoadingFullScreen 
              spinnerSource={require('../../imgs/ngjyra.png')}
              backgroundSource={require('../../imgs/back that.png')}
            />
          ) :  (
            <>
              {/* <View style={{paddingHorizontal: 20, paddingTop: 20, display: 'flex', flexDirection: 'row'}}> */}
                {/* <View style={{marginHorizontal: 5}}><RoundButtonWithModal stories={stories} image={stories[0].image}  storyText={'BarnacleAI'}/></View> */}
                {/* {urgent && dailySummary.length > 0 ? <View style={{marginHorizontal: 5}}><RoundButtonWithModal stories={dailySummary} textSize={32} image={stories1[0].image} storyText={'Daily Summary'}/></View> : <PlaceHolderForRoundStoryButton storyText={'Daily Summary'} /> } */}
                {/* {aiDailySummary.length > 0 ? <View style={{marginHorizontal: 5}}><RoundButtonWithModal stories={aiDailySummary} textSize={19} image={stories1[2].image} storyText={'AI 24hr Summary'}/></View> : <PlaceHolderForRoundStoryButton storyText={'AI 24hr Summary'} />} */}
                {/* <View style={{marginHorizontal: 5}}><RoundButtonWithModal stories={stories} image={stories1[1].image} storyText={'P/L Update'}/></View> */}
                {/* {canWeTradeToday.length > 0 ? <View style={{marginHorizontal: 5}}><RoundButtonWithModal stories={canWeTradeToday} textSize={24} image={stories1[1].image} storyText={'Trade today?'}/></View> : <PlaceHolderForRoundStoryButton storyText={'Trade today?'} />} */}
              {/* </View> */}
               
              <TouchableOpacity style={{display: 'flex', flexDirection: 'column', marginTop: 20, paddingVertical: 10, paddingHorizontal: 0, marginHorizontal: 15, borderRadius: 10}} onPress={() => navigation.navigate('ImportantAlerts')}>
                <Text style={{color: 'white', fontSize: 18, marginBottom: 10, fontWeight: 'bold', color: '#fff'}}>Important Alerts <AntDesign name="arrowright" size={24} color="#fff" /></Text>
                <View style={{backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 10, padding: 15, minHeight: 80, justifyContent: 'center', alignItems: 'center'}}>
                  {urgent?.length > 0 ?
                  purchaseInfo ? 
                    urgent.map((item, index) => (
                      item.message_text ? 
                        <View key={index} style={{alignItems:'center', display: 'flex', flexDirection: 'row', marginVertical: 5}}>
                          <View style={{backgroundColor: item.sentiment == 'positive' ? '#16c784' : item.sentiment == 'negative' ? '#d92222' : 'orange', height: 7, width: 7, borderRadius: 30, marginRight: 4}}></View>
                          <View><Text style={{color: '#d92222', marginRight: 10}}>High</Text></View>
                          <Text style={{color: '#fff', marginRight: 10}}>{item.message_text.replace('JUST IN:', '') < 45 ? item.message_text.replace('JUST IN:', '').replace('\n', '').replace('@WatcherGuru', '') : item.message_text.replace('JUST IN:', '').replace('\n', '').replace('@WatcherGuru', '').substring(0, 45)}...</Text>
                        </View> 
                      : <></>
                    )) : <GetPremiumButton/>
                    : <><Text style={{color: 'white', fontSize: 15}}>No urgent news/alerts at this time</Text></>}
                </View>
              </TouchableOpacity>
              <View style={{ marginTop: 20 }}>
                <Text
                  style={{
                    color: "#FFF",
                    fontSize: 18,
                    fontWeight: "bold",
                    marginLeft: 15,
                    marginBottom: 10,
                  }}
                >
                  Economic Events
                </Text>
                {economicCalender && economicCalender.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 10 }}
                  >
                    {economicCalender.map((item, index) => (
                      <TouchableOpacity
                        key={index}
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: 10,
                          padding: 15,
                          marginRight: 10,
                          width: screenWidth * 0.8, // Adjust card width
                        }}
                        onPress={() => navigation.navigate("EconomicCalender")}
                      >
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 16,
                            fontFamily: "Poppins_600SemiBold",
                            marginBottom: 5,
                          }}
                        >
                          {new Date(item.date_time).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Text>
                        <Text
                          style={{
                            color: "#aaa",
                            fontSize: 14,
                            fontFamily: "Poppins_500Medium",
                            marginBottom: 5,
                          }}
                        >
                          {item.country}
                        </Text>
                        <Text
                          style={{
                            color: "#fff",
                            fontSize: 16,
                            fontFamily: "Poppins_500Medium",
                            marginBottom: 10,
                            lineHeight: 22,
                          }}
                        >
                          {item.event}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginVertical: 5,
                          }}
                        >
                          <View style={{ flex: 1, alignItems: "center" }}>
                            <Text
                              style={{
                                color: "#aaa",
                                fontSize: 12,
                                fontFamily: "Poppins_500Medium",
                              }}
                            >
                              Previous:
                            </Text>
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 14,
                                fontFamily: "Poppins_600SemiBold",
                              }}
                            >
                              {item.previous_value || "N/A"}
                            </Text>
                          </View>
                          <View style={{ flex: 1, alignItems: "center" }}>
                            <Text
                              style={{
                                color: "#aaa",
                                fontSize: 12,
                                fontFamily: "Poppins_500Medium",
                              }}
                            >
                              Actual:
                            </Text>
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 14,
                                fontFamily: "Poppins_600SemiBold",
                              }}
                            >
                              {item.actual_value || "N/A"}
                            </Text>
                          </View>
                          <View style={{ flex: 1, alignItems: "center" }}>
                            <Text
                              style={{
                                color: "#aaa",
                                fontSize: 12,
                                fontFamily: "Poppins_500Medium",
                              }}
                            >
                              Consensus:
                            </Text>
                            <Text
                              style={{
                                color: "#fff",
                                fontSize: 14,
                                fontFamily: "Poppins_600SemiBold",
                              }}
                            >
                              {item.consensus_value || "N/A"}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={{
                            fontSize: 14,
                            fontFamily: "Poppins_500Medium",
                            marginTop: 10,
                            color:
                              item.impact === "Low"
                                ? "#16c784"
                                : item.impact === "High"
                                ? "#d92222"
                                : "orange",
                          }}
                        >
                          {item.impact} Impact
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <Text
                    style={{
                      color: "white",
                      fontSize: 15,
                      textAlign: "center",
                      marginTop: 10,
                    }}
                  >
                    No economic calendar data available at this time.
                  </Text>
                )}
              </View>
              <View style={{display: 'flex', flexDirection: 'row', marginTop: 20}}>
                <View style={{width: screenWidth/3.5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 15, padding: 10, margin: 10, alignContent: 'center'}}>
                  <MiniGauge value={parseInt(fearAndGreed.value, 10)} />
                  <Text style={{
                    fontSize: 18,
                    fontFamily: 'Poppins_700Bold',
                    fontWeight: 'bold',
                    color: '#FFF',
                    textAlign: 'center'
                  }}>{fearAndGreed.value_classification}</Text>
                </View>
                <View style={{width: screenWidth/3.5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 15, padding: 10, margin: 10}}>
                  <View style={{
                                justifyContent: 'center',
                                alignItems: 'center',}}>
                    <Text style={{marginBottom: 10,
                                  fontSize: 15,
                                  fontWeight: 'bold',
                                  color: '#FF07C9',
                    }}>Bitcoin Dominance</Text>
                    <Text style={{marginTop: 20,
                                  fontSize: 26,
                                  fontWeight: 'bold',
                                  color: '#FF07C9',}}>{btcDominance.bitcoin_dominance_percentage}%</Text>
                    <View style={{display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 10}}>
                      <Image source={{ uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png'}} style={{width: 25, height: 25, borderRadius: 50}}/>
                      <Text style={{fontSize: 18, color: 'rgba(200,200,200,0.8)', fontWeight: 'bold', marginLeft: 5}}>BTC</Text>
                    </View>
                  </View>  
                </View>
                <View style={{width: screenWidth/3.5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 15, padding: 10, margin: 10, alignContent: 'center'}}>
                  <View style={{
                                flex: 1,
                                justifyContent: 'center',
                                alignItems: 'center',}}>
                    <Text style={{marginBottom: 3,
                                  fontSize: 15,
                                  fontWeight: 'bold',
                                  color: '#FF07C9'
                    }}>Volume</Text>
                    <Text style={{marginTop: 2,
                                  fontSize: 18,
                                  fontWeight: 'bold',
                                  color: '#FFF',}}>{formatNumber(parseInt(btcDominance.volume_24h_usd))}</Text>
                    <View style={{backgroundColor: 'rgba(255, 255, 255, 0.8)', height: 1, marginTop: 15, marginBottom: 15, width: screenWidth/4}}></View>
                    <Text style={{marginBottom: 3,
                                  fontSize: 15,
                                  fontWeight: 'bold',
                                  color: '#FF07C9'
                    }}>Market Cap</Text>
                    <Text style={{marginTop: 2,
                                  fontSize: 18,
                                  fontWeight: 'bold',
                                  color: '#FFF',}}>{formatNumber(parseInt(btcDominance.market_cap_usd))}</Text>
                  </View>  
                </View>
              </View>
              <View style={{display: 'flex', flexDirection: 'row', marginTop: 20}}>
                <View style={{width: screenWidth/3.5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 15, padding: 10, margin: 10, alignContent: 'center'}}>
                  <NewsSentimentCircle />
                  <Text style={{marginTop: 10,
                                  fontSize: 13,
                                  fontWeight: 'bold',
                                  color: '#fff',
                                  textAlign: 'center'
                    }}>Overall News Sentiment</Text>
                </View>
                <View style={{width: screenWidth/3.5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 15, padding: 10, margin: 10, alignContent: 'center'}}>
                  <Text style={{marginTop: 10,
                                    fontSize: 12,
                                    fontWeight: 'bold',
                                    color: '#fff',
                                    textAlign: 'center'
                      }}>Can We Trade Today?</Text>
                  <Text style={{marginTop: 10,
                                  fontSize: 12,
                                  fontWeight: 'bold',
                                  color: '#fff',
                                  textAlign: 'center'
                    }}>{canWeTradeTodayValue ?? "Loading..."}</Text>
                </View>
              </View>

            {purchaseInfo ? 
              <View style={{display: 'flex', flexDirection: 'row', marginTop: 20}}>
                {/* <View style={{width: screenWidth/3.5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 15, padding: 10, margin: 10, alignContent: 'center'}}>
                <Text style={{marginBottom: 10,
                                  fontSize: 15,
                                  fontWeight: 'bold',
                                  color: '#FF07C9',
                    }}>BTC Order Book Depth</Text>
                    <OrderBookDepthWidget/>
                </View> */}
                {/* <TouchableOpacity onPress={() => navigation.navigate('ChatScreen')} style={{width: screenWidth/3.5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 15, padding: 10, margin: 10, alignContent: 'center'}}>
                <Text style={{marginBottom: 10,
                                  fontSize: 15,
                                  fontWeight: 'bold',
                                  color: '#FF07C9',
                    }}>Try our new news and analysis AI</Text>
                    <Image source={{ uri: "https://www.barnacleai.com/Images/Logo.png"}} style={{
                      alignSelf: 'center',
                      width: screenWidth/6,
                      height: screenWidth/6
                    }} 
                    />
                </TouchableOpacity> */}
                {/* <View style={{width: screenWidth/3.5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 15, padding: 10, margin: 10}}>
                  <View style={{
                                justifyContent: 'center',
                                alignItems: 'center',}}>
                    <Text style={{marginBottom: 10,
                                  fontSize: 15,
                                  fontWeight: 'bold',
                                  color: '#FF07C9',
                    }}>Open Interest Rates</Text>
                    <OpenInterestWidget/>
                  </View>  
                </View> */}
                {/* <View style={{width: screenWidth/3.5, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 15, padding: 10, margin: 10, alignContent: 'center'}}>

                    <Text style={{marginBottom: 3,
                                  fontSize: 15,
                                  fontWeight: 'bold',
                                  color: '#FF07C9'
                    }}>BTC Funding Rate</Text>
                    <FundingRateWidget/>
                </View> */}
              </View>
              : <GetPremiumButton/>
              }
              <View style={{paddingHorizontal: 30}}>
                <Text style={{
                  color: "white",
                  fontSize: 16,
                  fontFamily: "Poppins_700Bold",
                  paddingTop: 30,
                }}>Possible Trades:</Text>
                <View>
                  {topCoinsToTrade.map((coin, index) => (
                    <TouchableOpacity key={coin._id} style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)', paddingVertical: 10}}>
                    {/* <TouchableOpacity onPress={() => navigation.navigate('CoinDetailScreen', {coin: coin.symbol.replace('USDT', '')})} key={coin._id} style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)', paddingVertical: 10}}> */}

                      <View style={{padding: 10, display: 'flex', flexDirection: 'row'}}>
                        {/* <View style={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
                          <View><Image source={{ uri: `https://s2.coinmarketcap.com/static/img/coins/64x64/${coin.symbol}.png`}} style={{width: 30, height: 30, borderRadius: 50}}/></View>
                        </View> */}
                        <View style={{paddingLeft: 10}}>
                          <Text style={{fontSize: 15, color: 'rgba(200,200,200,0.8)', fontFamily: "Poppins_700Bold",}}>{coin.symbol.replace('USDT', '/USDT')}</Text>
                          <View style={{display: 'flex', flexDirection: 'row'}}>
                            <View style={{backgroundColor: 'rgba(80,80,80,1)', paddingVertical: 2,paddingHorizontal: 5, borderRadius: 5}}><Text style={{fontSize: 13, color: 'rgba(200,200,200,0.8)', fontWeight: 'bold'}}>{index + 1}</Text></View>
                            <Text style={{fontSize: 13, color: 'rgba(200,200,200,0.8)', fontWeight: 'bold', marginLeft: 5}}>-{(coin.difference * 100).toFixed(2)}%</Text>
                          </View>
                          <Text style={{fontSize: 13, color: 'rgba(200,200,200,0.8)', fontFamily: "Poppins_700Bold", marginTop: 5}}>{new Date(coin.signal.time).toLocaleDateString()}</Text>
                        </View>
                      </View>
                      <View style={{display: 'flex', flexDirection: 'column'}}>
                        {/* <Text style={{color: 'red', fontSize: 15, fontFamily: "Poppins_700Bold"}}>{coin.difference * 100}%</Text> */}
                        <Text style={{color: 'white', fontSize: 15, fontFamily: "Poppins_700Bold"}}>Buy at:</Text>
                        <Text style={{color: 'white', fontSize: 15, fontFamily: "Poppins_700Bold"}}>${coin.signal.entry_price > 0.99 ? coin.signal.entry_price.toFixed(2) : coin.signal.entry_price.toFixed(5)  }</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* <View style={{paddingHorizontal: 30}}>
                <Text style={{
                    color: "white",
                    fontSize: 20,
                    fontFamily: "Poppins_700Bold",
                    paddingTop: 30,
                  }}>Top Coins</Text>
                <View>
                  
                  <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.4)', paddingVertical: 10}}>
                    <View style={{padding: 10, display: 'flex', flexDirection: 'row'}}>
                      <View style={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
                        <View><Image source={{ uri: 'https://s2.coinmarketcap.com/static/img/coins/64x64/1.png'}} style={{width: 30, height: 30, borderRadius: 50}}/></View>
                      </View>
                      <View style={{paddingLeft: 10}}>
                        <Text style={{fontSize: 15, color: 'rgba(200,200,200,0.8)', fontFamily: "Poppins_700Bold",}}>Bitcoin</Text>
                        <View style={{display: 'flex', flexDirection: 'row'}}>
                          <View style={{backgroundColor: 'rgba(80,80,80,1)', paddingVertical: 2,paddingHorizontal: 5, borderRadius: 5}}><Text style={{fontSize: 13, color: 'rgba(200,200,200,0.8)', fontWeight: 'bold'}}>1</Text></View>
                          <Text style={{fontSize: 13, color: 'rgba(200,200,200,0.8)', fontWeight: 'bold', marginLeft: 5}}>BTC</Text>
                        </View>
                      </View>
                    </View>
                    <View style={{display: 'flex', flexDirection: 'row'}}>
                        <Text style={{color: 'red', fontSize: 15, fontFamily: "Poppins_700Bold"}}>4.34%</Text>
                        <Text style={{color: 'white', fontSize: 15, fontFamily: "Poppins_700Bold", marginLeft: 50}}>$58,123.45</Text>
                    </View>
                  </View>
                </View>
              </View> */}
              {/* <MyPager data={recentNews.map(item => ({
                image: item.image_url ? { uri: item.image_url } : img1, // Use a placeholder image if no image URL
                text: item.title.length > 100 ? item.title.substring(0, 100) + '...' : item.title,
                keyword: item.source,
                url: item.link
              }))} />
              <NewsList data={news.map(item => ({
                image: item.image_url ? { uri: item.image_url } : img1, // Use a placeholder image if no image URL
                text: item.title,
                keyword: item.source,
                url: item.link
              }))} /> */}
            </>
          ) }
        </View>
        <View style={{height: 80}}></View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  InputContainer: {
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: 'white',
    alignItems: 'center',
    marginHorizontal: 10,
    borderRadius: 25,
    justifyContent: 'space-between'
  },
  input: {
    height: 40,
    width: screenWidth / 1.4,
    backgroundColor: 'white',
    fontFamily: 'Poppins_600SemiBold',
    padding: 10,
  },
});

export default NewsScreen;
