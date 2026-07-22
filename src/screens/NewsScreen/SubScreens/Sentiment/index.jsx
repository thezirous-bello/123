import React, {useEffect, useState} from "react";
import { View, Text, ImageBackground, TouchableOpacity,Pressable, TextInput, StyleSheet,Dimensions, ActivityIndicator, ScrollView } from "react-native";
import bg from  "../../../../imgs/bgimg.png";
import NewsNavigation from "../../components/NewsNav/newsNav";
import { getFearAndGreedIndex, getFearAndGreedIndexHistory, getMyFXBookData } from "../../../../services/requests";
import { AntDesign, FontAwesome, Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
const screenWidth = Dimensions.get("window").width;
import auth from '@react-native-firebase/auth';
import { useNavigation } from "@react-navigation/native";
import Purchases from "react-native-purchases";
import NewsSentimentBar from "./NewsSentimentBar";
import GetPremium from "../../../../components/GetPremium";
import { Platform } from "react-native";
var padding = 30;
var paddingBG = 40;
if (Platform.OS === 'ios') {
  padding = 30;
  paddingBG = 40;
} else if (Platform.OS === 'android') {
  padding = 15;
  paddingBG = 20;
}

const SentimentScreen = () => {
  const [number, onChangeNumber] = useState('');
  const [fearAndGreed, setFearAndGreed] = useState();
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false;
  const [loading, setLoading] = useState(true);
  const [ economicCalender,setEconomicCalender] = useState();
  const navigation = useNavigation();
  const [purchaseInfo, setPurchaseInfo] = useState([]);

  useEffect(() => {
    const getPurchaserInfo = async () => {
      setLoading(true)
      try {
        const purchaserInfo = await Purchases.getCustomerInfo();
        setPurchaseInfo(purchaserInfo.activeSubscriptions[0]);
      } catch (e) {
        console.error("Error fetching purchaser info:", e);
      }
    };
    getPurchaserInfo();
    const fetchData = async () => {
      try{
        const info = await getFearAndGreedIndex();

        setFearAndGreed(info);
        setLoading(false);
      }catch(e){
        console.log(e)
      }
    }
    const fetchEconomicCalender = async () => {
      try{
        const info = await getMyFXBookData(isLoggedIn, 48, 6, true);

        setEconomicCalender(info);
        setLoading(false);
      }catch(e){
        console.log(e)
      }
    }

    fetchEconomicCalender();
    fetchData();
    
  }, []);
  
  return (
    <ImageBackground source={bg} style={{ flex: 1, paddingTop:paddingBG, paddingBottom: 40 }}>
      <View style={{ paddingHorizontal: padding }}>
        <Text
          style={{
            color: "white",
            fontSize: 32,
            fontFamily: "Poppins_700Bold",
            paddingTop: padding,
          }}
        >
          Sentiment.
        </Text>
        <Text style={{
            color: "white",
            fontSize: 14,
            fontFamily: "Poppins_600SemiBold",
          }}>
            News, Financials, Sentiment, and AI Analysis!
        </Text>
      </View>
      <NewsNavigation active={3}/>
      {loading || !fearAndGreed ? <ActivityIndicator size={"large"} color={'white'}/> :
       purchaseInfo ? 
       <ScrollView>

        
        <View style={styles.container}>

          <Text style={styles.title}>Total News Sentiment</Text>
          <NewsSentimentBar />        
        </View>

     </ScrollView>
     : 
     <GetPremium/>
     
      }
    </ImageBackground>
  );
};
const styles = StyleSheet.create({
  InputContainer:{
    display: 'flex',
    flexDirection: 'row',
    backgroundColor: 'white',
    alignItems: 'center',
    marginHorizontal: 10,
    borderRadius: 25,
    justifyContent: 'space-between'
  },
  input: {
    height: 40,
    width: screenWidth / 1.4,
    backgroundColor: 'white',
    fontFamily: 'Poppins_600SemiBold',
    padding: 10,
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 15
  },
  title: {
    fontSize: 22,
    fontFamily: 'Poppins_600SemiBold',
    fontWeight: 'bold',
    color: 'white',
    alignSelf: 'flex-start',
    paddingHorizontal: 20
  },
  subTitle:{
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
    fontWeight: 'bold',
    marginBottom: 10,
    color: 'white',
    alignSelf: 'flex-start',
    paddingHorizontal: 20
  },
  details: {
    marginTop: 20,
    color: 'white'
  },
  detailText: {
    alignSelf: 'flex-start',
    fontSize: 16,
    paddingHorizontal: screenWidth * .25,
    color: 'white',
    marginVertical: 5,
  },
});

export default SentimentScreen;
