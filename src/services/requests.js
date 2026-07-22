import axios from "axios";
import { groupTransactions, getDefaultEndDate, getDefaultStartDate } from "./dataManipulation";
import auth from '@react-native-firebase/auth';
import { Platform } from "react-native";

const API_KEY =
  "26NBDptIbsHOvWllkoPTv7YTAYQbn8GadTqbPNj3dO3WOpiOAnBV1jyCkkMV9Fx1";
const CLIENT_APP_ID = "data-bryqp";
const API_URL = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action`;
const username = 'BarnacleAIadmin';
const password = 'BAIDIN101339$#';

const getToken = async ()=> {
  const user = auth().currentUser;
      if (!user) throw new Error("User not authenticated");

  const idToken = await user.getIdToken(); // Get Firebase ID token
  return idToken;
}
// Encode username:password in Base64 using Expo Crypto
// const setCreds = async () =>{
// return encodedCredentials = await Crypto.digestStringAsync(
//   Crypto.CryptoDigestAlgorithm.SHA256,
//   `Basic ${username}:${password}`,
//   { encoding: Crypto.CryptoEncoding.BASE64 }
// );
// }

export const deleteUserData = async (userId, email, isLoggedIn) => {
  if(isLoggedIn){
    try {
      // Delete user from Firebase
      const user = auth().currentUser;
      const filter= { 
        $or: [
          { userID: userId }, // Check for userID
          { email: { $regex: `^${email.toLowerCase()}$`, $options: 'i' } } // Check for email in a case-insensitive manner
        ]
       }
      const response = await deleteMongoDBData('Users',filter)

      if(response > 0){
      if (user.uid === userId) {
        await user.delete();
      } else {
        await auth().deleteUser(userId);
      }

      // Delete user data from MongoDB
      // const response = await fetch(`${API_URL}/deleteOne`, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Api-Key': API_KEY,
      //   },
      //   body: JSON.stringify({
      //     dataSource: 'Cluster0', // Replace with your data source name
      //     database: 'BarnacleAI', // Replace with your database name
      //     collection: 'Users', // Replace with your collection name
      //     filter: { 
      //       $or: [
      //         { userID: userId }, // Check for userID
      //         { email: { $regex: `^${email.toLowerCase()}$`, $options: 'i' } } // Check for email in a case-insensitive manner
      //       ]
      //      }
      //   })
      // });
      
      console.log(`Deleted number lines ${response}`)
      console.log(`User data deleted successfully for user ${userId}`);
    }else{
      console.log(`User data not deleted for user ${userId}`);
    }
    } catch (error) {
      console.error(`Error deleting user data: ${error}`);
    }
  }
}

export const getDetailedCoinData = async (coinID) => {
  try {
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coinID}?localization=false&tickers=true&market_data=true&community_data=false&developer_data=false&sparkline=false`
    );
    return response.data;
  } catch (error) {
    console.log(error);
    return false;
  }
};

export const getCoinMarketChart = async (coinID, selectedRange) => {
  try {
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coinID}/market_chart?vs_currency=usd&days=${selectedRange}&interval=daily`
    );
    return response.data;
  } catch (error) {
    console.log(error);
  }
};

export const getCoinMarketChartHR = async (coinID, selectedRange) => {
  try {
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coinID}/market_chart?vs_currency=usd&days=${selectedRange}&interval=hourly`
    );
    return response.data;
  } catch (error) {
    console.log(error);
  }
};

export const getMarketData = async (pageNumber = 1) => {
  try {
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=${pageNumber}&sparkline=false&price_change_percentage=24h&locale=en`
    );
    return response.data;
  } catch (e) {
    console.log(e);
  }
};

export const getWatchlistedCoins = async (pageNumber = 1, coinIDs) => {
  try {
    if (!coinIDs) {
      return;
    }
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coinIDs}&order=market_cap_desc&per_page=50&page=${pageNumber}&sparkline=false&price_change_percentage=24h&locale=en`
    );

    return response.data;
  } catch (e) {
    console.log(e);
  }
};

export const getAllCoins = async () => {
  try {
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/coins/list?include_platform=false`
    );

    return response.data;
  } catch (e) {

    console.error(e);
    return false;
  }
};

//MongoDB APIs

export const getAllCoinsMongoDB = async (isLoggedIn) => {
  if (isLoggedIn) {
    const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/find`;

    const payload = {
      collection: "Top1000Data",
      database: "BarnacleAI",
      dataSource: "Cluster0",
      projection: { _id: 1, symbol: 1, name: 1, market_cap: 1 }, // Specify only the required fields
      sort: { market_cap: -1 }, // Sort by market_cap in descending order
      limit: 1000,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          apiKey: API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      return response.data.documents;
    } catch (e) {
      console.error("Error fetching all coins:", e);
      return [];
    }
  } else {
    console.error("User is not logged in.");
    return [];
  }
};

export const getMarketDataByCoinIDs = async (coinId) => {
  const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/aggregate`;
  coinId = coinId.split(",");

  const payload = {
    collection: "Top1000Data",
    database: "BarnacleAI",
    dataSource: "Cluster0",
    pipeline: [
      {
        $match: {
          _id: { $in: coinId },
        },
      },
    ],
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        apiKey: API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    return response.data.documents;
  } catch (e) {
    console.log(e);
    return false;
  }
};

export const postTransaction = async (data) => {
  const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/insertOne`;

  const payload = {
    collection: "Transactions",
    database: "BarnacleAI",
    dataSource: "Cluster0",
    document: data,
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        apiKey: API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    return response;
  } catch (e) {
    console.log(e);
  }
};

