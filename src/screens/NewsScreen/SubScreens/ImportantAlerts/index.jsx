import React, {useEffect, useState} from "react";
import { View, Text, ImageBackground, Pressable, TextInput, StyleSheet,Dimensions, ActivityIndicator, ScrollView } from "react-native";
import bg from  "../../../../imgs/bgimg.png";
import NewsNavigation from "../../components/NewsNav/newsNav";
import { AntDesign, FontAwesome, Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
const screenWidth = Dimensions.get("window").width;
import { useNavigation } from "@react-navigation/native";
import { getRecentCoinWatcher } from "../../../../services/requests";
import auth from '@react-native-firebase/auth';
import GetPremium from "../../../../components/GetPremium";
import Purchases from "react-native-purchases";

const ImportantAlerts = () => {
  const id = auth().currentUser.uid;
  const isLoggedIn = auth().currentUser.uid ? true : false; 
  const [number, onChangeNumber] = useState('');
  const [news, setNews] = useState();
  const [loading, setLoading] = useState(true);
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
        const info = await getRecentCoinWatcher(isLoggedIn, 1000,1000);

        setNews(info);
        // console.log(info);
        setLoading(false);
      }catch(e){
        console.log(e)
      }
    }
    fetchData();
    
  }, []);
  
  return (
    <View style={{ padding: 30, flex: 1, paddingTop: 55}}>
       <View style={styles.headerContainer}>
            <Ionicons
                name="chevron-back-sharp"
                size={29}
                color="white"
                style={{position: 'absolute', left: 0}}
                onPress={() => navigation.goBack()}
            />
            <Text
                style={{
                color: "white",
                fontSize: 25,
                letterSpacing: 1,
                paddingHorizontal: 20,
                fontFamily: "Poppins_700Bold",
                textAlign: 'center'
                }}
            >
                Important Alerts
            </Text>
      </View>
      {purchaseInfo ? 
      <ScrollView style={{ paddingHorizontal: 0, paddingVertical: 20}}>
        {
            loading ? <ActivityIndicator size={"large"} color={'white'}/>
            : news ?
                
                news.map(item => (
                  item.message_text ? 
                    <View style={{display:'flex', flexDirection: 'row', alignItems: 'center', marginVertical: 20}}>
                        <View style={{flex: 3/4}}>
                            <Text style={{color: 'white', fontSize: 15, paddingRight: 15}}>{item.message_text.replace('@WatcherGuru', '').replace('\n', '')}</Text>
                            <Text style={{color:'gray', marginTop: 5}}>Resource: {item.telegram_group}</Text>
                        </View>
                        <View style={{flex: 1/4, justifyContent: 'flex-end'}}>
                            <View style={{backgroundColor: item.sentiment == 'positive' ? '#16c784' : item.sentiment == 'negative' ? '#d92222' : 'orange', padding: 7, borderRadius: 10, width: screenWidth/5, marginVertical: 2.5}}><Text style={{textAlign: 'center', fontWeight: 700}}>{item.sentiment}</Text></View>
                            <View style={{backgroundColor: '#d92222', padding: 7, borderRadius: 10, width: screenWidth/5, marginVertical: 2.5}}><Text style={{textAlign: 'center', fontWeight: 700}}>High</Text></View>
                        </View>
                    </View>
                    : <></>
                ))
                : <><Text style={{color: 'white', fontSize: 15}}>No urgent news/alerts at this time</Text></>
        }
        
      </ScrollView>
      : <GetPremium/> }
    </View>
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
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'center'
  },
  tickerContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  tickerTitle: { 
    color: "white", 
    fontWeight: "bold", 
    marginHorizontal: 5,
  fontSize: 18},
  rank: {
    fontWeight: "bold",
    color: "white",
    fontSize: 16,
    marginRight: 5,
    backgroundColor: "#585858",
    paddingTop: 1,
    paddingBottom: 1,
    paddingLeft: 4,
    paddingRight: 4,
    borderRadius: 5
  }
});

export default ImportantAlerts;
