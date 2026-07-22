import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Dimensions,
  Image,
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
import CoinDetailNavigation from "../CoinDetailNavigation";

import {
  getDetailedCoinData,
  getCoinMarketChart,
  getTransactionsByCoinID,
  getDataForAssetsInStorage,
  historical_coin_data,
  getSellStrategyPerCoin
} from "../../services/requests";
import auth from '@react-native-firebase/auth';
import {calculateAllTimeChange, groupTransactions, sortTransactionsByTimestamp, getDefaultStartDate, getDefaultEndDate} from '../../services/dataManipulation'
const filterDaysArray = [
  { filterDay: "1", filterText: "24h" },
  { filterDay: "7", filterText: "7d" },
  { filterDay: "30", filterText: "30d" },
  { filterDay: "365", filterText: "1y" },
  { filterDay: "max", filterText: "All" },
];

import { useNavigation } from "@react-navigation/native";

const CoinHoldingsScreen = () => {
  const navigation = useNavigation();
  //User login stuff
  const userID = auth().currentUser.uid;
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 

  //Binance Price stuff
  const [openPrice, setOpenPrice] = useState(null);
  const [closePrice, setClosePrice] = useState(null);
  const [highPrice, setHighPrice] = useState(null);
  const [lowPrice, setLowPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);
  const [priceChange24hr, setPriceChange24hr] = useState(null);
  const [groupedAssetsWithPrices, setGroupedAssetsWithPrices] = useState([]);

  //Coin Gecko tut stuff
  const [selectedRange, setSelectedRange] = useState("1");
  const [coin, setCoin] = useState(null);
  const [coinMarketdata, setCoinMarketdata] = useState(null);
  const [assetOwned, setAssetOwned] = useState(null);
  const [assetOwnedTransactions, setAssetOwnedTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [whichAPI, setWhichAPI] = useState(false);
  const [weDone, setWeDone] = useState();
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
  const [totalSum, setTotalSum] = useState(0);
  const [sellStratQty, setSellStratQty] = useState(0);

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
      //("Running theirs")

    }catch (e){

      //console.log(e + '\n time to run ours')
      try{
        
        const fetchCoinData = (await historical_coin_data((symbolz.toString().toUpperCase() + '-USD'), getDefaultStartDate(59), getDefaultEndDate(), '30m')) || [];
        setWhichAPI(true);
        setCoin(fetchCoinData[0])
        setUsdValue(fetchCoinData.market_data.current_price.usd.toString());
      }catch (e){
        console.log(e)
        
      }
    }
    setWeDone(true);
    setLoading(false);
  };

  const setCoinDataFunc = () => {
    let data1;

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

  const fetchMarketCoinData = async (selectedRangeValue) => {
    const fetchCoinMarketData =
      (await getCoinMarketChart(coinID, selectedRangeValue)) || [];
    setCoinMarketdata(fetchCoinMarketData);
  };

  const getPriceDataForAssetsInStorage = async () => {
    const results = await getDataForAssetsInStorage([coinID]);
    setGroupedAssetsWithPrices(results);
    
    //console.log(groupedAssetsWithPrices);
  };

  const getAssetAmountOwned = async () => {
    setLoading(true);

    const results =
      (await getTransactionsByCoinID(isLoggedIn, userID, coinID, true)) || [];
    //console.log(results)
    setAssetOwned(results[0]);
    setLoading(false);
  };

  const getTransactionsByCoinID_ = async () => {
    setLoading(true);
    const results =
      (await getTransactionsByCoinID(isLoggedIn, userID, coinID, false)) || [];
    //console.log(results)
    setAssetOwnedTransactions(results);
    setLoading(false);
  };

  const getAssets = async () => {
    try {
      const getAllTransactions = await getSellStrategyPerCoin(isLoggedIn, id, coinID);
      const data = getAllTransactions.documents;
      
      const totalSumAmount = data.reduce((sum, item) => sum + (item.sellPrice * item.qty), 0);
      setTotalSum(totalSumAmount);

      const totalqty = data.reduce((sum, item) => sum + (item.qty), 0);
      setSellStratQty(totalqty);
    } catch (error) {
      console.error("Error fetching assets:", error);
    }
  };

  useEffect(() => {
    //console.log("Step 1")
    setLoading(true);
    fetchCoinData();
    // fetchMarketCoinData(selectedRange);
    console.log("Coin ids"+coinID)
    getAssetAmountOwned();
    getTransactionsByCoinID_();
    getPriceDataForAssetsInStorage();
    getAssets();
    fetchBinanceData();
    setLoading(false);
  }, []);

  useEffect(() => {
    if(weDone){
      setCoinDataFunc();
      //console.log(coinData)
    }
  }, [coin, weDone]);

  
  if (loading || (!coinData || coinData?.id == null) || !weDone) {
    return <ActivityIndicator size="large" />;
  }
  if (!coin || coin?.id == null || coinData?.id == null) {
    const market_cap_rank1 = 0; 
    return (
      <ImageBackground source={bg} style={styles.image}>
      <CoinDetailHeader
        coinID={coinID}
        image={small ? small : logo}
        symbol={symbolz}
        marketCapRank={market_cap}
      />
      <CoinDetailNavigation asset={{coinID, symbolz, market_cap, CSD:0, CSH: 1, CIH: 0}}/>
      <View style={{alignItems:"center", textAlign:'center', height: Dimensions.height}}>
        <Text style={{color: 'white'}}>Please retry in a couple minutes</Text>
        <Text style={{color: 'white'}}>Thank you!</Text>
      </View>
      
      </ImageBackground>
    );
  }

  //console.log(coin)

  // const { prices } = coinMarketdata;

  const percentageColor =
  coinData.price_change_percentage_24h < 0 ? "#FF07C9" : "#16c784" || "white";
  const caretupOrDown =
  coinData.price_change_percentage_24h < 0
      ? "caretdown"
      : "caretup" || "exclamationcircle";

  const screenWidth = Dimensions.get("window").width;

  /*const data = [
    {
      timestamp: 1625945400000,
      value: 33575.25,
    },
    {
      timestamp: 1625946300000,
      value: 35545.25,
    },
    {
      timestamp: 1625947200000,
      value: 33510.25,
    },
    {
      timestamp: 1625948100000,
      value: 37215.25,
    },
  ];*/

  // const data = prices.map(([key, value]) => ({
  //   timestamp: key,
  //   value: value,
  // }));

  // //This returns all values
  // const allPrices = prices.map(([firstValue]) => firstValue);
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

  const changeCoinValue = (value) => {
    setCoinValue(value);
    const flotValue = parseFloat(value.replace(",", ".")) || 0;
    setUsdValue(parseFloat((flotValue * coinData.usd).toFixed(6)).toString());
  };
  const changeUSDValue = (value) => {
    setUsdValue(value);
    const flotValue = parseFloat(value.replace(",", ".")) || 0;
    setCoinValue(parseFloat((flotValue / coinData.usd).toFixed(6)).toString());
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
    <ImageBackground source={bg} style={styles.image}>
      <CoinDetailHeader
        coinID={coinID}
        image={small ? small : logo}
        symbol={symbolz}
        marketCapRank={market_cap}
      />
      <CoinDetailNavigation asset={{coinID, symbolz, market_cap_rank, CSD:0, CSH: 1, CIH: 0}}/>
      <GestureHandlerRootView style={{ zIndex: 998 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 130 }}>
        {assetOwned ? (
          <>
          <View style={{display:'flex', flexDirection: 'row', justifyContent: 'space-between'}}>
          <Pressable
              style={{
                flexDirection: "column",
                justifyContent: "space-between",
                alignContent: "center",
                paddingHorizontal: 25,
                paddingVertical: 20,
              }}
              //onPress={() => navigation.navigate("CoinHoldingsScreen")}
            >
              <Text style={styles.name}>Balance</Text>
              <View style={{ alignSelf: "left" }}>
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
                  <Text style={{ color: "#ff94f7", fontFamily: "Poppins_700Bold"  }}>
                    {symbolz.toUpperCase()}
                  </Text>
                  <Text style={{ color: "#ff94f7" }}>
                    {(assetOwned.totalQuantityBought + assetOwned.totalQuantitySold).toFixed(3)}
                  </Text>
                </View>
              </View>
            </Pressable>
            {totalSum > 0 ? (
            <Pressable
              style={{
                flexDirection: "column",
                justifyContent: "space-between",
                alignContent: "center",
                paddingHorizontal: 25,
                paddingVertical: 20,
              }}
              onPress={() => navigation.navigate("SellStratScreen", {
                averagePriceBought: assetOwned.averagePriceBought,
                coinID: coinID, symbolz: symbolz
            })}
            >
              <Text style={styles.name}>Sell Strategy</Text>
              <View style={{ alignSelf: "left" }}>
                <Text style={styles.name}>
                  $
                  {totalSum > 1 ? totalSum.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,") : totalSum.toFixed(12).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: "#ff94f7", fontFamily: "Poppins_700Bold"  }}>
                    {symbolz.toUpperCase()}
                  </Text>
                  <Text style={{ color: "#ff94f7" }}>
                    {sellStratQty.toFixed(3)}
                  </Text>
                </View>
              </View>
            </Pressable>) :
            (
              <Pressable
              style={{
                flexDirection: "column",
                justifyContent: "space-between",
                alignContent: "center",
                paddingHorizontal: 25,
                paddingVertical: 20,
              }}
              onPress={() => navigation.navigate("SellStratScreen", {
                averagePriceBought: assetOwned.averagePriceBought,
                coinID: coinID, symbolz: symbolz
            })}
            >
              <Text style={styles.name2}>Create Sell Strategy</Text>
            </Pressable>
            )
            }
            </View>
          <Text style={styles.name1}>Holdings</Text>
          <View style={{display: 'flex', justifyContent: 'space-between', flexDirection: 'row', padding: 25, borderWidth: 1, borderColor: '#FF07C9', marginHorizontal: 15, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.4)'}}>
            <View>
              <View>
                <Text style={styles.title2}>Portfolio %</Text>
                <Text style={styles.title3}>22.8%</Text>
              </View>
              <View>
                <Text style={styles.title2}>AVG Buy</Text>
                <Text style={styles.title3}>${assetOwned.averagePriceBought ? assetOwned.averagePriceBought.toFixed(2)
                          .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,") : 0}</Text>
              </View>
              <View>
                <Text style={styles.title2}>Total Worth</Text>
                <Text style={styles.title3}>${closePrice != null
                    ? closePrice > 1
                      ? (closePrice * (assetOwned.totalQuantityBought + assetOwned.totalQuantitySold))
                          .toFixed(2)
                          .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
                      : closePrice * (assetOwned.totalQuantityBought + assetOwned.totalQuantitySold)
                    : coinData.usd > 1
                    ? (coinData.usd * (assetOwned.totalQuantityBought + assetOwned.totalQuantitySold))
                        .toFixed(2)
                        .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
                    : coinData.usd * (assetOwned.totalQuantityBought + assetOwned.totalQuantitySold)}</Text>
              </View>
            </View>
            <View>
              <View>
                  <Text style={styles.title2}>Total {symbolz}</Text>
                  <Text style={styles.title3}>{assetOwned.totalQuantityBought ? (assetOwned.totalQuantityBought + assetOwned.totalQuantitySold) : 0}</Text>
                </View>
                <View>
                  <Text style={styles.title2}>AVG Sell</Text>
                  <Text style={styles.title3}>${ assetOwned.averagePriceSold ? assetOwned.averagePriceSold.toFixed(2)
                          .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,") : 0}</Text>
                </View>
                <View>
                  <Text style={styles.title2}>All time P/L</Text>
                  {/* <Text style={styles.title3}>${calculateAllTimeChange(groupedAssetsWithPrices)}</Text> */}
                </View>
            </View>
          </View>
          <View style={{marginTop: 25}}></View>
          <Text style={styles.name1}>Transactions</Text>
          <View style={{ borderTopWidth: 1, borderTopColor: '#FF07C9', marginHorizontal: 15, paddingTop: 15}}>
            {
              //console.log("Blah blah ba" + assetOwned)
              sortTransactionsByTimestamp(assetOwnedTransactions).map((transaction, index) => (
                      <View key={index} style={styles.transactionItem}>
                        <Text style={{ color: "white", marginLeft: 15, fontWeight: 600 }}>
                          {transaction.timestamp}
                        </Text>

                        <Pressable
                          style={styles.transcoinContainer}
                          onPress={() =>
                            navigation.navigate("CoinTransactionScreen", {
                              _id: transaction._id,
                              coinID: transaction.coinID,
                              symbolz: transaction.ticker
                            })
                          }
                        >
                          <View
                            style={{
                              flex: 1,
                              flexDirection: "row",
                              justifyContent: "space-between",
                            }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignSelf: "flex-start",
                                alignItems: "center",
                              }}
                            >
                              <Image
                                source={{ uri: transaction.image }}
                                height={30}
                                width={30}
                                style={{ marginRight: 10, alignSelf: "center" }}
                              />
                              <Text style={{ color: "white", fontWeight: 700 }}>
                                {transaction.transaction_type.toUpperCase()}
                              </Text>
                            </View>
                            <View>
                              <View
                                style={{ flexDirection: "row", justifyContent: "space-between" }}
                              >
                                <Text
                                  style={{ color: "white", fontWeight: 700, marginRight: 10 }}
                                >
                                  {transaction.quantityBought}
                                </Text>
                                <Text style={{ color: "white", fontWeight: 700 }}>
                                  {transaction.ticker.toUpperCase()}
                                </Text>
                              </View>
                              <Text style={{ color: "white" }}>
                                {transaction.priceBought}
                              </Text>
                            </View>
                          </View>
                        </Pressable>
                      </View>
                    ))
            }
          </View>



            </>
          ) : (
            <View><Text>You do not own this asset!</Text></View>
          )}

          
        </ScrollView>
      </GestureHandlerRootView>
    </ImageBackground>
  );
};

export default CoinHoldingsScreen;