export const getTransactions = async (isLoggedIn, id) => {
  if (isLoggedIn) {
    const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/find`;

    const payload = {
      collection: "Transactions",
      database: "BarnacleAI",
      dataSource: "Cluster0",
      filter: { user_id: id },
      limit: 10000,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          apiKey: API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
      return response.data;
    } catch (e) {
      console.log(e);
    }
  } else {
    return "Something went wrong";
  }
};


export const editTransaction = async (transactionId, userId, updatedData) => {
  // const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/updateOne`;

  const payload = {
    collection: "Transactions",
    database: "BarnacleAI",
    dataSource: "Cluster0",
    filter: {
      _id: transactionId,
      user_id: userId,
    },
    update: {
      $set: updatedData,
    },
  };

  try {
    // const response = await axios.post(url, payload, {
    //   headers: {
    //     apiKey: API_KEY,
    //     "Content-Type": "application/json",
    //     Accept: "application/json",
    //   },
    // });
    const response = await updateMongoDBData("Transactions", { _id: transactionId, user_id: userId }, {$set: updatedData,}, true);
    // console.log(response)
    return response;
  } catch (e) {
    console.log(e);
    throw e; // Re-throw the error after logging it
  }
};


//This can be turned into one with the other one
export const getDataForAssetsInStorage = async (groupedAssets) => {
  const portfolioAssetsMarketData =
    (await getWatchlistedCoins(
      1,
      groupedAssets.map((portfolioAsset) => portfolioAsset.coinID).join(",")
    )) || undefined;

  if (portfolioAssetsMarketData === undefined) {
    console.log("running our api ;-)");
    const portfolioAssetsMarketDataOurAPI = await getMarketDataByCoinIDs(
      groupedAssets.map((portfolioAsset) => portfolioAsset.coinID).join(",")
    );

    const boughtAssets = groupedAssets.map((boughtAsset) => {
      const portfolioAsset = portfolioAssetsMarketDataOurAPI.filter(
        (item) => boughtAsset.coinID === item._id
      )[0];
      if (portfolioAsset) {
        return {
          ...boughtAsset,
          currentPrice: portfolioAsset.current_price,
          priceChangePercentage: portfolioAsset.price_change_percentage_24h,
        };
      } else {
        return {
          ...boughtAsset,
          currentPrice: 0.00001,
          priceChangePercentage: 0.00001,
        };
      }
    });

    return boughtAssets.sort(
      (item1, item2) =>
        item1.totalQuantityBought * item1.currentPrice <
        item2.totalQuantityBought * item2.currentPrice
    );
  } else {
    const boughtAssets = groupedAssets.map((boughtAsset) => {
      const portfolioAsset = portfolioAssetsMarketData.filter(
        (item) => boughtAsset.coinID === item.id
      )[0];
      return {
        ...boughtAsset,
        currentPrice: portfolioAsset.current_price,
        priceChangePercentage: portfolioAsset.price_change_percentage_24h,
      };
    });

    return boughtAssets.sort(
      (item1, item2) =>
        item1.totalQuantityBought * item1.currentPrice <
        item2.totalQuantityBought * item2.currentPrice
    );
  }
};

export const getTransactionsByCoinID = async (isLoggedIn, id, coinId, groupThem) => {
  if (isLoggedIn) {
    const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/find`;

    const payload = {
      collection: "Transactions",
      database: "BarnacleAI",
      dataSource: "Cluster0",
      filter: { user_id: id, coinID: coinId },
      limit: 10000,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          apiKey: API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
      if(groupThem){ 
        return groupTransactions(response.data.documents);
      }
      return (response.data.documents);
      
    } catch (e) {
      console.log(e);
    }
  } else {
    return "Something went wrong";
  }
};

export const getMarketDataFromMongoDB = async (pageNumber = 1) => {
  const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/aggregate`;

  // const payload = {
  //   collection: "Top1000Data",
  //   database: "BarnacleAI",
  //   dataSource: "Cluster0",
  //   pipeline: [
  //     {
  //       $sort: { market_cap: -1, _id: 1 },
  //     },
  //     // {
  //     //   $limit: 50,
  //     // },
  //     {
  //       $skip: 50 * (pageNumber - 1),
  //     },
  //     {
  //       $limit: 50,
  //     },
  //   ],
  // };

  try {
    const result = await getMongoDBData('Top1000Data', {}, { market_cap: -1, _id: 1 }, true);
    console.log(result)
    return result[0];
  } catch (e) {
    console.log(e);
  }
};

export const getAllMarketDataFromMongoDBNoPages = async () => {
  const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/aggregate`;

  const payload = {
    collection: "Top1000Data",
    database: "BarnacleAI",
    dataSource: "Cluster0",
    pipeline: [
      {
        $sort: { market_cap: -1, _id: 1 },
      },
    ],
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        apiKey: API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    return response.data.documents;
  } catch (e) {
    console.log(e);
  }
};

// Coin Insights
export const getTransactionsForBuysAndSellsPerCoinActualNumber = async (isLoggedIn, userId, coinId) => {
  if (isLoggedIn) {
    const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/aggregate`;

    const payload = {
      collection: "Transactions",
      database: "BarnacleAI",
      dataSource: "Cluster0",
      pipeline: [
        { $match: { user_id: userId, coinID: coinId } },
        {
          $group: {
            _id: "$transaction_type",
            totalQuantity: { $sum: "$quantityBought" },
            transactions: { $push: "$$ROOT" }
          }
        }
      ],
    };

    //console.log('Payload:', JSON.stringify(payload, null, 2));  // Log payload for debugging

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'api-key': API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      console.log('Response:', response.data);  // Log response for debugging

      return response.data.documents;

    } catch (e) {
      console.log('Error:', e);  // Log error for debugging
      return [];
    }
  } else {
    return "Something went wrong";
  }
};

