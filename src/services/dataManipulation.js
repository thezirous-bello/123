export const groupTransactions = (transactions) => {
  const groupedTransactions = transactions.reduce((result, transaction) => {
    const key = transaction.coinID;

    if (!result[key]) {
      result[key] = {
        coinID: transaction.coinID,
        image: transaction.image,
        name: transaction.name,
        ticker: transaction.ticker,
        totalQuantityBought: 0,
        totalSpent: 0,
        totalQuantitySold: 0,
        totalSold: 0,
        averagePriceBought: 0,
        averagePriceSold: 0,
      };
    }
    if(transaction.transaction_type == 'buy'){
      result[key].totalQuantityBought += transaction.quantityBought;
      result[key].totalSpent +=
      transaction.priceBought * transaction.quantityBought;
      // Calculate average bought price
      result[key].averagePriceBought =
      result[key].totalSpent / result[key].totalQuantityBought;
    }
    if(transaction.transaction_type == 'sell'){
      result[key].totalQuantitySold += transaction.quantityBought;
      result[key].totalSold +=
      transaction.priceBought * transaction.quantityBought;
      // Calculate average sold price
      result[key].averagePriceSold =
      result[key].totalSold / result[key].totalQuantitySold;
    }
    

    

    return result;
  }, {});

  // Convert the grouped transactions object back to an array
  const groupedArray = Object.values(groupedTransactions);
  return groupedArray;
};

  //calculate P/L NEW
export const calculateAllTimeChange = (transactions) => {
    const allTimeChange = transactions.reduce(
      (total, { totalQuantityBought, currentPrice, totalSpent }) =>
        total + totalQuantityBought * currentPrice - totalSpent ,
      0
    );

    return allTimeChange.toFixed(2);
  };
export const sortTransactionsByTimestamp = (transactions) => {
    return transactions.sort((a, b) => {
      const timestampA = new Date(a.timestamp).getTime();
      const timestampB = new Date(b.timestamp).getTime();
      return timestampB - timestampA;
    });
  }

// Function to get default start date (today - 90 days)
export const getDefaultStartDate = (start) => {
  const today = new Date();
  const startDate = new Date(today.getTime() - (start * 24 * 60 * 60 * 1000));
  return startDate.toISOString().slice(0, 10); // Format to YYYY-MM-DD
};

// Function to get default end date (today's date)
export const getDefaultEndDate = () => {
  const today = new Date();
  return today.toISOString().slice(0, 10); // Format to YYYY-MM-DD
};

export const formatChartData = (data) => {
  return data.map(item => {
    // Check if 'Close' property exists in the item and it's not undefined
    if (item && item['Close'] !== undefined) {
        // Extracting date and value from each object
        const timestamp = new Date(item.date).getTime(); // Convert date string to timestamp
        const value = item['Close']; // Assuming 'Close' is the value you want to chart
        return [timestamp, value]; // Return as [timestamp, value] array
    } else {
        return null; // Return null if 'Close' property is not found or undefined
    }
}).filter(item => item !== null); // Filter out null values
}

export const formatNumber = (number) => {
  if (number >= 1e12) {
    return `${(number / 1e12).toFixed(2)} T`; // Trillions
  } else if (number >= 1e9) {
    return `${(number / 1e9).toFixed(2)} B`; // Billions
  } else if (number >= 1e6) {
    return `${(number / 1e6).toFixed(2)} M`; // Millions
  } else {
    return `${number}`; // Less than a million
  }
};