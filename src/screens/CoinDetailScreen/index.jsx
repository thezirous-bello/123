import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Dimensions,
  TextInput,
  Animated,
  ActivityIndicator,
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
import CoinHoldingsScreen from "../CoinHoldingsScreen";
import CoinDetailNavigation from "../CoinDetailNavigation";
import {
  getDetailedCoinData,
  getCoinMarketChart,
  getTransactionsByCoinID,
  historical_coin_data,
  historical_data
} from "../../services/requests";
import auth from '@react-native-firebase/auth';

const filterDaysArray = [
  { filterDay: "1", filterText: "24h" },
  { filterDay: "7", filterText: "7d" },
  { filterDay: "30", filterText: "30d" },
  { filterDay: "365", filterText: "1y" },
  { filterDay: "max", filterText: "All" },
];

import { useNavigation } from "@react-navigation/native";
import jsonData from './../../jsons/TOP-100-coins.json';
import { getDefaultStartDate, getDefaultEndDate } from '../../services/dataManipulation'

function getDescriptionByTicker(ticker) {
  const coin = jsonData.tree.find(entry => entry.Ticker === ticker);
  return coin ? coin.description : "Ticker not found";
}

const CoinDetailScreen = () => {
  const navigation = useNavigation();
  //User login stuff
  const userID = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 

  //Binance Price stuff
  const [openPrice, setOpenPrice] = useState(null);
  const [closePrice, setClosePrice] = useState(null);
  const [highPrice, setHighPrice] = useState(null);
  const [lowPrice, setLowPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);
  const [priceChange24hr, setPriceChange24hr] = useState(null);
  const [prices , setPrices] = useState([]);

  //Coin Gecko tut stuff
  const [selectedRange, setSelectedRange] = useState("1");
  const [coin, setCoin] = useState(null);
  const [coinMarketdata, setCoinMarketdata] = useState(null);
  // const [assetOwned, setAssetOwned] = useState(null);
  const [whichAPI, setWhichAPI] = useState(false);
  const [weDone, setWeDone] = useState();
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(true);
  const [small, setSmall] = useState('https://www.barnacleai.com/Images/Logo.png');
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

  const [coinValue, setCoinValue] = useState(1);
  const [usdValue, setUsdValue] = useState("0");

  const fetchBinanceData = async () => {
    const tempSymbol = (symbolz.toUpperCase() + "USDT").toLowerCase();
    console.log(tempSymbol);
    const socket = new WebSocket(
      `wss://stream.binance.us:9443/stream?streams=${tempSymbol}@kline_1m`
    );
    console.log(
      `wss://stream.binance.us:9443/stream?streams=${tempSymbol}@kline_1m`
    );
    socket.onopen = () => {
      console.log("Connected to Binance WebSocket");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data && data.data && data.data.s === tempSymbol.toUpperCase()) {
        const klineData = data.data.k;
        const { o, c, h, l } = klineData; // open, close, high, low prices

        // Calculate price change percentage
        const changePercent =
          ((parseFloat(c) - parseFloat(o)) / parseFloat(o)) * 100;

        // Calculate 24-hour change percentage
        const change24hrPercent =
          ((parseFloat(c) - parseFloat(o)) / parseFloat(o)) * 100;

        setOpenPrice(parseFloat(o));
        setClosePrice(parseFloat(c));
        setHighPrice(h);
        setLowPrice(l);
        setPriceChange(changePercent.toFixed(2));
        setPriceChange24hr(change24hrPercent.toFixed(2));
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error.message);
    };

    return () => {
      console.log("closed");
      socket.close();
    };
  };

  const fetchCoinData = async () => {
    setLoading(true);

    try{
      
      setWhichAPI(false)
      const fetchCoinData = (await getDetailedCoinData(coinID)) || [];
      setUsdValue(fetchCoinData.market_data.current_price.usd.toString());
      setCoin(fetchCoinData);
      // console.log("Running theirs")

    }catch (e){

      // console.log(e + '\n time to run ours')
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

  const fetchMarketCoinData = async (selectedRangeValue) => {
    setChartLoading(true)
    try{
      console.log(selectedRangeValue)
      const fetchCoinMarketData = await getCoinMarketChart(coinID, selectedRangeValue);
      let tester = fetchCoinMarketData.prices;
      setCoinMarketdata(fetchCoinMarketData);
    }catch(e){
      // console.log(e + "\n time to use yfinance");
      try{
        // if(selectedRangeValue == 'max'){
        //   // console.log(fetchCoinMarketData);
        //   console.log('THis is the end')
        //   const fetchCoinMarketData =
        //   (await historical_data(ticker=symbolz.toString().toUpperCase() + '-USD'), start=getDefaultStartDate(300), end=getDefaultEndDate(), interval='1d') || [];
        //   let tester = fetchCoinMarketData.prices;
        //   console.log(fetchCoinMarketData)
        //   setCoinMarketdata(fetchCoinMarketData);
        // }else{
          // console.log('hi')
          let days = 1;
          let interval = '90m';
          let period = null;

          if(selectedRangeValue == 1){
            days = 1;
            interval = '90m'
          }else if(selectedRangeValue == 7){
            days = 7;
            interval = '1d'
          }else if(selectedRangeValue == 30){
            days = 30;
            interval = '1d'
          }else if(selectedRangeValue == 365){
            days = 365;
            interval = '1d';
          }else if(selectedRangeValue == 'max'){
            days = 1000;
            interval = '1wk';
            period = 'max'
          }

          // console.log(getDefaultStartDate(days) + '  ' + getDefaultEndDate())
          const fetchCoinMarketData =
          (await historical_data((symbolz.toString().toUpperCase() + '-USD'), getDefaultStartDate(days), getDefaultEndDate(), interval, period)) || [];
          let tester = fetchCoinMarketData.prices;
          // console.log(fetchCoinMarketData);
          setCoinMarketdata(fetchCoinMarketData);
        // }
      }catch(e){
        console.log(e)
      }
    }
    setChartLoading(false);
  };

  // const getAssetAmountOwned = async () => {
  //   setLoading(true);
  //   const results =
  //     (await getTransactionsByCoinID(isLoggedIn, userID, coinID, true)) || [];
  //   setAssetOwned(results[0]);
  //   // console.log("assetOwned");
  //   setLoading(false);
  // };

  const setCoinDataFunc = () => {
    let data1;
    // console.log("Which API? " + whichAPI)
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
        // console.log(coin.total_volume)
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
    console.log('THis is the coin ID: ' + coinID)
    fetchCoinData();
    fetchMarketCoinData(selectedRange);
    fetchBinanceData();
    // getAssetAmountOwned();
  }, []);

  useEffect(() => {
    if(weDone){
      setCoinDataFunc();
      //console.log(coinData)
    }
  }, [coin, weDone]);

  useEffect(() => {
    if(coinMarketdata?.prices){
      setPrices(coinMarketdata.prices);
    }
  }, [coinMarketdata, selectedRange])

  if (loading || (!coinData || coinData?.id == null) || !weDone || prices == null) {
    return <ActivityIndicator size="large" />;
  }
  if (!coin || coin?.id == null || !coinMarketdata || coinMarketdata?.prices == null || coinData?.id == null) {
    const market_cap_rank1 = 0; 
    return (
      <ImageBackground source={bg} style={styles.image}>
      <CoinDetailHeader
        coinID={coinID}
        image={null}
        symbol={symbolz}
        marketCapRank={market_cap_rank1}
      />
      <CoinDetailNavigation asset={{coinID, symbolz, market_cap_rank1, CSD:1, CSH: 0, CIH: 0}}/>
      <View style={{alignItems:"center", textAlign:'center', height: Dimensions.height}}>
        <Text style={{color: 'white'}}>Please retry in a couple minutes</Text>
        <Text style={{color: 'white'}}>Thank you!</Text>
      </View>
      
      </ImageBackground>
    );
  }

  // console.log("THE CULPRIT?? " + coin)

  // const { prices } = coinMarketdata;

  // const {
  //   id,
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


  // var {image: { small }} = coin;

  // if(!small){
  //   small = logo;
    
  // }

  const percentageColor =
    coinData.price_change_percentage_24h < 0 ? "#FF5555" : "#16c784" || "white";
  const caretupOrDown =
  coinData.price_change_percentage_24h < 0
      ? "caretdown"
      : "caretup" || "exclamationcircle";

  const screenWidth = Dimensions.get("window").width;

  // const data = [
  //   {
  //     timestamp: 1625945400000,
  //     value: 33575.25,
  //   },
  //   {
  //     timestamp: 1625946300000,
  //     value: 35545.25,
  //   },
  //   {
  //     timestamp: 1625947200000,
  //     value: 33510.25,
  //   },
  //   {
  //     timestamp: 1625948100000,
  //     value: 37215.25,
  //   },
  // ];
  
  const data = prices.map(([key, value]) => ({
    timestamp: key,
    value: value,
  }));

  //console.log(data)
  const data2 = [33575.25, 35545.25, 33510.25, 37215.25];

  //This returns all values
  const allPrices = prices.map(([firstValue]) => firstValue);

  // const priceList = [];
  // //console.log(allPrices.length);
  // if (allPrices.length > 29 && allPrices.length < 365) {
  //   const devider = 7;
  //   for (let i = 0; i < allPrices.length; i += devider) {
  //     if (i < allPrices.length) {
  //       priceList.push(allPrices[i]);
  //     }
  //   }
  // } else if (allPrices.length < 29 && allPrices.length > 5) {
  //   const devider = 2;
  //   for (let i = 0; i < allPrices.length; i += devider) {
  //     if (i < allPrices.length) {
  //       priceList.push(allPrices[i]);
  //     }
  //   }
  // } else if (allPrices.length <= 366) {
  //   const devider = 65;
  //   for (let i = 0; i < allPrices.length; i += devider) {
  //     if (i < allPrices.length) {
  //       priceList.push(allPrices[i]);
  //     }
  //   }
  // } else if (allPrices.length > 366) {
  //   const devider = 730;
  //   //console.log("devider" + devider);
  //   for (let i = 0; i < allPrices.length; i += devider) {
  //     if (i < allPrices.length) {
  //       priceList.push(allPrices[i]);
  //     }
  //   }
  // } else {
  //   priceList.push(...allPrices);
  // }
  const priceList = [];
  const maxLength = 6;

  // Check if the number of prices is greater than or equal to 6
  if (allPrices.length >= maxLength) {
    const step = Math.floor(allPrices.length / maxLength);

    for (let i = 0; i < allPrices.length; i += step) {
      if (priceList.length < maxLength) {
        priceList.push(allPrices[i]);
      } else {
        break;
      }
    }
  } else {
    // If there are less than 6 values in allPrices, just push them all
    priceList.push(...allPrices);
  }

  const changeCoinValue = (value) => {
    setCoinValue(value);
    const flotValue = parseFloat(value.replace(",", ".")) || 0;
    setUsdValue(parseFloat((flotValue * usd).toFixed(6)).toString());
  };
  const changeUSDValue = (value) => {
    setUsdValue(value);
    const flotValue = parseFloat(value.replace(",", ".")) || 0;
    setCoinValue(parseFloat((flotValue / usd).toFixed(6)).toString());
  };

  const countDecimals = (value) => {
    value = parseFloat(value);
    if (Math.floor(value) !== value)
      return value < 0.0000000001
        ? value.toString().split(".")[1].length || 0
        : 10;
    return 0;
  };
  const Formatterr = (value) => {
    value = parseFloat(value);
    if (value > 1) {
      return 2;
    }
    return countDecimals(value);
  };

  const onSelectedRangeChange = (selectedRangeValue) => {
    setSelectedRange(selectedRangeValue);
    fetchMarketCoinData(selectedRangeValue);
  };

  const market_cap_rank = coinData.market_cap_rank;

  return (
    <View style={styles.image}>
      <CoinDetailHeader
        coinID={coinID}
        image={small ? small : logo}
        symbol={symbolz}
        marketCapRank={coinData.market_cap_rank}
      />
      {/* <CoinDetailNavigation asset={{coinID, symbolz, market_cap_rank, CSD:1, CSH: 0, CIH: 0}}/> */}


      {/* <View style={styles.priceContainer}>
        <View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.currentPrice}>
            ${usd.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")}
          </Text>
        </View>
        <View
          style={[
            styles.PercentageContainer,
            { backgroundColor: percentageColor },
          ]}
        >
          <AntDesign
            name={caretupOrDown}
            size={12}
            color={"white"}
            style={{ alignSelf: "center", marginRight: 5 }}
          />
          <Text style={styles.priceChange}>
            {price_change_percentage_24h.toFixed(2)}%
          </Text>
        </View>
      </View> */}
      <GestureHandlerRootView style={{ zIndex: 998 }}>
        <ScrollView>
          {chartLoading ? <View style={{height: 300, justifyContent: 'center', alignContent: 'center'}}><ActivityIndicator size="large"/></View> : 
          <View>
            <LineChart.Provider data={data ? data : [{
      timestamp: 0o0,
      value: 0,
    }]}>
              <View style={styles.priceContainer}>
                <View>
                  <Text style={styles.name}>{coinData.name}</Text>
                  <Text style={styles.currentPrice}>
                    $
                    {closePrice != null
                      ? closePrice > 1
                        ? closePrice
                            .toFixed(2)
                            .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
                        : closePrice
                      : coinData.usd > 1
                      ? coinData.usd.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
                      : coinData.usd}
                  </Text>
                </View>
                <View
                  style={[
                    styles.PercentageContainer,
                    { backgroundColor: percentageColor },
                  ]}
                >
                  <AntDesign
                    name={caretupOrDown}
                    size={12}
                    color={"white"}
                    style={{ alignSelf: "center", marginRight: 5 }}
                  />
                  <Text style={styles.priceChange}>
                    {coinData.price_change_percentage_24h?.toFixed(2)}%
                  </Text>
                </View>
              </View>

              <LineChart height={250}>
                <LineChart.Path color={percentageColor}>
                  <LineChart.Gradient />
                  <LineChart.HorizontalLine at={{ index: 0 }} />
                </LineChart.Path>

                {/* <LineChart.Tooltip
                  at={coinMarketdata.prices.length - 1}
                  textStyle={{
                    borderRadius: 4,
                    color: "white",
                    fontSize: 12,
                    padding: 4,
                  }}
                  //xGutter={20}
                  //yGutter={-5}
                >
                  <LineChart.PriceText
                    precision={Formatterr(coinMarketdata.prices[0][1])}
                    variant="value"
                    index={coinMarketdata.prices.length}
                    style={{ color: "#fff", fontWeight: "700" }}
                  />
                </LineChart.Tooltip>
                <LineChart.Tooltip
                  at={0}
                  textStyle={{
                    borderRadius: 4,
                    color: "white",
                    fontSize: 12,
                    padding: 4,
                  }}
                  //xGutter={-10}
                >
                  <LineChart.PriceText
                    precision={Formatterr(coinMarketdata.prices[0][1])}
                    variant="value"
                    index={0}
                    style={{ color: "#fff", fontWeight: "700" }}
                  />
                </LineChart.Tooltip> */}
                <LineChart.Tooltip style={{ alignItems: "center" }}>
                  <LineChart.DatetimeText
                    style={{ color: "white", fontSize: 12, margin: 5 }}
                  />
                  <LineChart.PriceText
                    precision={Formatterr(coinMarketdata.prices[0][1])}
                    variant="value"
                    style={{ color: "white" }}
                  />
                </LineChart.Tooltip>
                <LineChart.CursorLine />
                <LineChart.CursorCrosshair color="white" />
              </LineChart>
            </LineChart.Provider>
          </View>}
          <View style={{ height: 30, zIndex: 997, width: "100%" }}>
            <XAxis
              style={{ marginHorizontal: 0 }}
              data={priceList}
              //formatLabel={(index) => priceList[index]}
              formatLabel={(value, index) => {
                // Convert UTC timestamp to datetime format
                const timestamp = new Date(priceList[index]); // Multiply by 1000 to convert from seconds to milliseconds

                let dateOptions;
                //console.log("selected range : " + selectedRange);
                if (selectedRange === "1") {
                  dateOptions = {
                    hour: "2-digit",
                    minute: "2-digit",
                  };
                } else if (selectedRange !== "365" && selectedRange !== "max") {
                  dateOptions = {
                    month: "numeric",
                    day: "numeric",
                  };
                } else if (selectedRange === "max") {
                  dateOptions = {
                    year: "numeric",
                  };
                } else {
                  dateOptions = {
                    day: "numeric",
                    month: "numeric",
                  };
                }
                return timestamp.toLocaleString("en-US", dateOptions);
              }}
              contentInset={{ left: 30, right: 30 }}
              svg={{
                fontSize: 12,
                fill: "white",
                textAnchor: "middle",
                //rotation: 20, // Rotate labels by 45 degrees
                origin: "middle", // Rotate around the middle of the text
              }}
            />
          </View>
          <View style={styles.filtersContainer}>
            {filterDaysArray.map((day) => (
              <FilterComponent
                filterDay={day.filterDay}
                filterText={day.filterText}
                selectedRange={selectedRange}
                setSelectedRange={onSelectedRangeChange}
                key={day.filterText}
              />
            ))}

            {/* <FilterComponent
                filterDay="7"
                filterText="7d"
                selectedRange={selectedRange}
                setSelectedRange={onSelectedRangeChange}
              />
              <FilterComponent
                filterDay="30"
                filterText="30d"
                selectedRange={selectedRange}
                setSelectedRange={onSelectedRangeChange}
              />
              <FilterComponent
                filterDay="365"
                filterText="1y"
                selectedRange={selectedRange}
                setSelectedRange={onSelectedRangeChange}
              />
              <FilterComponent
                filterDay="max"
                filterText="All"
                selectedRange={selectedRange}
                setSelectedRange={onSelectedRangeChange}
              /> */}
          </View>
          
          {/* {assetOwned ? (
            <Pressable
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignContent: "center",
                paddingHorizontal: 25,
                paddingVertical: 20,
              }}
              onPress={() => navigation.navigate("CoinDetailScreen", {
                coinID: coinID,
                symbolz: symbolz,
                market_cap: market_cap_rank,
            })}
            >
              <Text style={styles.name}>Balance</Text>
              <View style={{ alignSelf: "center" }}>
                <Text style={styles.name}>
                  $
                  {closePrice != null
                    ? closePrice > 1
                      ? (closePrice * (assetOwned.totalQuantityBought + assetOwned.totalQuantitySold))
                          .toFixed(2)
                          .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
                      : closePrice * (assetOwned.totalQuantityBought + assetOwned.totalQuantitySold)
                    : coinData.usd > 1
                    ? (coinData.usd * (assetOwned.totalQuantityBought + assetOwned.totalQuantitySold))
                        .toFixed(2)
                        .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
                    : coinData.usd * (assetOwned.totalQuantityBought + assetOwned.totalQuantitySold)}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: "#ff94f7", fontFamily: "Poppins_700Bold" }}>
                    {symbolz.toUpperCase()}
                  </Text>
                  <Text style={{ color: "#ff94f7" }}>
                    {(assetOwned.totalQuantityBought + assetOwned.totalQuantitySold).toFixed(3)}
                  </Text>
                </View>
              </View>
            </Pressable>
          ) : (
            <View></View>
          )} */}

          <View style={{padding: 25, borderWidth: 1, borderColor: '#FF07C9', marginHorizontal: 15, borderRadius: 15, marginTop: 25}}>
            <Text style={{color: "white", fontSize: 20, marginBottom: 15}}>Stats</Text>
            <View
              style={{
                paddingTop: 5,
                paddingBottom: 15,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: "white", fontFamily: "Poppins_700Bold" }}>
                Market Cap:{" "}
              </Text>
              <Text style={{ color: "white", fontFamily: "Poppins_700Bold" }}>
                {/* ${market_cap > 0 ? market_cap.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : (circulating_supply * closePrice).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} */}
                 ${(coinData.circulating_supply * closePrice).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              </Text>
            </View>
            <View
              style={{
                paddingTop: 5,
                paddingBottom: 15,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: "white", fontFamily: "Poppins_700Bold" }}>
                Fully Diluted Market Cap:{" "}
              </Text>
              <Text style={{ color: "white", fontFamily: "Poppins_700Bold" }}>
                ${!whichAPI ? coinData.fully_diluted_valuation.usd.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : coinData.fully_diluted_valuation.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              </Text>
            </View>

            <View
              style={{
                paddingTop: 5,
                paddingBottom: 15,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: "white", fontFamily: "Poppins_700Bold" }}>
                Circulating Supply:{" "}
              </Text>
              <Text style={{ color: "white", fontFamily: "Poppins_700Bold" }}>
                ${coinData.circulating_supply.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              </Text>
            </View>

            <View
              style={{
                paddingTop: 5,
                paddingBottom: 15,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: "white", fontFamily: "Poppins_700Bold" }}>
                Total Supply:{" "}
              </Text>
              <Text style={{ color: "white", fontFamily: "Poppins_700Bold" }}>
                {coinData.total_supply.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              </Text>
            </View>

            <View
              style={{
                paddingTop: 5,
                paddingBottom: 15,
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: "white", fontFamily: "Poppins_700Bold" }}>
                Volume (24h):{" "}
              </Text>
              <Text style={{ color: "white", fontFamily: "Poppins_700Bold" }}>
                ${!whichAPI ? coinData.total_volume.usd.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : coinData.total_volume.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
              </Text>
            </View>
          </View>

          {/* { usdValue && usdValue != 0 && coinValue && coinValue != 0 ? 
          <View
            style={{
              paddingHorizontal: 25,
              paddingVertical: 20,
              marginBottom: 30,
              marginTop: 30,
              borderWidth: 1, borderColor: '#FF07C9', marginHorizontal: 15, borderRadius: 15
            }}
          >
            <Text style={styles.name}>Converter</Text>
            <View style={{ flexDirection: "row", justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: "column", flex: 1, marginRight: 25 }}>
                
                <TextInput
                  style={styles.input}
                  value={coinValue.toString()}
                  keyboardType="numeric"
                  onChangeText={changeCoinValue}
                  
                />
                <View style={{height: 2, backgroundColor: 'white', width: '100%'}}></View>
                <TextInput
                  style={styles.input}
                  value={parseFloat(usdValue).toFixed(2)
                    .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,").toString()}
                  keyboardType="numeric"
                  onChangeText={changeUSDValue}
                />
              </View>

              <View style={{ flexDirection: "column", flex: 1}}>
                <Text style={{ color: "white", alignSelf: "flex-end", fontSize: 20, paddingVertical: 5 }}>
                    {symbolz.toUpperCase()}
                </Text>
                <View style={{height: 2, backgroundColor: 'white', width: '100%'}}></View>
                <Text style={{ color: "white", alignSelf: "flex-end", fontSize: 20, paddingVertical: 5 }}>USD</Text>
                
              </View>
            </View>
          </View>

          : <Text>{"\n"}</Text>} */}

          <Text>{"\n"}</Text>
          <View style={{ paddingHorizontal: 25, paddingVertical: 5, marginBottom: 200 }}>
            <Text style={styles.name}>About {coinData.name}</Text>
            
            {coinData.en ? <Text numberOfLines={20} style={{ color: "white" }}>{coinData.en}</Text> : 
            <Text numberOfLines={20} style={{ color: "white" }}>{getDescriptionByTicker(coinData.symbol.toUpperCase())}</Text>
            }
          </View>          
        </ScrollView>
      </GestureHandlerRootView>
    </View>
  );
};

export default CoinDetailScreen;
