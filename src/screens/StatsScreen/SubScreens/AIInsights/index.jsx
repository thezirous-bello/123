import React, { useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  View,
  Text,
  StyleSheet,
  Image,
  ImageBackground,
  ActivityIndicator,
  BackHandler,
  Dimensions,
  ScrollView
} from "react-native";
import bg from "../../../../imgs/bgimg.png";
import {
  fetchFundingRates,
  fetchOpenInterest,
  getFearAndGreedIndex,
  getSignals
} from "../../../../services/requests";
import { useNavigation } from "@react-navigation/native";
import auth from '@react-native-firebase/auth';
import StatsNavigation from "../../Components/StatsNav";
import ExpandableList from '../../../../components/ExpandableList/ExpandableList'
import Purchases from "react-native-purchases";
import GetPremium from "../../../../components/GetPremium";
const screenWidth = Dimensions.get("window").width;
import { formatNumber } from "../../../../services/dataManipulation";
import { TypingEffect } from "./components/TypingAnimation";
import { getStochRSI } from "../../../../services/requests";
import StochRSIIndicator from "./components/RSICheck";
import FundingRateIndicator from "./components/FundingRateCheck";
import OpenInterestIndicator from "./components/OpenInterestCheck";
import { fetchSentimentData } from "../../../../services/requests";
import NewsSentimentIndicator from "./components/NewsSentimentCheck";
import FearNGreedMiniGauge from "./components/FearNGreedCheck";
import CompoundInvestmentChart from "./components/CompoundChart";
import CandleGuide from "./components/CandleCharts";
import OrderBookDepthWidget from "../../../NewsScreen/components/OrderBookDepthWidget";

