import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Dimensions,
  Image,
  TextInput,
  Animated,
  ActivityIndicator,
  SectionList,
  ImageBackground,
  Pressable,
} from "react-native";
import bg from "../../imgs/bgimg.png";
import logo from "../../imgs/logo.png";
import Coin from "../../../assets/data/crypto.json";
import CoinDetailHeader from "./components/CoinDetailHeader";
import styles from "./styles";
import { AntDesign } from "@expo/vector-icons";
import { LineChart } from "react-native-wagmi-charts";
import {
  GestureHandlerRootView,
  ScrollView,
} from "react-native-gesture-handler";
import { XAxis } from "react-native-svg-charts";
import { useRoute } from "@react-navigation/native";
import FilterComponent from "./components/FilterComponent";
import CoinDetailNavigation from "../CoinDetailNavigation";
import {
  getDetailedCoinData,
  getTransactionsForBuysAndSellsPerCoinActualNumber,
  STOCH_RSI_MACD,
  historical_data,
  historical_coin_data
} from "../../services/requests";
import auth from '@react-native-firebase/auth';
import { sortTransactionsByTimestamp, getDefaultStartDate, getDefaultEndDate, formatChartData} from '../../services/dataManipulation'
const filterDaysArray = [
  { filterDay: "1", filterText: "24h" },
  { filterDay: "7", filterText: "7d" },
  { filterDay: "30", filterText: "30d" },
  { filterDay: "365", filterText: "1y" },
  { filterDay: "max", filterText: "All" },
];
import TransactionBarChart from './components/TransactionsBarChart';
import TransactionPieChart from "./components/TransactionPieChart";
import SuperTrend from "./components/SuperTrend";
import HoldingStatusPieChart from "./components/HoldingStatusPieChart";
import AIChartComponent from "./components/AIChartComponent";
import SimpleChartComponent from "./components/SimpleChartComponent";
import ListOfSignals from "./components/ListOfSignals";
import { useNavigation } from "@react-navigation/native";

