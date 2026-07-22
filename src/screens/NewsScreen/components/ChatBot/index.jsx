// import React, { useState } from "react";
// import { View, FlatList,ImageBackground, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal } from "react-native";
// import axios from "axios";
// import bg from "../../../../imgs/bgimg.png";
// import { Ionicons, FontAwesome5} from "@expo/vector-icons";
// import { useNavigation } from "@react-navigation/native";


// const cryptoOptions = [
//   "Bitcoin", "Ethereum", "Tether", "Binance Coin", "USD Coin", "XRP", "Cardano", "Dogecoin", "Polkadot", "Binance USD", 
//   "Uniswap", "Bitcoin Cash", "Litecoin", "Chainlink", "Avalanche", "Stellar", "Terra", "Ethereum Classic", "VeChain", 
//   "Theta", "Algorand", "Shiba Inu", "Cosmos", "Filecoin", "TRON", "Hedera", "Elrond", "Fantom", "Aave", "Monero", 
//   "Tezos", "Flow", "EOS", "OKB", "IOTA", "Near Protocol", "Quant", "Zcash", "Stacks", "Celo", "Lido DAO", 
//   "Kusama", "Internet Computer", "SushiSwap", "Helium", "Curve DAO Token", "Chiliz", "Maker", "Zilliqa", "Yearn.Finance", 
//   "Decentraland", "Enjin Coin", "Paxos Standard", "Basic Attention Token"
// ];
// const signalOptions = ["BTC/USD", "ETH/USD", "SOL/USD"];

// export default function ChatScreen() {
//   const [messages, setMessages] = useState([]);
//   const [selectedCrypto, setSelectedCrypto] = useState(null);
//   const [selectedSignal, setSelectedSignal] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [dropdownType, setDropdownType] = useState(null);
//   const [isDropdownVisible, setDropdownVisible] = useState(false);
//   const navigation = useNavigation();

//   const sendMessage = async (query, type) => {
//     setLoading(true);

//     // Add the user's message first
//     const userMessage = { id: Date.now(), text: query, sender: "user" };
//     setMessages((prev) => [userMessage, ...prev]);

//     try {
//       // Make the API call to get the bot's response
//       const response = await axios.post("http://127.0.0.1:8000/chat", {
//         query,
//         type, // "news" or "analysis"
//       }, { headers: { "Content-Type": "application/json" } });

//       // Add the bot's response after the user's message
//       const botMessage = { id: Date.now() + 1, text: response.data.response.content || "No content", sender: "bot" };
//       setMessages((prev) => [botMessage, ...prev]);
//     } catch (error) {
//       setMessages((prev) => [...prev, { id: Date.now() + 1, text: "Error fetching response", sender: "bot" }]);
//     }

//     setLoading(false);
//   };

//   return (
//     <ImageBackground source={bg} style={{ padding: 30, flex: 1, paddingTop: 55}}>
//        <View style={styles.headerContainer}>
//             <Ionicons
//                 name="chevron-back-sharp"
//                 size={29}
//                 color="white"
//                 style={{position: 'absolute', left: 0, zIndex: 999}}
//                 onPress={() => navigation.goBack()}
//             />
//             <Text
//                 style={{
//                 color: "white",
//                 fontSize: 25,
//                 letterSpacing: 1,
//                 paddingHorizontal: 20,
//                 fontFamily: "Poppins_700Bold",
//                 textAlign: 'center'
//                 }}
//             >
//                 Barnacle Chat Beta
//             </Text>
//       </View>
//     <View style={styles.container}>
//       {/* Chat Messages */}
//       <FlatList
//         data={messages}
//         keyExtractor={(item) => item.id.toString()}
//         renderItem={({ item }) => (
//           <View style={[styles.messageBubble, item.sender === "user" ? styles.userBubble : styles.botBubble]}>
//             <Text style={styles.messageText}>{item.text}</Text>
//           </View>
//         )}
//         inverted
//       />

