import React, {useEffect, useState} from "react";
import { View, Text, ImageBackground, TouchableOpacity,Pressable, TextInput, StyleSheet,Dimensions, ActivityIndicator, ScrollView } from "react-native";
import bg from  "../../../../imgs/bgimg.png";
import NewsNavigation from "../../components/NewsNav/newsNav";
import { getFearAndGreedIndex, getFearAndGreedIndexHistory, getMyFXBookData } from "../../../../services/requests";
import Gauge from "./Gauge";
import { AntDesign, FontAwesome, Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
const screenWidth = Dimensions.get("window").width;
import auth from '@react-native-firebase/auth';
import { useNavigation } from "@react-navigation/native";
import GetPremium from "../../../../components/GetPremium";
import Purchases from "react-native-purchases";
import GetPremiumInner from "../../../../components/GetPremiumInner";
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
const FinanceScreen = () => {
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
          Finance.
        </Text>
        <Text style={{
            color: "white",
            fontSize: 14,
            fontFamily: "Poppins_600SemiBold",
          }}>
            News, Financials, Sentiment, and AI Analysis!
        </Text>
      </View>
      <NewsNavigation active={2}/>
      {loading || !fearAndGreed ? <ActivityIndicator size={"large"} color={'white'}/> :
       <ScrollView>
        <View style={styles.container}>

        <Text style={styles.title}>Fear & Greed Index</Text>
        <Text style={styles.subTitle}>Crypto fear & greed index score</Text>
        <View style={{backgroundColor: 'rgba(255, 255, 255, 0.7)', height: 2, width: '100%', marginBottom: 20}}></View>
        <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignSelf:'flex-end', paddingHorizontal: 20}}>
          <Text style={{
            fontSize: 15,
            fontFamily: 'Poppins_500Medium',
            fontWeight: 'bold',
            color: 'white'
          }}>Now: </Text>
          <Text style={{
            fontSize: 15,
            fontFamily: 'Poppins_700Bold',
            fontWeight: 'bold',
            color: '#FF07C9'
          }}>{fearAndGreed.value_classification}</Text>
        </View>
        <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', alignSelf:'flex-end', paddingHorizontal: 20, position: 'absolute', top: 120}}>
          <View style={{backgroundColor: '#FF07C9', width: 40, height: 40, borderRadius: 50, marginTop: 20, alignContent: 'center'}}>
            <Text style={{
            fontSize: 22,
            alignSelf: 'center',
            fontFamily: 'Poppins_700Bold',
            fontWeight: 'bold',
            color: '#FFF',
            marginTop: 3
          }}>{fearAndGreed.value}</Text>
          </View>
        </View>
        <Gauge value={parseInt(fearAndGreed.value, 10)} />
        <Text style={styles.detailText}>Date: {new Date(fearAndGreed.timestamp * 1000).toLocaleDateString()}</Text>
      </View>
     <View style={{paddingBottom: 100}}>
     <TouchableOpacity style={{display: 'flex', flexDirection: 'column', marginTop: 20, backgroundColor:'rgba(0,0,0,0.3)', paddingVertical: 10, paddingHorizontal: 20, marginHorizontal: 15, borderRadius: 10}} onPress={() => navigation.navigate('EconomicCalender')}>
                <Text style={{color: 'white', fontSize: 18, marginBottom: 10, fontWeight: 'bold', color: '#FF07C9'}}>Economic Calender <AntDesign name="arrowright" size={24} color="#FF07C9" /></Text>
                {economicCalender ? purchaseInfo ? 
                  economicCalender.map(item => (
                    <View>
                    <View style={{alignItems:'center', display: 'flex', flexDirection: 'row', marginVertical: 5}}>
                      <View style={{backgroundColor: item.impact == 'Low' ? '#16c784' : item.impact == 'High' ? '#d92222' : 'orange', height: 7, width: 7, borderRadius: 30, marginRight: 4}}></View>
                      <View><Text style={{color: item.impact == 'Low' ? '#16c784' : item.impact == 'High' ? '#d92222' : 'orange', marginRight: 10}}>{item.impact}</Text></View>
                      <Text style={{color: '#fff', marginRight: 10}}>{item.event < 20 ? item.country + " : " + item.event : item.country + " : " +  item.event.substring(0, 20)}...</Text>
                    </View>
                    <Text style={{color: 'lightgray', fontSize: 13}}>{item.date_time}</Text>
                    </View>
                  ))
                  : <GetPremiumInner/>
                  : <><Text style={{color: 'white', fontSize: 15}}>No urgent news/alerts at this time</Text></>}
        </TouchableOpacity>
     </View>
     </ScrollView>
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

export default FinanceScreen;