const CoinInsightsScreen = () => {
  const navigation = useNavigation();
  //User login stuff
  const userID = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 
  


  //Coin Gecko tut stuff
  const [coin, setCoin] = useState(null);
  const [usdValue, setUsdValue] = useState("0");
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState(null);
  const [srm, setsrm] = useState(null);
  const [whichAPI, setWhichAPI] = useState(false);
  const [weDone, setWeDone] = useState();
  const [small, setSmall] = useState('https://www.barnacleai.com/Images/Logo.png');
  const [HistoricalData, setHistoricalData] = useState(null);
  const [coinData, setCoinData] = useState({
    id: null,
    name: null,
    symbol: null,
    market_cap_rank: null,
    price_change_percentage_24h: null,
    total_volume: null,
    total_supply: null,
    max_supply: null,
    circulating_supply: null,
    fully_diluted_valuation: null,
    usd: null,
    en: null,
  });
  const {
    params: { coinID, symbolz, market_cap },
  } = useRoute();


  // const fetchCoinData = async () => {
  //   setLoading(true);
  //   const fetchCoinData = (await getDetailedCoinData(coinID)) || [];

  //   setCoin(fetchCoinData);
  //   setLoading(false);
  // };
  const fetchCoinData = async () => {
    setLoading(true);

    try{
      
      setWhichAPI(false)
      const fetchCoinData = (await getDetailedCoinData(coinID)) || [];
      setUsdValue(fetchCoinData.market_data.current_price.usd.toString());
      setCoin(fetchCoinData);
      //console.log("Running theirs")

    }catch (e){

      //console.log(e + '\n time to run ours')
      try{
        
        const fetchCoinData = (await historical_coin_data((symbolz.toString().toUpperCase() + '-USD'), getDefaultStartDate(59), getDefaultEndDate(), '30m')) || [];
        //console.log(fetchCoinData[0])
        setWhichAPI(true);
        setCoin(fetchCoinData[0])
        setUsdValue(fetchCoinData.market_data.current_price.usd.toString());
      }catch (e){
        console.log(e)
        
      }
    }
    setWeDone(true);
    setLoading(false);
    // console.log(coin)
  };

  const setCoinDataFunc = () => {
    let data1;
    //console.log("Which API? " + whichAPI)
    try{
      if (!whichAPI) {
        if(coin){
          const {
            id,
            name,
            symbol,
            market_data: { market_cap_rank },
            market_data: {
              price_change_percentage_24h,
              total_volume,
              total_supply,
              max_supply,
              circulating_supply,
              fully_diluted_valuation
            },
            market_data: {
              current_price: { usd }
            },
            description: { en }
          } = coin;

          data1 = {
            id,
            name,
            symbol,
            market_cap_rank,
            price_change_percentage_24h,
            total_volume,
            total_supply,
            max_supply,
            circulating_supply,
            fully_diluted_valuation,
            usd,
            en,
          };
          setSmall(coin.image.small);
        }
      }else if(coin && whichAPI){
        //console.log(coin.total_volume)
        const {
          id,
          name,
          symbol,
          market_cap_rank,
          price_change_percentage_24h,
          total_volume,
          total_supply,
          max_supply,
          circulating_supply,
          fully_diluted_valuation,
          current_price: { usd },
          description: { en }
        } = coin;

        data1 = {
          id,
          name,
          symbol,
          market_cap_rank,
          price_change_percentage_24h,
          total_volume,
          total_supply,
          max_supply,
          circulating_supply,
          fully_diluted_valuation,
          usd,
          en,
        };
      }
      setCoinData(data1);
    }catch(e){
      console.log(e)
      setLoading(false)
      setCoinData(true)
      setCoin(false)
    }
  }



  useEffect(() => {
    setLoading(true);
    fetchCoinData();
    setLoading(false);
  }, []);

  useEffect(() => {
    if(weDone){
      setCoinDataFunc();
      //console.log(coinData)
    }
  }, [coin, weDone]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const transactions = await getTransactionsForBuysAndSellsPerCoinActualNumber(isLoggedIn, userID, coinID);
        setTransactions(transactions);
        //console.log("symbolz: " + symbolz)
        // const srmResults = await STOCH_RSI_MACD((symbolz.toString().toUpperCase() + '-USD'), getDefaultStartDate(59), getDefaultEndDate(), '30m')
        //const historical_data_results = await historical_data((symbolz.toString().toUpperCase() + '-USD'), getDefaultStartDate(59), getDefaultEndDate(), '30m')
        //console.log(historical_data_results)
        // setsrm(srmResults)
        //setHistoricalData(formatChartData(historical_data_results))
        setLoading(false);
      } catch (e) {
        console.log(e)
        setLoading(false);
      }
    };

    fetchData();

  }, [isLoggedIn, userID, coinID]);

  //console.log(transactions[0].transactions)
  if (loading || !coin) {
    return (
      <View style={styles.image}>
        <CoinDetailHeader
          coinID={coinID}
          image={'https://www.barnacleai.com/Images/Logo.png'}
          symbol={symbolz}
          marketCapRank={market_cap}
        />

        <CoinDetailNavigation asset={{coinID, symbolz, market_cap, CSD:0, CSH: 0, CIH: 1}}/>
        <ActivityIndicator size="large" />
      </View>
    )
  }
  // if (!loading && (!coin || !transactions || !srm)) {
  //   return (
  //     <ImageBackground source={bg} style={styles.image}>
  //       <CoinDetailHeader
  //         coinID={coinID}
  //         image={'https://www.barnacleai.com/Images/Logo.png'}
  //         symbol={symbolz}
  //         marketCapRank={market_cap}
  //       />
  //       <CoinDetailNavigation asset={{coinID, symbolz, market_cap, CSD:0, CSH: 0, CIH: 1}}/>
  //       <Text>No data at this time...</Text>
  //     </ImageBackground>
  //   )
  // }
  // const {
  //   id,
  //   image: { small },
  //   name,
  //   symbol,
  //   market_data: { market_cap_rank },
  //   market_data: { price_change_percentage_24h, total_volume, total_supply, max_supply,circulating_supply, fully_diluted_valuation },
  //   market_data: {
  //     current_price: { usd },
  //   },
  //   description:{
  //     en
  //   }
  // } = coin;

  const screenWidth = Dimensions.get("window").width;

  return (
    <ImageBackground source={bg} style={styles.image}>
      <CoinDetailHeader
        coinID={coinID}
        image={small ? small : logo}
        symbol={symbolz}
        marketCapRank={market_cap}
      />
      <CoinDetailNavigation asset={{coinID, symbolz, market_cap, CSD:0, CSH: 0, CIH: 1}}/>
      <GestureHandlerRootView style={{ zIndex: 998 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 130, paddingTop: 50 }}>
        {!loading ? (
          <>
          <Text style={[styles.name1, {marginBottom: 15}]}>Insights</Text>
          {/* <TransactionBarChart isLoggedIn={isLoggedIn} userId={userID} coinId={coinID} transactions={transactions} /> */}
          <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
          {transactions ? <TransactionPieChart isLoggedIn={isLoggedIn} userId={userID} coinId={coinID} transactions={transactions}/> : <ActivityIndicator size="large"  style={{marginRight: 30, width:screenWidth/2.5}}/>}
          {symbolz ? <SuperTrend isLoggedIn={isLoggedIn} userId={userID} coinId={symbolz} /> : <ActivityIndicator size="large" style={{marginRight: 30, width:screenWidth/2.5, alignSelf: 'flex-start'}}/>}
          
          </View>
          {/* <HoldingStatusPieChart isLoggedIn={isLoggedIn} userId={userID} coinId={coinID} transactions={transactions}/> */}
          {/* {HistoricalData && srm ? <AIChartComponent isLoggedIn={isLoggedIn} userId={userID} coinId={coinID} historical_data={HistoricalData} markers={srm}/> : <ActivityIndicator size="large" />} */}
          {/* {HistoricalData ? <SimpleChartComponent data={srm} /> : <ActivityIndicator size="large" />} */}
          {/* {console.log(srm)}*/}
          {/* <View>
          {srm ? (srm.length > 0 ? <ListOfSignals data={srm} image={small} /> : <Text style={{ color: 'white', fontSize: 18, marginTop: 40, alignSelf: 'center' }}>No Signals at the moment</Text> ): <ActivityIndicator size="large" />}
          </View> */}
          
          </>
          ) : (
            <View></View>
          )}

          
        </ScrollView>
      </GestureHandlerRootView>
    </ImageBackground>
  );
};

export default CoinInsightsScreen;