const getStartOfDay = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
};

const getEndOfDay = () => {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now.toISOString();
};
export const getTransactionsForBuysAndSellsPerCoin = async (isLoggedIn, userId, coinId) => {
  if (isLoggedIn) {
    const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/aggregate`;

    const startOfToday = getStartOfDay();
    const endOfToday = getEndOfDay();

    const payload = {
      collection: "Transactions",
      database: "BarnacleAI",
      dataSource: "Cluster0",
      pipeline: [
        { 
          $match: { 
            user_id: userId, 
            coinID: coinId,
            timestamp: { $gte: startOfToday, $lte: endOfToday }
          }
        },
        {
          $group: {
            _id: "$transaction_type",
            totalQuantity: { $sum: "$quantityBought" },
          }
        }
      ],
    };

    console.log('Payload:', JSON.stringify(payload, null, 2));  // Log payload for debugging

    try {
      const response = await axios.post(url, payload, {
        headers: {
          'api-key': API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      console.log('Response:', response.data);  // Log response for debugging

      const transactions = response.data.documents;
      const totalQuantity = transactions.reduce((sum, t) => sum + t.totalQuantity, 0);

      const percentageData = transactions.map(t => ({
        type: t._id,
        percentage: (t.totalQuantity / totalQuantity) * 100,
      }));

      return percentageData;

    } catch (e) {
      console.log('Error:', e);  // Log error for debugging
      return [];
    }
  } else {
    return "Something went wrong";
  }
};

export const getRecentNewsMongoDB = async (isLoggedIn, hoursBack, limit) => {
  if (isLoggedIn) {
    // Calculate the date range
    const now = new Date();
    const pastDate = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000)); // Subtract hours in milliseconds

    // console.log('Now:', now); 
    // console.log('Past Date:', pastDate);

    // MongoDB API URL
    const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/find`;

    // Payload for the MongoDB API request
    const payload = {
      collection: 'News',
      database: 'BarnacleAI',
      dataSource: 'Cluster0',
      filter: {
        date_added: {
          $gt: {$date: pastDate},
          $lt: {$date: now},
        }
      },
      limit: limit // Adjust the limit as needed
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          apiKey: API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      // console.log('Response Status:', response.status);
      // console.log('Response Data:', response.data);

      return response.data.documents;
    } catch (error) {
      console.error('Error fetching recent news:', error);
      if (error.response) {
        console.error('Error Response Data:', error.response.data);
      }
      return [];
    }
  } else {
    return "Something went wrong";
  }
};


export const searchNewsByKeywords = async (isLoggedIn, keywords) => {
  if (isLoggedIn) {
    const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/find`;

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 2190 * 60 * 60 * 1000);

    // Build the $or array for the keywords
    const keywordConditions = keywords.map(keyword => ({
      title: { $regex: keyword, $options: 'i' },
      description: { $regex: keyword, $options: 'i' },
      keywords: { $regex: keyword, $options: 'i' }

    }));

    const payload = {
      collection: "News",
      database: "BarnacleAI",
      dataSource: "Cluster0",
      filter: {
        date_added: {
          $gt: {$date :twentyFourHoursAgo.toISOString()}
        },
        $and: keywordConditions
      },
      limit: 10000
    };

    console.log(keywords);

    try {
      const response = await axios.post(url, payload, {
        headers: {
          apiKey: API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      return response.data.documents;
    } catch (e) {
      console.error('Error fetching news:', e);
      return [];
    }
  } else {
    return "Something went wrong";
  }
};



// Calling TA-AI

//Stoch RSI MACD API  - trading strategy 1
export const STOCH_RSI_MACD = async (ticker='BTC-USD', start=getDefaultStartDate(59), end=getDefaultEndDate(), interval='30m') => {
  try {
    console.log(JSON.stringify({ ticker, start, end, interval }));
    const apiUrl = 'https://ta-ai.onrender.com/STOCH_RSI_MACD';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `Bearer ${await getToken()}`
      },
      body: JSON.stringify({ ticker, start, end, interval }),
    });

    const jsonData = await response.json();
    //const jsonData = await response;
    return jsonData; // Return fetched data
    
  } catch (error) {
    console.error('Error fetching data:', error);
    return null; // Return null in case of error
  }
};
// Historical data from yFiannce
export const historical_data = async (ticker='BTC-USD', start=getDefaultStartDate(59), end=getDefaultEndDate(), interval='30m', period=null) => {
  try {
    const apiUrl = 'https://ta-ai.onrender.com/historical_data';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `Bearer ${await getToken()}`
      },
      body: JSON.stringify({ ticker, start, end, interval, period }),
    });

    const jsonData = await response.json();
    // Check if the status is not 200 (success)
    if (response.status !== 200) {
      console.log(`Failed to fetch from main API, status: ${response.status}`);
      
      // Try fetching data from Binance API
      try {
        const apiUrlBinance = 'https://ta-ai.onrender.com/historical_data_binance';
        const responseBinance = await fetch(apiUrlBinance, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${await getToken()}`
          },
          body: JSON.stringify({ ticker, start, end, interval, period }),
        });

        const jsonDataBinance = await responseBinance.json();
        if (responseBinance.status !== 200) {
          console.log(`Failed to fetch from Binance API, status: ${responseBinance.status}`);

          // Try fetching data from MEXC API
          try {
            const apiUrlMexc = 'https://ta-ai.onrender.com/historical_data_mexc';
            const responseMexc = await fetch(apiUrlMexc, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                "Authorization": `Bearer ${await getToken()}`
              },
              body: JSON.stringify({ ticker, start, end, interval, period }),
            });

            const jsonDataMexc = await responseMexc.json();
            if (responseMexc.status !== 200) {
              console.log(`Failed to fetch from MEXC API, status: ${responseMexc.status}`);
              return null; // Return null if all APIs fail
            }
            return jsonDataMexc; // Return MEXC data
            
          } catch (error) {
            console.error('Error fetching MEXC data:', error);
            return null; // Return null if MEXC fetch fails
          }
        }
        return jsonDataBinance; // Return Binance data
        
      } catch (error) {
        console.error('Error fetching Binance data:', error);
        return null; // Return null if Binance fetch fails
      }
    }
    return jsonData; // Return main API data if successful
    
  } catch (error) {
    console.error('Error fetching data:', error);
    return null; // Return null in case of error
  }
};


