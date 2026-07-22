import React, { useContext, createContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const WatchlistContext = createContext();

export const useWatchlist = () => useContext(WatchlistContext);

const WatchlistProvider = ({ children }) => {
  const [watchlistCoinIDs, setWatchlistCoinIDs] = useState([]);

  const getWatchListData = async () => {
    try {
      // await AsyncStorage.removeItem("@wathclist_coins");
      // setWatchlistCoinIDs([]);
      const jsonValue = await AsyncStorage.getItem("@wathclist_coins");
      setWatchlistCoinIDs(jsonValue != null ? JSON.parse(jsonValue) : []);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    getWatchListData();
  }, []);

  const storeWatchlistCoinID = async (coinID) => {
    try {
      console.log(coinID);
      const newWatchList = [...watchlistCoinIDs, coinID];
      const jsonValue = JSON.stringify(newWatchList);
      print(jsonValue);
      await AsyncStorage.setItem("@wathclist_coins", jsonValue);
      setWatchlistCoinIDs(newWatchList);
    } catch (error) {
      console.log(error);
    }
  };

  const removeWatchListCoinID = async (coinID) => {
    const newWatchList = watchlistCoinIDs.filter(
      (coinIDValue) => coinIDValue !== coinID
    );
    const jsonValue = JSON.stringify(newWatchList);
    await AsyncStorage.setItem("@wathclist_coins", jsonValue);
    setWatchlistCoinIDs(newWatchList);
  };

  return (
    <WatchlistContext.Provider
      value={{ watchlistCoinIDs, storeWatchlistCoinID, removeWatchListCoinID }}
    >
      {children}
    </WatchlistContext.Provider>
  );
};

export default WatchlistProvider;
