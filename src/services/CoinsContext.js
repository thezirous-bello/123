import React, { createContext, useState, useContext } from "react";

const CoinsContext = createContext();

export const CoinsProvider = ({ children }) => {
  const [coinsList, setCoinsList] = useState([]);

  return (
    <CoinsContext.Provider value={{ coinsList, setCoinsList }}>
      {children}
    </CoinsContext.Provider>
  );
};

export const useCoins = () => useContext(CoinsContext);