//Historical data from yFiannce
export const historical_coin_data = async (ticker='BTC-USD', start=getDefaultStartDate(59), end=getDefaultEndDate(), interval='30m') => {
  try {
    console.log(JSON.stringify({ ticker, start, end, interval }));
    const apiUrl = 'https://ta-ai.onrender.com/historical_coin_data';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `Bearer ${await getToken()}`
      },
      body: JSON.stringify({ ticker, start, end, interval }),
    });

    const jsonData = await response;
    //const jsonData = await response;
    if(jsonData.status != '200'){
      try {
        const apiUrl = 'https://ta-ai.onrender.com/historical_coin_data_binance';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${await getToken()}`
          },
          body: JSON.stringify({ ticker, start, end, interval }),
        });
        console.log("Checking Binance")

        const jsonData = await response.json();
        console.log(jsonData)
        //const jsonData = await response;
        return jsonData; // Return fetched data
        
      } catch (error) {
        
        console.error('Error fetching binance data:', error);
        return null; // Return null in case of error
      }
    }
    return jsonData.json(); // Return fetched data
    
  } catch (error) {
    console.error('Error fetching data:', error);
      try {
        const apiUrl = 'https://ta-ai.onrender.com/historical_coin_data_binance';
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            "Authorization": `Bearer ${await getToken()}`
          },
          body: JSON.stringify({ ticker, start, end, interval }),
        });
        console.log("Checking Binance")

        const jsonData = await response.json();
        console.log(jsonData)
        //const jsonData = await response;
        return jsonData; // Return fetched data
        
      } catch (error) {
        
        console.error('Error fetching binance data:', error);
        return null; // Return null in case of error
      }
    }
};

//Get Stoch RSI MEXC
// Get Stoch RSI from MEXC
export const getStochRSI = async (symbol = 'BTCUSDT', interval = '4h') => {
  try {
    console.log(JSON.stringify({ symbol, interval }));
    const apiUrl = `https://ta-ai.onrender.com/stoch_rsi?symbol=${symbol}&interval=${interval}`;  // Replace with your actual API URL
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `Bearer ${await getToken()}`
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const jsonData = await response.json();
    return jsonData; // Return fetched data

  } catch (error) {
    console.error('Error fetching Stoch RSI data:', error);
    return null; // Return null in case of error
  }
};


// Get the super trend chart
export const fetchSuperTrend = async (coinId, interval = '90m', multiplier = '3', period = '7') => {
  try {
    const apiUrl = 'https://ta-ai.onrender.com/check_supertrend';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `Bearer ${await getToken()}`
      },
      body: JSON.stringify({
        coins: [coinId],
        interval,
        multiplier,
        period,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }

    const jsonData = await response.json();
    if (jsonData.length === 0) {
      throw new Error('No data available');
    }

    return jsonData; // Assuming you want to return the first object in the array
  } catch (error) {
    console.error('Error fetching data:', error);
    return null; // Return null in case of error
  }
};

//News from
// 'CoinDesk': 'https://www.coindesk.com/arc/outboundfeeds/rss/?_gl=1*1drc3x3*_up*MQ..*_ga*MTIxNjkxNDE1NC4xNzIwOTg1NzYx*_ga_VM3STRYVN8*MTcyMDk4NTc1OS4xLjAuMTcyMDk4NTc1OS4wLjAuNjM4MzEyNDQz',
// 'CoinTelegraph': 'https://cointelegraph.com/rss',
// 'Bitcoin Magazine': 'https://bitcoinmagazine.com/feed',
// 'CryptoSlate': 'https://cryptoslate.com/feed/',
// 'NewsBTC': 'https://www.newsbtc.com/feed/',
// 'CryptoNews': 'https://cryptonews.com/news/feed/'
export const getNews = async () => {
  console.log("Trying to get the news");

  const apiUrl = 'https://ta-ai.onrender.com/crypto-news';

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `Bearer ${await getToken()}`
      }
    });

    return response.data; // Return fetched data

  } catch (error) {
    console.error('Error fetching data:', error);
    return null; // Return null in case of error
  }
};