//       {/* Crypto News Dropdown */}
//       {/* <View style={styles.selectorContainer}>
//         <TouchableOpacity style={styles.dropdownButton} onPress={() => { setDropdownType("crypto"); setDropdownVisible(true); }}>
//           <Text style={styles.dropdownButtonText}>{selectedCrypto || "Select Crypto"}</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={styles.actionButton}
//           onPress={() => selectedCrypto && sendMessage(`What's new on ${selectedCrypto}?`, "news")}
//         >
//           <Text style={styles.buttonText}>Latest News</Text>
//         </TouchableOpacity>
//       </View> */}
//         {loading && <ActivityIndicator size="large" color="#007bff" style={{ marginTop: 10 }} />}
//       <View style={{display: 'flex', flexDirection: 'row', backgroundColor: '#98188d', paddingHorizontal: 17, paddingVertical: 13, borderRadius: 25, alignItems: 'center'}}>

//           <Text style={[styles.buttonText, {fontSize: 16}]}>Latest news on </Text>
//         <TouchableOpacity style={{backgroundColor: "rgba(0,0,0,0.3)", padding: 5, borderRadius: 5, margin: 3}} onPress={() => { setDropdownType("crypto"); setDropdownVisible(true); }}>
//           <Text style={{fontWeight: 'bold', color: '#fff'}}>{selectedCrypto || "Select Crypto"}</Text>
//         </TouchableOpacity>
//         <Text style={[styles.buttonText, {fontSize: 16}]}>?</Text>
//         <TouchableOpacity
//           onPress={() => selectedCrypto && sendMessage(`What's new on ${selectedCrypto}?`, "news")}
//           style={{position: 'absolute', right: 25}}
//         >
//           <FontAwesome5 name="location-arrow" size={24} color="white" />
//         </TouchableOpacity>
//       </View>

//       {/* Signal Analysis Dropdown */}
//       {/* <View style={styles.selectorContainer}>
//         <TouchableOpacity style={styles.dropdownButton} onPress={() => { setDropdownType("signal"); setDropdownVisible(true); }}>
//           <Text style={styles.dropdownButtonText}>{selectedSignal || "Select Signal"}</Text>
//         </TouchableOpacity>
//         <TouchableOpacity
//           style={styles.actionButton}
//           onPress={() => selectedSignal && sendMessage(`What's the analysis on ${selectedSignal}?`, "analysis")}
//         >
//           <Text style={styles.buttonText}>Get Analysis</Text>
//         </TouchableOpacity>
//       </View> */}

//       {/* Custom Dropdown Modal */}
//       <Modal transparent={true} visible={isDropdownVisible} animationType="fade">
//         <View style={styles.modalOverlay}>
//           <View style={styles.modalContainer}>
//             {(dropdownType === "crypto" ? cryptoOptions : signalOptions).map((item) => (
//               <TouchableOpacity
//                 key={item}
//                 style={styles.modalItem}
//                 onPress={() => {
//                   dropdownType === "crypto" ? setSelectedCrypto(item) : setSelectedSignal(item);
//                   setDropdownVisible(false);
//                 }}
//               >
//                 <Text style={styles.modalText}>{item}</Text>
//               </TouchableOpacity>
//             ))}
//           </View>
//         </View>
//       </Modal>
//     </View>

//     </ImageBackground>
//   );
// }