const AIInsights = () => {
  var {height, width} = Dimensions.get('window');

  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 

  const navigation = useNavigation();
  const [dbdata, setDBdata] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState([]);
  const [stochRSI, setStochRSI] = useState(null);
  const [fundingRate, setFundingRate] = useState(null);
  const [openInterest, setOpenInterest] = useState(null);
  const [sentimentData, setSentimentData] = useState(null);
  const [fearNGreed, setFearNGreed] = useState(null);

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
  const getRSI = async () => {
    try{
      const stochRSICall = await getStochRSI('BTCUSDT', '4h');
      setStochRSI(stochRSICall);
    }catch (e){
      console.log("error: " + e)
      setStochRSI(
        {
          "stoch_rsi_d": null,
          "stoch_rsi_k": null
        }
      )
    }
  }
  getRSI();
  const fundingRates = async () => {
    try{
      const fundingRateCall = await fetchFundingRates('BTCUSDT');
      setFundingRate(fundingRateCall);
    }catch (e){
      console.log("error: " + e)
      setFundingRate(0.0)
    }
  }
  fundingRates();

  const openInterest = async () => {
    try{
      const openInterestCall = await fetchOpenInterest('BTCUSDT');
      setOpenInterest(openInterestCall);
    }catch (e){
      console.log("error: " + e)
      setOpenInterest(0.0)
    }
  }
  openInterest();
  const loadSentimentData = async () => {
    const data = await fetchSentimentData();
    setSentimentData(data);
  };
  loadSentimentData();

  const fetchFnGData = async () => {
    try{
      const info = await getFearAndGreedIndex();

      setFearNGreed(info);
    }catch(e){
      console.log(e)
    }
  }
  fetchFnGData();
  setLoading(false)
  }, []);

  if (loading) {
    return <ActivityIndicator style={{marginTop: height/2.5}} size="large" />;
  }
  if (error) {
    return <Text style={{color:'white', marginTop: height/2.5, textAlign: 'center', fontSize: 15,fontFamily: "Poppins_600SemiBold", }}>Something went wrong, please try again later...</Text>
  }

  return (
    <View style={styles.image}>
      <Text
        style={{
          color: "white",
          fontSize: 20,
          letterSpacing: 1,
          marginBottom: 20,
          fontFamily: "Poppins_700Bold",
        }}
      >
        Signals / Trading
      </Text>
      <StatsNavigation active={3}/>
      <ScrollView>
      <Text style={{color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 20}}>AI Insights</Text>
      <TypingEffect text={"Can we trade today? \nWell, here are a few common indicators we use to understand the market."}/>
      {purchaseInfo ? 
      <View style={{paddingBottom: 80}}>        
              <View style={{display: 'flex', flexDirection: 'row', marginTop: 20}}>
                <View style={{width: screenWidth/3.7, backgroundColor: '#D9D9D921', borderRadius: 15, padding: 10, margin: 10, alignContent: 'center'}}>
                  {stochRSI ? 
                  <View>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Poppins_700Bold',
                      fontWeight: 'bold',
                      color: '#FF07C9',
                      textAlign: 'center'
                    }}>BTC Stoch RSI</Text>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Poppins_700Bold',
                      fontWeight: 'bold',
                      color: '#FFF',
                      textAlign: 'center'
                    }}>D-Line: {stochRSI?.stoch_rsi_d.toFixed(2)}</Text>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Poppins_700Bold',
                      fontWeight: 'bold',
                      color: '#FFF',
                      textAlign: 'center',
                      marginBottom: 10
                    }}>K-Line: {stochRSI?.stoch_rsi_k.toFixed(2)}</Text>
                    <StochRSIIndicator stochRSIData={stochRSI}/>
                  </View>
                  : <ActivityIndicator size={'small'}/>}
                </View>
                <View style={{width: screenWidth/3.7, backgroundColor: '#D9D9D921', borderRadius: 15, padding: 10, margin: 10, alignContent: 'center'}}>
                  {fundingRate ? 
                  <View>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Poppins_700Bold',
                      fontWeight: 'bold',
                      color: '#FF07C9',
                      textAlign: 'center'
                    }}>BTC Funding Rate</Text>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Poppins_700Bold',
                      fontWeight: 'bold',
                      color: '#FFF',
                      textAlign: 'center'
                    }}>{fundingRate?.avg_funding_rate.toFixed(10)}</Text>
                    <FundingRateIndicator fundingRateData={fundingRate}/>
                  </View>
                  : <ActivityIndicator size={'small'}/>}
                </View>
                <View style={{width: screenWidth/3.7, backgroundColor: '#D9D9D921', borderRadius: 15, padding: 10, margin: 10, alignContent: 'center'}}>
                  {openInterest ? 
                  <View>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Poppins_700Bold',
                      fontWeight: 'bold',
                      color: '#FF07C9',
                      textAlign: 'center'
                    }}>BTC Open Interest</Text>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Poppins_700Bold',
                      fontWeight: 'bold',
                      color: '#FFF',
                      textAlign: 'center'
                    }}>{openInterest?.open_interest.toFixed(2)}</Text>
                    <OpenInterestIndicator openInterestData={openInterest}/>
                  </View>
                  : <ActivityIndicator size={'small'}/>}
                </View>
              </View>
              <View style={{display: 'flex', flexDirection: 'row', marginTop: 20}}>
                <View style={{width: screenWidth/3.7, backgroundColor: '#D9D9D921', borderRadius: 15, padding: 10, margin: 10, alignContent: 'center'}}>
                  {sentimentData ? 
                  <View>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Poppins_700Bold',
                      fontWeight: 'bold',
                      color: '#FF07C9',
                      textAlign: 'center'
                    }}>News Sentiment</Text>
                    <NewsSentimentIndicator sentimentData={sentimentData}/>
                  </View>
                  : <ActivityIndicator size={'small'}/>}
                </View>
                <View style={{width: screenWidth/3.7, backgroundColor: '#D9D9D921', borderRadius: 15, padding: 10, margin: 10, alignContent: 'center'}}>
                  {fearNGreed ? 
                  <View>
                    <FearNGreedMiniGauge value={parseInt(fearNGreed.value, 10)} value_classification={fearNGreed.value_classification}/>
                  </View>
                  : <ActivityIndicator size={'small'}/>}
                </View>
                <View style={{width: screenWidth/3.5, backgroundColor: '#D9D9D921', borderRadius: 15, padding: 10, margin: 10, alignContent: 'center'}}>
                <Text style={{marginBottom: 10,
                                  fontSize: 15,
                                  fontWeight: 'bold',
                                  color: '#FF07C9',
                    }}>BTC Order Book Depth</Text>
                    <OrderBookDepthWidget/>
                </View>
                {/* <View style={{width: screenWidth/3.7, backgroundColor: '#D9D9D921', borderRadius: 15, padding: 10, margin: 10, alignContent: 'center'}}>
                  {openInterest ? 
                  <View>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Poppins_700Bold',
                      fontWeight: 'bold',
                      color: '#FF07C9',
                      textAlign: 'center'
                    }}>BTC Open Interest</Text>
                    <Text style={{
                      fontSize: 14,
                      fontFamily: 'Poppins_700Bold',
                      fontWeight: 'bold',
                      color: '#FFF',
                      textAlign: 'center'
                    }}>{openInterest?.open_interest.toFixed(2)}</Text>
                    <OpenInterestIndicator openInterestData={openInterest}/>
                  </View>
                  : <ActivityIndicator size={'small'}/>}
                </View> */}
              </View>
        <View style={{marginTop: 20}}></View>
        <TypingEffect text={"Why do we aim to make low profit trades (1-2%) 🤔? \nBecause we believe in consistent compound day trading as the best way to trade. Here, take a look at this chart!"}/>
        <CompoundInvestmentChart />

        <View style={{marginTop: 20}}></View>
        <TypingEffect text={"This is the result of making 2% everyday for a year with a $1000 initial investment! $1.2 million! 📈"}/>
        <View style={{marginTop: 20}}></View>
        <TypingEffect text={"Join us in making your first million by following our signals! We will be providing a weekly update on profit/loss on the discover page as well as on our social media! 💸"}/>

        {/* <CandleGuide />       */}
      </View>
      
    : 
    <GetPremium/>
    }
    </ScrollView>
    </View>
  );
};

export default AIInsights;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "column",
  },
  image: {
    flex: 1,
    resizeMode: "cover",
    paddingVertical: 20,
    paddingHorizontal: 10,
    paddingTop: 55
    // justifyContent: "center",
  },
  text: {
    color: "white",
    fontSize: 42,
    fontWeight: "bold",
    textAlign: "center",
    backgroundColor: "#000000a0",
  },
  SearchContainer: {},
  dropdownContainer: {
    fontFamily: "Poppins_700Bold",
    borderWidth: 0,
    width: "100%",
    paddingHorizontal: 10,
    paddingVertical: 20,
  },
  itemStyle: {
    padding: 10,
    marginTop: 2,
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#444444",
    borderRadius: 5,
  },
  textInputProps: {
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#444444",
    borderRadius: 5,
    backgroundColor: "#1e1e1e",
    color: "white",
  },
  portfolioValues: {
    backgroundColor: "#251230",
    paddingHorizontal: 10,
    paddingVertical: 15,
    marginHorizontal: 10,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});