//Get most recent news
export const getRecentNews = async () => {
  console.log("Trying to get the news");

  const apiUrl = 'https://ta-ai.onrender.com/top-crypto-news';

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `Bearer ${await getToken()}`
      }
    });

    return response.data; // Return fetched data

  } catch (error) {
    console.error('Error fetching data:', error);
    return null; // Return null in case of error
  }
};

//Get news by keyword
export const getNewsByKeyword = async (ticker, name) => {
  console.log("Trying to get the news");

  const apiUrl = 'https://ta-ai.onrender.com/crypto-news-byticker-or-name';

  try {
    // Ensure ticker and name are strings
    const payload = {
      ticker: String(ticker).trim(),
      name: String(name).trim()
    };

    console.log("Payload:", payload);

    const response = await axios.post(apiUrl, payload, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Authorization": `Bearer ${await getToken()}`
      }
    });

    return response.data; // Return fetched data

  } catch (error) {
    console.error('Error fetching data:', error);
    return null; // Return null in case of error
  }
};




// get signals from mongoDB
// export const getSignals = async (isLoggedIn, id) => {
//   if (isLoggedIn) {
//     const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/find`;

//     const payload = {
//       collection: "Signals",
//       database: "BarnacleAI",
//       dataSource: "Cluster0",
//       limit: 20,
//       sort: { "timestamp": -1 } // Sort by timestamp in descending order
//     };

//     try {
//       const response = await axios.post(url, payload, {
//         headers: {
//           apiKey: API_KEY,
//           "Content-Type": "application/json",
//           Accept: "application/json",
//         },
//       });
//       return response.data;
//     } catch (e) {
//       console.log(e);
//     }
//   } else {
//     return "Something went wrong";
//   }
// };
export const getSignals = async (isLoggedIn, id) => {
  if (isLoggedIn) {
    try {
      const result = await getMongoDBData('Signals', {}, { "timestamp": -1 }, 50);
      return result;
    } catch (error) {
      console.error('Error getting signals:', error);
      throw error;
    }
  }
};

// export const checkIfUserExists = async (email, userID, isLoggedIn) => {
//   if(isLoggedIn){
//     try {
//       const response = await fetch(`${API_URL}/find`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//           'Api-Key': API_KEY,
//         },
//         body: JSON.stringify({
//           dataSource: 'Cluster0', // Replace with your data source name
//           database: 'BarnacleAI', // Replace with your database name
//           collection: 'Users', // Replace with your collection name
//           filter: { 
//             $or: [
//               { userID: userID }, // Check for userID
//               { email: email } // Check for email
//             ]
//            }
//         })
//       });

//       const result = await response.json();
      
//       console.log(result.documents.length)
//       if (result.documents.length > 0) {
//         console.log("true user")
//         return true; // User exists
//       } else {
//         console.log("false user")
//         return false; // User does not exist
//       }
//     } catch (error) {
//       console.error('Error checking user existence:', error);
//       throw error;
//     }
//   }
// };
export const checkIfUserExists = async (email, userID, isLoggedIn) => {
  if(isLoggedIn){
    try {
      console.log(email, userID)
      const result = await getMongoDBData('Users', { $or: [
        { userID: userID }, // Check for userID
        { email: email } // Check for email
      ] }, {"_id": -1}, true);
      
      // console.log(result)
      if (result.length > 0) {
        console.log("true user")
        return true; // User exists
      } else {
        console.log("false user")
        return false; // User does not exist
      }
    } catch (error) {
      console.error('Error checking user existence:', error);
      throw error;
    }
  }
};

const REVENUECAT_API_KEY = 'sk_IOXVmfxLjUMLXNVwLkDKYHqZSRYOu'; // Replace with your API key
const appUserId = '679c90e8'; // Replace with your project ID
const entitlementId = 'Premium';

export const grantPremiumEntitlement = async (userId) => {
  try {
    if(!userId){
      return;
    }
    // Calculate the expiration time (48 hours from now)
    const endTimeMs = Date.now() + 48 * 60 * 60 * 1000;

    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}/entitlements/${entitlementId}/promotional`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${REVENUECAT_API_KEY}`, 
      },
      body: JSON.stringify({ end_time_ms: endTimeMs }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Failed to grant entitlement: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    console.log("Entitlement granted successfully:", data);
    return data;
  } catch (error) {
    console.error("Error granting entitlement:", error.message);
    throw error;
  }
};

export const insertNewUser = async (email, userID, expoToken,isLoggedIn) => {
  if(isLoggedIn){
    try {
      const response = await fetch(`${API_URL}/insertOne`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Api-Key': API_KEY,
        },
        body: JSON.stringify({
          dataSource: 'Cluster0', // Replace with your data source name
          database: 'BarnacleAI', // Replace with your database name
          collection: 'Users', // Replace with your collection name
          document: {
            userID: userID,
            email: email,
            language: 'English',
            subscription: 'Free',
            darkMode: true,
            notificationToken: expoToken,
            notificationFlag:{signals:true,news:true,financials:true},
            remainingChats: 5
          }
        })
      });

      const result = await response.json();
      console.log('User inserted:', result);
      grantPremiumEntitlement(userID);
      return result;
    } catch (error) {
      console.error('Error inserting new user:', error);
      throw error;
    }
  }
};

