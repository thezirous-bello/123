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
  Modal,
  TouchableOpacity
} from "react-native";
import bg from "../../../../imgs/bgimg.png";
import {
  getSignals
} from "../../../../services/requests";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import auth from '@react-native-firebase/auth';
import StatsNavigation from "../../Components/StatsNav";
import ExpandableList from '../../../../components/ExpandableList/ExpandableList';
import Purchases from "react-native-purchases";
import GetPremium from "../../../../components/GetPremium";
import LoadingFullScreen from "../../../../components/LoadingFullScreen";
import Icon from 'react-native-vector-icons/Ionicons';  // Assuming you're using Ionicons

const DayTrades = () => {
  var {height, width} = Dimensions.get('window');

  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 

  const navigation = useNavigation();
  const [dbdata, setDBdata] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [purchaseInfo, setPurchaseInfo] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const data = [ 
      { 
          id: 1, 
          signal: "BUY",
          title: "Bitcoin", 
          ticker: "BTC", 
          price: "$64,000",
          TakeProfit: "$68,000",
          StopLoss: "$61,000",
          time: "6:27PM",
          content: 
              `JavaScript (JS) is the most popular  
              lightweight, interpreted compiled  
              programming language. It can be used  
              for both Client-side as well as  
              Server-side developments. JavaScript  
              also known as a scripting language  
              for web pages.`, 
      }, 
      { 
          id: 2, 
          signal: "BUY",
          title: "Ethereum", 
          ticker: "ETH", 
          price: "$3,400", 
          TakeProfit: "$3,700",
          StopLoss: "$3,200",
          time: "3:27PM",
          content: 
              `A Computer Science portal for geeks.  
              It contains well written, well thought  
              and well explained computer science and  
              programming articles`, 
      }, 
      { 
          id: 3, 
          signal: "BUY",
          title: "Solana", 
          ticker: "SOL", 
          price: "$120", 
          TakeProfit: "$140",
          StopLoss: "$100",
          time: "7/16 3:27PM",
          content: 
              `Python is a high-level, general-purpose,  
              and very popular programming language.  
              Python programming language (latest  
              Python 3) is being used in web development,  
              Machine Learning applications, along with 
              all cutting-edge technology in Software  
              Industry.`, 
      }, 
      // ...more items 
  ]; 

  const getSignalsCalls = async () => {
    setLoading(true);

    try{
      const signalData = await getSignals(isLoggedIn, id);
      setDBdata(signalData);
      setLoading(false);
    }catch(e){
      console.log(e)
      setLoading(false)
      setError(true)
    }
    
    
  };

  const getPurchaserInfo = async () => {
    setLoading(true)
    try {
      const purchaserInfo = await Purchases.getCustomerInfo();
      setPurchaseInfo(purchaserInfo.activeSubscriptions[0]);
    } catch (e) {
      console.error("Error fetching purchaser info:", e);
    }
  };

  useEffect(() => {
    getPurchaserInfo();

    console.log("Making the signals call")
    getSignalsCalls();
    console.log(dbdata)
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      getPurchaserInfo();
      getSignalsCalls();
      setLoading(false);
    }, [])
  );

  if (loading) {
    return <LoadingFullScreen
              spinnerSource={require('../../../../imgs/ngjyra.png')}
              backgroundSource={require('../../../../imgs/back that.png')}
            />;
  }
  if (error) {
    return <Text style={{color:'white', marginTop: height/2.5, textAlign: 'center', fontSize: 15,fontFamily: "Poppins_600SemiBold", }}>Something went wrong, please try again later...</Text>
  }

  return (
    <View style={styles.image}>
      {/* Modal for showing explanation */}
      <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsModalVisible(false)}
      >
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <Text style={styles.modalText}>
                      ⚠️ Disclaimer {'\n'}{'\n'}
                      📉 Not Financial Advice {'\n'}{'\n'}
                      The trades and strategies shared within this app are not financial advice. They represent trades that we execute based on various AI-driven indicators and market analysis. {'\n'}{'\n'}
                      🚀 Follow at Your Own Risk {'\n'}{'\n'}
                      If you choose to follow our trades or strategies, you do so at your own risk. Market conditions can change rapidly, and trading involves significant risk of loss. {'\n'}{'\n'}
                      🧠 Informed Decision-Making {'\n'}{'\n'}
                      We encourage you to conduct your own research, understand the indicators mentioned in AI Insights, and make decisions that align with your financial goals and risk tolerance. {'\n'}
                  </Text>
                  <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                      <Text style={styles.closeText}>Close</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>
      <View style={{display: 'flex', justifyContent: 'space-between', flexDirection: 'row'}}>
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
        <TouchableOpacity onPress={() => setIsModalVisible(true)} style={{marginRight: 10}}>
          <Icon name="help-circle" size={20} color="white" />
        </TouchableOpacity>
      </View>
      <StatsNavigation active={4}/>

      {purchaseInfo ? 
      <ExpandableList data={dbdata} />
    : 
    <GetPremium/>
    }

    </View>
  );
};

export default DayTrades;

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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    maxWidth: 300,
    alignItems: 'center',
  },
  modalText: {
    fontSize: 16,
    marginBottom: 10,
  },
  closeText: {
    color: 'blue',
    fontWeight: 'bold',
  },
});