// // === STYLES ===
// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     padding: 10,
//   },
//   messageBubble: {
//     maxWidth: "75%",
//     padding: 10,
//     marginBottom: 10,
//     borderRadius: 10,
//   },
//   userBubble: {
//     alignSelf: "flex-end",
//     backgroundColor: "#FF07C9",
//   },
//   botBubble: {
//     alignSelf: "flex-start",
//     backgroundColor: 'rgba(0,0,0,0.3)'
//   },
//   messageText: {
//     color: "white",
//   },
//   selectorContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     backgroundColor: "#98188d",
//     paddingHorizontal: 15,
//     paddingVertical: 10,
//     borderRadius: 25,
//     marginVertical: 5,
//   },
//   dropdownButton: {
//     flex: 1,
//     backgroundColor: "rgba(0,0,0,0.3)",
//     padding: 10,
//     borderRadius: 5,
//     marginRight: 10,
//   },
//   dropdownButtonText: {
//     textAlign: "center",
//     fontWeight: "bold",
//     color: "#fff"
//   },
//   actionButton: {
//     backgroundColor: "#FF07C9",
//     padding: 10,
//     borderRadius: 5,
//   },
//   buttonText: {
//     color: "white",
//     fontWeight: "bold",
//   },
//   modalOverlay: {
//     flex: 1,
//     backgroundColor: "rgba(0,0,0,0.5)",
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   modalContainer: {
//     backgroundColor: "#fff",
//     padding: 20,
//     borderRadius: 10,
//     width: "80%",
//   },
//   modalItem: {
//     padding: 10,
//     borderBottomWidth: 1,
//     borderBottomColor: "#ddd",
//   },
//   modalText: {
//     fontSize: 16,
//     textAlign: "center",
//   },
// });
import React, { useEffect, useState } from "react";
import { View, FlatList, ImageBackground, Image, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, ScrollView } from "react-native";
import axios from "axios";
import { encode } from "base-64";
import bg from "../../../../imgs/bgimg.png";
import { Ionicons, FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import auth from '@react-native-firebase/auth';

const getToken = async ()=> {
  const user = auth().currentUser;
      if (!user) throw new Error("User not authenticated");

  const idToken = await user.getIdToken(); // Get Firebase ID token
  return idToken;
}

const cryptoOptions = ['XRPUSDT', 'ETHUSDT', 'BTCUSDT', 'SOLUSDT', 'DOGEUSDT', 'SUIUSDT', 'PEPEUSDT', 'FUNUSDT', 'TRXUSDT', 'EPAYUSDT', 'USDCUSDT', 'ADAUSDT', 'HBARUSDT', 'FDUSDUSDT', 'MLNUSDT', 'WIFUSDT', 'VINEUSDT', 'AVAXUSDT', 'BERAUSDT', 'LTCUSDT', 'LINKUSDT', 'TONUSDT', 'MXUSDT', 'MNTUSDT', 'ENAUSDT', 'HBDUSDT', 'VIDTUSDT', 'KASUSDT', 'MEWUSDT', 'TRUMPUSDT', 'BNBUSDT', 'PIUSDT', 'CAKEUSDT', 'AAVEUSDT', 'NEARUSDT', 'APTUSDT', 'ETHFIUSDT', 'POPCATUSDT', 'PAXGUSDT', 'WLDUSDT', 'ABUSDT', 'GHSTUSDT', 'PNUTUSDT', 'AGIUSDT', 'WBTCUSDT', 'TAOUSDT', 'ARBUSDT', 'MKRUSDT', 'VRUSDT', 'ARKMUSDT', 'RAREUSDT', 'VANRYUSDT', 'RUNEUSDT', 'RADUSDT', 'NEOUSDT', 'PARTIUSDT', 'WMTXUSDT', 'FETUSDT', 'ARUSDT', 'NILUSDT', 'VETUSDT', 'FISHWUSDT', 'MOVEUSDT', 'REDUSDT', 'EOSUSDT', 'WINGUSDT', 'ZETAUSDT', 'ONDOUSDT', 'MOODENGUSDT', 'RAYUSDT', 'SHIBUSDT', 'AMPUSDT', 'PENGUUSDT', 'AIXBTUSDT', 'COREUSDT', 'ATOMUSDT', 'ICPUSDT', 'FARTCOINUSDT', 'TUTUSDT', 'ZROUSDT', 'POLUSDT', 'XLMUSDT', 'OPUSDT', 'OGUSDT', 'KILOUSDT', 'XMRUSDT', 'GHIBLIUSDT', 'HMSTRUSDT', 'CRVUSDT', 'RSRUSDT', 'JASMYUSDT', 'XUSDT', 'BANUSDT', 'SATSUSDT', 'XTERUSDT', 'NOTUSDT', 'FLOKIUSDT', 'TIAUSDT', 'INJUSDT', 'SPELLUSDT', 'ROAMUSDT', 'BEAMXUSDT', 'BONKUSDT', 'ULTIMAUSDT', 'GALAUSDT', 'THEUSDT', 'ZENUSDT', 'CFXUSDT', 'YFIUSDT', 'BANANAUSDT', 'BCHUSDT', 'MUBARAKUSDT', 'SAGAUSDT', 'FLOCKUSDT', 'KAITOUSDT', 'SOSOUSDT', 'API3USDT', 'ORDIUSDT', 'BOMEUSDT', 'STEPNUSDT', 'FTTUSDT', 'AIGOUSDT', 'ANIMEUSDT', 'SEIUSDT', 'PENDLEUSDT', 'DOTUSDT', 'HIVEUSDT', 'IOTAUSDT', 'ALGOUSDT', 'SANTOSUSDT', 'BBUSDT', 'AUCTIONUSDT', 'STPTUSDT', 'CROUSDT', 'ZENTUSDT', 'PYTHUSDT', 'WUSDT', 'PLUMEUSDT', 'ORCAUSDT', 'SCRUSDT', 'PHBUSDT', 'APEUSDT', 'SHELLUSDT', 'ACTUSDT', 'ENJUSDT', 'BIOUSDT', 'ENSUSDT', 'DOGSUSDT', 'FILUSDT', 'XVSUSDT', 'IOUSDT', 'BRISEUSDT', 'COTIUSDT', 'ACHUSDT', 'MAVIAUSDT', 'SNXUSDT', 'SUPRAUSDT', 'CETUSUSDT', 'REZUSDT', 'SKLUSDT', 'UNIUSDT', 'ZKUSDT', 'STETHUSDT', 'CHCUSDT', 'SCCUSDT', 'DEXEUSDT', 'ONEUSDT', 'SUSDT', 'XAIUSDT', 'GRASSUSDT', 'QUICKUSDT', 'KMNOUSDT', 'MANTAUSDT', 'AEVOUSDT', 'CKBUSDT', 'ETCUSDT', 'TURBOUSDT', 'FIDAUSDT', 'EGLDUSDT', 'SUSHIUSDT', 'VANAUSDT', 'MORPHOUSDT', 'A47USDT', 'DHNUSDT', 'NMTUSDT', 'LDOUSDT', 'ULTIUSDT', 'XTZUSDT', 'ZRCUSDT', 'SAFEUSDT', 'GOMININGUSDT', 'BANANAS31USDT', 'MEMEUSDT', 'SANDUSDT', 'JUPUSDT', 'ACXUSDT', 'STRKUSDT', 'UMAUSDT', 'LRCUSDT', 'DASHUSDT', 'STXUSDT', 'HIPPOUSDT', 'SUNUSDT', 'ALTLAYERUSDT', 'HIGHUSDT', 'JUSDT', 'CHZUSDT', 'MANAUSDT', 'RENDERUSDT', 'ASTRUSDT', 'HFTUSDT', 'LOKAUSDT', 'BROCCOLIF3BUSDT', 'CPKUSDT', 'PYRUSDT', 'ANKRUSDT', 'C98USDT', 'AXSUSDT', 'PROPSUSDT', 'DFUSDT', 'KDAUSDT', 'FARMUSDT', 'XIONUSDT', 'BELUSDT', 'NPCUSDT', 'SOLVUSDT', 'IOSTUSDT', 'AITECHUSDT', 'ZNDUSDT', 'WXTUSDT', 'NAKAUSDT', 'EIGENUSDT', 'IOTXUSDT', 'MEDXUSDT', 'KAIAUSDT', 'VELODROMEUSDT', 'IMXUSDT', 'MBLUSDT', 'GRTUSDT', 'BSWUSDT', 'NULSUSDT', 'DIAMUSDT', 'HOTUSDT', 'MG8USDT', 'COOKIEUSDT', 'GOATSUSDT', 'NSUSDT', 'MUBARAKAHUSDT', 'RONUSDT', 'HIFIUSDT', 'BLURUSDT', 'LUNCUSDT', 'QNTUSDT', 'BABYSHARKUSDT', 'USTCUSDT', 'JSTUSDT', 'RIFUSDT', 'DEGOUSDT', 'DODOUSDT', 'ZRXUSDT', 'DYMUSDT', 'MUSKITUSDT', 'AGLDUSDT', 'GMRTUSDT', 'BXNUSDT', 'ACEUSDT', 'EDUUSDT', 'AISTUSDT', 'VTHOUSDT', 'ARTYUSDT', 'WALUSDT', 'CTCUSDT', 'DOPUSDT', 'CTKUSDT', 'MPAAUSDT', 'AIUSDT', 'GLMRUSDT', 'MAGICUSDT', 'ZECUSDT', 'QTUMUSDT', 'PYTHONUSDT', 'CGPTUSDT', 'GMXUSDT', 'BADGERUSDT', 'COMPUSDT', 'SSVUSDT', 'LUNAUSDT', 'PHILUSDT', 'NMRUSDT', 'WENUSDT', 'MNRYUSDT', 'SLFUSDT', 'BROCCOLIUSDT', 'COWUSDT', 'TRUUSDT', 'PEOPLEUSDT', 'OMIUSDT', 'MICROUSDT', 'USUALUSDT', 'MEMEFIUSDT'];

const signalOptions = ["BTC/USD", "ETH/USD", "SOL/USD"];

export default function ChatScreen({ route }) {
  const { userID, numberOfTriesLeft } = route.params;  
  const [messages, setMessages] = useState([]);
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [selectedSignal, setSelectedSignal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dropdownType, setDropdownType] = useState(null);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [remainingChats, setRemainingChats] = useState(numberOfTriesLeft);
  const navigation = useNavigation();

  // const sendMessage = async (query, type) => {
  //   setLoading(true);

  //   // Add the user's message first
  //   const userMessage = { id: Date.now(), text: query, sender: "user" };
  //   setMessages((prev) => [userMessage, ...prev]);

  //   try {
  //     // Make the API call to get the bot's response
  //     const response = await axios.post("http://127.0.0.1:8000/chat", {
  //       query,
  //       type, // "news" or "analysis"
  //     }, { headers: { "Content-Type": "application/json" } });

  //     // Add the bot's response after the user's message
  //     const botMessage = { id: Date.now() + 1, text: response.data.response.content || "No content", sender: "bot" };
  //     setMessages((prev) => [botMessage, ...prev]);
  //   } catch (error) {
  //     setMessages((prev) => [...prev, { id: Date.now() + 1, text: "Error fetching response", sender: "bot" }]);
  //   }

  //   setLoading(false);
  // };

  useEffect(() => {
    if (messages.length === 0) {
      // Initialize with a welcome message if there are no messages
      const firstMessage = { id: Date.now(), text: "Hi there! My name is Barney! I'm your AI crypto assistant. How can I help you today?", sender: "bot" };
      setMessages((prev) => [firstMessage, ...prev]);
    }


  }, []);

  const sendMessage = async (query, type, symbol) => {
    setLoading(true);

    const userMessage = { id: Date.now(), text: query, sender: "user" };
    setMessages((prev) => [userMessage, ...prev]);

    try {
        const username = "BarnacleAIadmin";
        const password = "BAIDIN101339$#";
        const basicAuth = "Basic " + encode(`${username}:${password}`);
        console.log(basicAuth)

        const response = await axios.post(
            "https://barnacleai-llama3-1.onrender.com/crypto_analysis_chat",
            { ticker: symbol, userID },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${await getToken()}`
                },
            }
        );

        const botMessage = { id: Date.now() + 1, text: response.data.chat.text || "No content", sender: "bot" };
        setMessages((prev) => [botMessage, ...prev]);
        setRemainingChats(remainingChats - 1);
    } catch (error) {
        console.error("API Error:", error.response?.data || error.message);
        setMessages((prev) => [{ id: Date.now() + 1, text: "Error fetching response", sender: "bot" }, ...prev]);
    }

    setLoading(false);
};




  return (
    <View style={{ padding: 0, flex: 1, paddingTop: 55 }}>
      <View style={styles.headerContainer}>
        <Ionicons
          name="chevron-back-sharp"
          size={29}
          color="white"
          style={{ position: 'absolute', left: 20, zIndex: 999 }}
          onPress={() => navigation.goBack()}
        />
        <Image source={{uri: 'https://www.barnacleai.com/Images/AIPic.webp'}} style={{width: 40, height: 40, borderRadius: 50, borderColor: '#FF07C9', borderWidth: 1}} />
        <Text
          style={{
            color: "white",
            fontSize: 23,
            letterSpacing: 1,
            paddingLeft: 10,
            fontFamily: "Poppins_700Bold",
            textAlign: 'center'
          }}
        >Barney AI</Text>
        <Text
          style={{
            color: "#e0e0e0",
            fontSize: 15,
            letterSpacing: 1,
            paddingRight: 20,
            paddingLeft: 7,
            fontFamily: "Poppins_700Bold"
          }}
        >Beta
        </Text>
      </View>
      <View style={{display: 'flex', flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginTop: 5}}>
        <Text style={{
            color: "#e0e0e0",
            fontSize: 13,
            letterSpacing: 1,
            paddingRight: 20,
            paddingLeft: 7,
            fontFamily: "Poppins_600SemiBold"
          }}>Remaining Chats for {new Date().toLocaleString('default', { month: 'long' })}: {remainingChats}</Text></View>
      <View style={styles.container}>
        {/* Chat Messages */}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={[styles.messageBubble, item.sender === "user" ? styles.userBubble : styles.botBubble]}>
              {
                item.sender === "bot" ?
                <View style={{display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
                  <Image source={{uri: 'https://www.barnacleai.com/Images/AIPic.webp'}} style={{width: 35, height: 35, borderRadius: 50, borderColor: '#FF07C9', borderWidth: 1, marginBottom: 10}} />
                  <Text style={{color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 10}}>Barney - Crypto Analyst</Text>
                </View>
                : <></>
              }
              
              <Text style={styles.messageText}>{item.text.split('\n').map((line, index) => {
                if (line.startsWith('#')) {
                  return <Text key={index} style={{ fontSize: 16, fontFamily:'Poppins_700Bold' }}>{`\n\n${line.replace('###', '')}\n`}</Text>;
                }
                if (line.startsWith('-')) {
                  const [prefix, ...rest] = line.split(' ');
                  if (rest[0].startsWith('**')) {
                    return <Text key={index} style={{ fontSize: 15, fontFamily:'Poppins_600SemiBold'}}>{`\n${prefix} ${rest.join(' ').replace('**', '').replace('**', '')}\n`}</Text>;
                  }
                  return <Text key={index} style={{ fontSize: 14, marginLeft: 20 }}>{line}</Text>;
                }
                if (line.includes('**')) {
                  return <Text key={index} style={{ fontSize: 14, textDecorationLine: 'underline', fontFamily:'Poppins_500Medium'}}>{`\n${line.replace('**', '').replace('**', '')}\n`}</Text>;
                }
                return <Text key={index} style={{ fontSize: 14, fontFamily:'Poppins_500Medium' }}>{line}</Text>;
              })
            }</Text>
            </View>
          )}
          inverted
        />

        {loading && <ActivityIndicator size="large" color="#FF07C9" style={{ marginVertical: 10 }} />}

        <View style={{
          display: 'flex', flexDirection: 'row', backgroundColor: '#98188d', paddingHorizontal: 17, paddingVertical: 13,
          borderRadius: 25, alignItems: 'center', marginRight: 20, marginBottom: 15, flexWrap: 'wrap'
        }}>
          <Text style={[styles.buttonText, { fontSize: 14 }]}>Can I get a quick analysis on </Text>
          <TouchableOpacity style={{ backgroundColor: "rgba(0,0,0,0.3)", padding: 5, borderRadius: 5, margin: 3 }}
            onPress={() => { setDropdownType("crypto"); setDropdownVisible(true); }}>
            <Text style={{ fontWeight: 'bold',fontSize: 14, color: '#fff' }}>{selectedCrypto || "Select Crypto"}</Text>
          </TouchableOpacity>
          <Text style={[styles.buttonText, { fontSize: 14, flex: 1 }]} numberOfLines={1}>?</Text>
          <TouchableOpacity
            onPress={() => selectedCrypto && sendMessage(`Can I get a quick analysis on ${selectedCrypto}?`, "news",selectedCrypto)}
            style={{ position: 'absolute', right: 25 }}
          >
            <MaterialIcons name="send" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Custom Dropdown Modal */}
        <Modal transparent={true} visible={isDropdownVisible} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              {/* Make the dropdown scrollable */}
              <ScrollView style={{ maxHeight: 250 }}>
                {(dropdownType === "crypto" ? cryptoOptions : signalOptions).map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.modalItem}
                    onPress={() => {
                      dropdownType === "crypto" ? setSelectedCrypto(item) : setSelectedSignal(item);
                      setDropdownVisible(false);
                    }}
                  >
                    <Text style={styles.modalText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
}

// === STYLES ===
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingLeft: 20,
    paddingVertical: 10
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 10,
    marginBottom: 10,
    borderRadius: 10,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#FF07C9",
    marginRight: 20
  },
  botBubble: {
    alignSelf: "flex-start",
    backgroundColor: 'rgba(35, 35, 35, 0.93)',
  },
  messageText: {
    color: "white",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    width: "80%",
  },
  modalItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  modalText: {
    fontSize: 16,
    textAlign: "center",
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'center'
  },
});