export const updateNotificationToken = async (email, userID, newToken, isLoggedIn) => {
  if (isLoggedIn) {
    try {
      
      const result = await getUserInfo(email, userID, isLoggedIn);

      // Step 2: Check if the user exists
      if (result && result.length > 0) {
        const existingToken = result[0].notificationToken; // Assuming pushToken is the field storing the token

        // Step 3: Compare current token with new token
        if (existingToken !== newToken) {
          // Step 4: If token has changed, update it in the database
          const updatePayload = {
            dataSource: 'Cluster0',
            database: 'BarnacleAI',
            collection: 'Users',
            filter: { userID: userID },
            update: {
              $set: { notificationToken: newToken }, // Update the push token
            },
          };

          // Send update request
          // await axios.post(`${API_URL}/updateOne`, updatePayload, {
          //   headers: {
          //     apiKey: API_KEY,
          //     "Content-Type": "application/json",
          //     Accept: "application/json",
          //   },
          // });
          console.log(newToken)
          await updateMongoDBData("Users", { userID: userID }, {$set: { notificationToken: newToken },}, true);

          

          console.log("User's notification token has been updated.");
          return true; // Token updated successfully
        } else {
          console.log("Notification token is the same, no update needed.");
          return false; // Token is the same
        }
      } else {
        console.log("User does not exist.");
        return false; // User not found
      }
    } catch (error) {
      console.error('Error updating notification token:', error);
      throw error;
    }
  } else {
    console.log("User is not logged in.");
    return false; // User not logged in
  }
};

export const updateNotificationFlag = async (email, userID, flag, isLoggedIn) => {
  if (isLoggedIn) {
    try {
      
      const result = await getUserInfo(email, userID, isLoggedIn);

      // Step 2: Check if the user exists
      if (result && result.length > 0) {
        const existingFlags = result[0].notificationFlag || {};

        // Step 3: Update the specified flag
        const newFlags = {
          ...existingFlags,
          [flag]: !existingFlags[flag],
        };
        console.log(newFlags)
        // Step 4: Update the database
        const updatePayload = {
          dataSource: 'Cluster0',
          database: 'BarnacleAI',
          collection: 'Users',
          filter: { userID: userID },
          update: {
            $set: { notificationFlag: newFlags },
          },
        };

        // Send update request
        // await axios.post(`${API_URL}/updateOne`, updatePayload, {
        //   headers: {
        //     apiKey: API_KEY,
        //     "Content-Type": "application/json",
        //     Accept: "application/json",
        //   },
        // });
        await updateMongoDBData("Users", { userID: userID }, {$set: { notificationFlag: newFlags },}, true);

        console.log("User's notification flag has been updated.");
        return true; // Flag updated successfully
      } else {
        console.log("User does not exist.");
        return false; // User not found
      }
    } catch (error) {
      console.error('Error updating notification flag:', error);
      throw error;
    }
  } else {
    console.log("User is not logged in.");
    return false; // User not logged in
  }
};

export const updateSubscriptionStatus = async (email, userID, subscription, isLoggedIn) => {
  if (isLoggedIn) {
    try {
      
      const result = await getUserInfo(email, userID, isLoggedIn);

      // Step 2: Check if the user exists
      if (result && result.length > 0) {
        let existingToken = result[0].subscription; // Assuming pushToken is the field storing the token

        // Step 3: Compare current token with new token
        console.log(existingToken)
        console.log(subscription)
        if(existingToken.length == 0 ){
          existingToken = 'Free'
        }
        if (subscription && (existingToken == 'Free' || existingToken == undefined || existingToken == null)) {
          // Step 4: If token has changed, update it in the database
          const updatePayload = {
            dataSource: 'Cluster0',
            database: 'BarnacleAI',
            collection: 'Users',
            filter: { userID: userID },
            update: {
              $set: { subscription: subscription }, // Update the push token
            },
          };

          // Send update request
          // await axios.post(`${API_URL}/updateOne`, updatePayload, {
          //   headers: {
          //     apiKey: API_KEY,
          //     "Content-Type": "application/json",
          //     Accept: "application/json",
          //   },
          // });
          await updateMongoDBData("Users", { userID: userID }, {$set: { subscription: subscription }, }, true);


          console.log("User's subscription token has been updated. ADD");
          return true; // Token updated successfully
        } 
        else if (!subscription && (existingToken != 'Free' || existingToken != undefined || existingToken != null)) {
          // Step 4: If token has changed, update it in the database
          const updatePayload = {
            dataSource: 'Cluster0',
            database: 'BarnacleAI',
            collection: 'Users',
            filter: { userID: userID },
            update: {
              $set: { subscription: 'Free' }, // Update the push token
            },
          };

          // Send update request
          // await axios.post(`${API_URL}/updateOne`, updatePayload, {
          //   headers: {
          //     apiKey: API_KEY,
          //     "Content-Type": "application/json",
          //     Accept: "application/json",
          //   },
          // });

          await updateMongoDBData("Users", { userID: userID }, {$set: { subscription: 'Free' }, }, true);


          console.log("User's subscription token has been updated. REMOVE");
          return true; // Token updated successfully
        }
        else {
          console.log("subscription token is the same, no update needed.");
          return false; // Token is the same
        }
      } else {
        console.log("User does not exist.");
        return false; // User not found
      }
    } catch (error) {
      console.error('Error updating subscription token:', error);
      throw error;
    }
  } else {
    console.log("User is not logged in.");
    return false; // User not logged in
  }
};

