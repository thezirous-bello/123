import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Dimensions,
  TextInput,
  Animated,
  ActivityIndicator,
  Pressable,
} from "react-native";
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

import {
  getDetailedCoinData,
  getCoinMarketChart,
  getTransactionsByCoinID,
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

  //Coin Gecko tut stuff
  const [selectedRange, setSelectedRange] = useState("1");
  const [coin, setCoin] = useState(null);
  const [coinMarketdata, setCoinMarketdata] = useState(null);
  const [assetOwned, setAssetOwned] = useState(null);
  const [loading, setLoading] = useState(false);
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
    const fetchCoinData = (await getDetailedCoinData(coinID)) || [];

    setCoin(fetchCoinData);
    setUsdValue(fetchCoinData.market_data.current_price.usd.toString());
    setLoading(false);
    //console.log(coin)
  };

  const fetchMarketCoinData = async (selectedRangeValue) => {
    const fetchCoinMarketData =
      (await getCoinMarketChart(coinID, selectedRangeValue)) || [];
    setCoinMarketdata(fetchCoinMarketData);
  };

  const getAssetAmountOwned = async () => {
    setLoading(true);
    const results =
      (await getTransactionsByCoinID(isLoggedIn, userID, coinID)) || [];
    setAssetOwned(results[0]);
    console.log("assetOwned");
    setLoading(false);
  };

  useEffect(() => {
    fetchCoinData();
    fetchMarketCoinData(selectedRange);
    fetchBinanceData();
    getAssetAmountOwned();
  }, []);

  if (loading || !coin || !coinMarketdata) {
    return <ActivityIndicator size="large" />;
  }

  const { prices } = coinMarketdata;

  const {
    id,
    image: { small },
    name,
    symbol,
    market_data: { market_cap_rank },
    market_data: { price_change_percentage_24h },
    market_data: {
      current_price: { usd },
    },
  } = coin;

  const percentageColor =
    price_change_percentage_24h < 0 ? "#8930D5" : "#16c784" || "white";
  const caretupOrDown =
    price_change_percentage_24h < 0
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

  const data = prices.map(([key, value]) => ({
    timestamp: key,
    value: value,
  }));

  //console.log(data)
  const data2 = [33575.25, 35545.25, 33510.25, 37215.25];

  //This returns all values
  const allPrices = prices.map(([firstValue]) => firstValue);
  const priceList = [];
  //console.log(allPrices.length);
  if (allPrices.length > 29 && allPrices.length < 365) {
    const devider = 7;
    for (let i = 0; i < allPrices.length; i += devider) {
      if (i < allPrices.length) {
        priceList.push(allPrices[i]);
      }
    }
  } else if (allPrices.length < 29 && allPrices.length > 5) {
    const devider = 2;
    for (let i = 0; i < allPrices.length; i += devider) {
      if (i < allPrices.length) {
        priceList.push(allPrices[i]);
      }
    }
  } else if (allPrices.length <= 366) {
    const devider = 65;
    for (let i = 0; i < allPrices.length; i += devider) {
      if (i < allPrices.length) {
        priceList.push(allPrices[i]);
      }
    }
  } else if (allPrices.length > 366) {
    const devider = 730;
    //console.log("devider" + devider);
    for (let i = 0; i < allPrices.length; i += devider) {
      if (i < allPrices.length) {
        priceList.push(allPrices[i]);
      }
    }
  } else {
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

  return (
    <View
      style={{
        paddingVertical: 15,
        paddingHorizontal: 5,
        backgroundColor: "#222222",
      }}
    >
      <CoinDetailHeader
        coinID={id}
        image={small}
        symbol={symbol}
        marketCapRank={market_cap_rank}
      />

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
          <View>
            <LineChart.Provider data={data}>
              <View style={styles.priceContainer}>
                <View>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.currentPrice}>
                    $
                    {closePrice != null
                      ? closePrice > 1
                        ? closePrice
                            .toFixed(2)
                            .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
                        : closePrice
                      : usd > 1
                      ? usd.toFixed(2).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
                      : usd}
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
                    {price_change_percentage_24h?.toFixed(2)}%
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
          </View>
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

          {assetOwned ? (
            <Pressable
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignContent: "center",
                paddingHorizontal: 25,
                paddingVertical: 20,
              }}
              onPress={() => navigation.navigate("CoinHoldingsScreen")}
            >
              <Text style={styles.name}>Balance</Text>
              <View style={{ alignSelf: "center" }}>
                <Text style={styles.name}>
                  $
                  {closePrice != null
                    ? closePrice > 1
                      ? (closePrice * assetOwned.totalQuantityBought)
                          .toFixed(2)
                          .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
                      : closePrice * assetOwned.totalQuantityBought
                    : usd > 1
                    ? (usd * assetOwned.totalQuantityBought)
                        .toFixed(2)
                        .replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
                    : usd * assetOwned.totalQuantityBought}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: "#ff94f7", fontWeight: "bold" }}>
                    {symbol.toUpperCase()}
                  </Text>
                  <Text style={{ color: "#ff94f7" }}>
                    {assetOwned.totalQuantityBought.toFixed(3)}
                  </Text>
                </View>
              </View>
            </Pressable>
          ) : (
            <View></View>
          )}

          <View
            style={{
              paddingHorizontal: 25,
              paddingTop: 5,
              paddingBottom: 15,
              flexDirection: "row",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ color: "white", fontWeight: "bold" }}>
              Market Cap:{" "}
            </Text>
            <Text style={{ color: "white", fontWeight: "bold" }}>
              ${market_cap.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
            </Text>
          </View>
          <View style={{ paddingHorizontal: 25, paddingVertical: 5 }}>
            <Text style={styles.name}>About</Text>
            <Text style={{ color: "white" }}>
              Bitcoin (BTC) is a cryptocurrency launched in January 2009, where
              the first genesis block was mined on 9th January 2009. It is a
              decentralized digital currency that is based on cryptography. As
              such, it can operate without the need of a central authority like
              a central bank or a company. It is unlike government-issued or
              fiat currencies such as US Dollars or Euro in which they are
              controlled by the country’s central bank. ....
            </Text>
          </View>

          <View
            style={{
              paddingHorizontal: 25,
              paddingVertical: 5,
              marginBottom: 30,
            }}
          >
            <Text style={styles.name}>Calculate USD to BTC:</Text>
            <View style={{ flexDirection: "row" }}>
              <View style={{ flexDirection: "row", flex: 1 }}>
                <Text style={{ color: "white", alignSelf: "center" }}>
                  {symbol.toUpperCase()}
                </Text>
                <TextInput
                  style={styles.input}
                  value={coinValue.toString()}
                  keyboardType="numeric"
                  onChangeText={changeCoinValue}
                />
              </View>

              <View style={{ flexDirection: "row", flex: 1 }}>
                <Text style={{ color: "white", alignSelf: "center" }}>USD</Text>
                <TextInput
                  style={styles.input}
                  value={usdValue.toString()}
                  keyboardType="numeric"
                  onChangeText={changeUSDValue}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </GestureHandlerRootView>
    </View>
  );
};

export default CoinDetailScreen;