export const getUserInfo = async (email, userID, isLoggedIn) => {
  if(isLoggedIn){
    try {
      const payload = { userID: userID }
      const result = await getMongoDBData('Users', payload, { _id: -1 }, true);

      if (result.length > 0) {
        return result; // User exists
      } else {
        return null; // User does not exist
      }
    } catch (error) {
      console.error('Error checking user existence:', error);
      throw error;
    }
  }
};

//Post sell strategy step
export const postSellStratStep = async (data) => {
  const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/insertOne`;

  const payload = {
    collection: "SellStrategy",
    database: "BarnacleAI",
    dataSource: "Cluster0",
    document: data,
  };

  try {
    const response = await axios.post(url, payload, {
      headers: {
        apiKey: API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    return response;
  } catch (e) {
    console.log(e);
  }
};

//Get sell strategy plan
export const getSellStrategyPerCoin = async (isLoggedIn, id, coinID) => {
  if (isLoggedIn) {
    const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/find`;

    const payload = {
      collection: "SellStrategy",
      database: "BarnacleAI",
      dataSource: "Cluster0",
      filter: { user_id: id, coinID: coinID },
      sort: { sellPrice: -1 },
      limit: 100,
    };

    try {
      const response = await axios.post(url, payload, {
        headers: {
          apiKey: API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (response.data && response.data.documents) {
        return response.data;
      } else {
        console.error("Response data is missing 'documents' property.");
        return { documents: [] };
      }
    } catch (e) {
      console.error("Error fetching data:", e);
      return { documents: [] };
    }
  } else {
    console.error("User is not logged in.");
    return { documents: [] };
  }
};

//Delete sell strategy step
export const deleteSellStrategyRecord = async (isLoggedIn, id, coinID, recordId) => {
  if (isLoggedIn && recordId) {
    const url = `https://us-east-1.aws.data.mongodb-api.com/app/${CLIENT_APP_ID}/endpoint/data/v1/action/deleteOne`;

    const payload = {
      collection: "SellStrategy",
      database: "BarnacleAI",
      dataSource: "Cluster0",
      filter: { _id: recordId, user_id: id, coinID: coinID },
    };


    try {
      // const response = await axios.post(url, payload, {
      //   headers: {
      //     apiKey: API_KEY,
      //     "Content-Type": "application/json",
      //     Accept: "application/json",
      //   },
      // });
      const response = await deleteMongoDBData('SellStrategy', { _id: recordId, user_id: id, coinID: coinID })

      if (response > 0) {
        console.log("Record deleted successfully.");
        return response;
      } else {
        console.error("Response data is missing.");
        return { success: false };
      }
    } catch (e) {
      console.error("Error deleting record:", e);
      return { success: false };
    }
  } else {
    console.error("User is not logged in.");
    return { success: false };
  }
};

//Fear & Greed index
export const getFearAndGreedIndex = async () => {
  try {
    const response = await axios.get('https://api.alternative.me/fng/');
    
    return response.data.data[0];
  } catch (error) {
    console.error('Error fetching Fear and Greed Index:', error);
    return null;
  }
};

// Get BTC Dominance and other data from Coin Paprika
export const getBtcDominance = async () => {
  try {
    const response = await fetch('https://api.coinpaprika.com/v1/global');
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    
    // Assuming the response contains a `btc_dominance` field
    const btcDominance = data;  // Adjust based on actual API response
    
    return btcDominance;
  } catch (error) {
    console.error('Error fetching BTC dominance:', error);
    throw error;
  }
};

//Get Watcher Guru and urgent alerts and urgent news
export const getRecentCoinWatcher = async (isLoggedIn, hoursBack, limit, future) => {
  if (!isLoggedIn) {
    return "Something went wrong";
  }

  // Calculate the date range
  const now = new Date();
  let pastDate = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000)); // Subtract hours
  let dateQuery = {
    $gte: pastDate,
    $lt: now,
  };

  if (future) {
    pastDate = new Date(now.getTime() + (hoursBack * 60 * 60 * 1000));
    dateQuery = {
      $gte: now,
      $lt: pastDate,
    };
  }

  // Build query and sort
  const query = { message_date: dateQuery };
  const sort = { message_date: -1 };

  try {
    const data = await getMongoDBData("UrgentNews", query, sort, limit);
    return data || [];
  } catch (error) {
    console.error("Error fetching recent news:", error);
    return [];
  }
};

//Get MyFXBook Data
export const getMyFXBookData = async (isLoggedIn, hoursBack, limit, future) => {
  if (!isLoggedIn) {
    return "Something went wrong";
  }

  const now = new Date();
  const past48 = new Date(now.getTime() - (48 * 60 * 60 * 1000));
  let pastDate = new Date(now.getTime() - (hoursBack * 60 * 60 * 1000));

  // Default: last N hours up to now
  let dateQuery = {
    $gte: pastDate,
    $lt: now,
  };

  // If "future" flag is set → upcoming events
  if (future) {
    pastDate = new Date(now.getTime() + (hoursBack * 60 * 60 * 1000));
    dateQuery = {
      $gte: past48,
      $lt: pastDate,
    };
  }

  const query = { date_time: dateQuery };
  const sort = { date_time: -1 };

  try {
    const data = await getMongoDBData("economicCalender", query, sort, limit);
    return data || [];
  } catch (error) {
    console.error("Error fetching MyFXBook data:", error);
    return [];
  }
};

// Fetch news sentiment data
export const fetchSentimentData = async () => {
  try {
    const response = await fetch("https://ta-ai.onrender.com/news_sentiment", {
      method: "GET", // Or POST, depending on your endpoint's method
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getToken()}`
    }}); // Replace with actual API URL
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching sentiment data:", error);
    return { positive: 0, negative: 0 }; // Default values in case of error
  }
};
// Fetch Open Interest Data
export const fetchOpenInterest = async (symbol = "BTCUSDT") => {
  try {
    const response = await fetch(`https://ta-ai.onrender.com/open_interest?symbol=${symbol}`, {
      method: "GET", // Or POST, depending on your endpoint's method
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getToken()}`
    }});
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching open interest data:", error);
    return { open_interest: 0, dynamic_threshold: 0 }; // Default values
  }
};

// Fetch Funding Rates Data
export const fetchFundingRates = async (symbol = "BTCUSDT") => {
  try {
    const response = await fetch(`https://ta-ai.onrender.com/funding_rates?symbol=${symbol}`, {
      method: "GET", // Or POST, depending on your endpoint's method
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getToken()}`
    }});
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching funding rates:", error);
    return { current_funding_rate: 0, avg_funding_rate: 0 }; // Default values
  }
};

// Fetch Order Book Depth Data
export const fetchOrderBookDepth = async (symbol = "BTCUSDT") => {
  try {
    const response = await fetch(`https://ta-ai.onrender.com/order_book_depth?symbol=${symbol}`, {
      method: "GET", // Or POST, depending on your endpoint's method
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getToken()}`
    }});
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching order book depth data:", error);
    return { sell_depth: 0, buy_depth: 0 }; // Default values
  }
};

export const handleNotificationTokenUpdate = (userInfo, expoPushToken, isLoggedIn, user, id) => {
  if (userInfo && expoPushToken) {
    if (isLoggedIn && user?.email && userInfo.notificationToken !== expoPushToken.data && userInfo.userID != null) {
      try {
        const info = updateNotificationToken(user?.email, id, expoPushToken?.data, isLoggedIn);
        console.log("Updated user info: ", info);
      } catch (error) {
        console.error("Error fetching user info:", error);
      }
    } else {
      console.log("No notification update needed");
    }
  }
};

export const handleSubscriptionStatusUpdate = (userInfo, purchaseInfo, isLoggedIn, user, id) => {
  if (userInfo) {
    let currentSub = userInfo.subscription || 'Free';

    if (isLoggedIn && user?.email) {
      if ((currentSub === 'Free' || !currentSub) && purchaseInfo && purchaseInfo.length > 0) {
        try {
          const info = updateSubscriptionStatus(user?.email, id, purchaseInfo, isLoggedIn);
          console.log("Updated user info add: ", info);
        } catch (error) {
          console.error("Error fetching user info:", error);
        }
      } else if (currentSub !== 'Free' && (!purchaseInfo || purchaseInfo.length === 0)) {
        try {
          const info = updateSubscriptionStatus(user?.email, id, purchaseInfo, isLoggedIn);
          console.log("Updated user info remove: ", info);
        } catch (error) {
          console.error("Error fetching user info:", error);
        }
      }
    }
  }
};

export const getMongoDBData = async (collection, query={}, sort={ _id: -1 }, limit) => {
  try {
    const apiUrl = 'https://ta-ai.onrender.com/mongo_query';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `Bearer ${await getToken()}`
      },
      body: JSON.stringify({ collection, query, sort, limit }),
    });

    if (!response.ok) {
      print(response);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const jsonData = await response.json();

    return jsonData; // Return fetched data
  } catch (error) {
    console.error(error);
    return null;
  }
};
export const insertMongoDBData = async (collection, data, isLoggedIn) => {
  if(isLoggedIn){
    try {
      const apiUrl = 'https://ta-ai.onrender.com/mongo_insert';
      // const apiUrl = 'http://127.0.0.1:5000/mongo_insert';

      if(data == null){
        return []; // Return empty array if document is null
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${await getToken()}`
        },
        body: JSON.stringify({ collection, data }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonData = await response.json();

      return jsonData; // Return inserted data
    } catch (error) {
      console.error(error);
      return null;
    }
  }
};
export const deleteMongoDBData = async (collection, query) => {
  try {
    const apiUrl = 'https://ta-ai.onrender.com/mongo_delete';
    // const apiUrl = 'http://127.0.0.1:5000/mongo_delete';
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        "Authorization": `Bearer ${await getToken()}`
      },
      body: JSON.stringify({ collection, query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const jsonData = await response.json();

    return jsonData; // Return deleted data
  } catch (error) {
    console.error(error);
    return null;
  }
};
export const updateMongoDBData = async (collection, query, data, isLoggedIn) => {
  if(isLoggedIn){
    try {
      const apiUrl = 'https://ta-ai.onrender.com/mongo_update';


      if(data == null || query == null){
        return []; // Return empty array if document or filter is null
      }
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": `Bearer ${await getToken()}`
        },
        body: JSON.stringify({ collection, query, data }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const jsonData = await response.json();

      return jsonData; // Return updated data
    } catch (error) {
      console.error(error);
      return null;
    }
  }
};