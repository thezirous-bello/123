import React, { useState } from "react"; 
import { 
    View, 
    Text, 
    TouchableOpacity, 
    FlatList, 
    StyleSheet, 
} from "react-native"; 
import AntDesign from '@expo/vector-icons/AntDesign';

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
  
    // Check if the date is today
    const isToday = date.toDateString() === today.toDateString();
  
    if (isToday) {
      // Return only the time part if it's today
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      // Return the date part without the year if it's not today
      const options = { month: '2-digit', day: '2-digit' };
      return date.toLocaleDateString(undefined, options);
    }
  }
  
const ExpandableListItem = ({ item }) => { 
    const [expanded, setExpanded] = useState(false); 
  
    const toggleExpand = () => { 
        setExpanded(!expanded); 
    }; 
  
    return ( 
        <View style={styles.itemContainer}> 
            <TouchableOpacity 
                onPress={toggleExpand} 
                style={styles.itemTouchable} 
            > 
                <Text style={styles.itemTicker}> 
                    {item.coin} 
                </Text>
                <Text style={ item.value.toUpperCase() == 'BUY' ? styles.itemSignal : styles.itemSignal2}> 
                    {item.value} 
                </Text> 
                {
                    item.status ? 
                    <Text style={styles.itemPrice}> 
                       {
                          <Text style={item.status == 'profit' ? styles.itemProfit : styles.itemLoss}> 
                              {item.status} 
                          </Text> 
                       }
                    </Text> 
                    :
                    <Text style={styles.itemPrice}> 
                        ${item.price > 0.99 ? item.price.toFixed(2) : item.price.toFixed(5)} 
                    </Text> 
                }
                <Text style={styles.itemTime}> 
                    {formatTimestamp(item.timestamp)} 
                </Text>
                {!expanded && (
                    <AntDesign name="downcircle" size={24} color="#FF07C9" />
                )}
                {
                    expanded && (
                        <AntDesign name="upcircle" size={24} color="white" />
                    )
                }
                
            </TouchableOpacity> 
            {expanded && ( 
                <View style={{marginTop: 10, borderTopColor: 'rgba(255, 255, 255, 0.5)', borderTopWidth: 1}}>
                    {/* <Text style={{color:'rgba(255, 255, 255, 0.8)', fontFamily:"Poppins_700Bold", fontSize: 18, marginTop: 10}}>{item.title}</Text> */}
                    {/* {
                        item.status ?
                        <View>
                            <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 15}}>
                                {
                                    item.status ?
                                    <Text style={{color:'rgba(255, 255, 255, 0.8)', fontFamily:"Poppins_700Bold", fontSize: 17}}>Signal status: <Text style={{fontFamily: 'Poppins_600SemiBold', color: item.status == 'profit' ? '#16c784' : item.status == 'loss' ? '#d92222' : 'orange'}}> {item.status}</Text></Text>
                                    : <View></View>
                                }
                                <View>
                                    {
                                        item.status == 'processing' ? 
                                        <AntDesign name="minuscircle" size={24} color="orange" />
                                        : item.status == 'profit' ?
                                        <AntDesign name="checkcircle" size={24} color="#16c784" />
                                        : item.status == 'loss' ?
                                        <AntDesign name="exclamationcircle" size={24} color="#d92222" />
                                        : 
                                        <AntDesign name="minuscircle" size={24} color="orange" />
                                    }
                                </View>
                            </View>
                                {
                                    item.price_sold != 0 ?
                                    <Text style={{color:'rgba(255, 255, 255, 0.8)', fontFamily:"Poppins_700Bold", fontSize: 17}}>Price sold: <Text style={{fontFamily: 'Poppins_600SemiBold', color: item.status == 'profit' ? '#16c784' : item.status == 'loss' ? '#d92222' : 'orange'}}>${item.price_sold > 0.99 ? item.price_sold.toFixed(2) : item.price_sold.toFixed(12)}</Text></Text>
                                    : <View></View>
                                }
                                {
                                    item.price_sold != 0 ?
                                    <Text style={{color:'rgba(255, 255, 255, 0.8)', fontFamily:"Poppins_700Bold", fontSize: 17}}>Total %: <Text style={{fontFamily: 'Poppins_600SemiBold', color: item.status == 'profit' ? '#16c784' : item.status == 'loss' ? '#d92222' : 'orange'}}>{((1-(item.price / item.price_sold))*100).toFixed(2)}%</Text></Text>
                                    : <View></View>
                                }
                                <View style={{height: 0.5, backgroundColor: '#fff', width: '100%', marginVertical: 8}}></View>
                        </View>
                        : <Text></Text>
                    } */}
                    {/* "#FF5555" : "#16c784" || "white"; */}
                    <View style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 15}}>
                        <View style={{display: 'flex', flexDirection: 'column', paddingHorizontal: 15}}>
                            <Text style={{color:'rgba(255, 255, 255, 0.8)', fontFamily:"Poppins_600SemiBold", fontSize: 17}}>Buy Price: </Text>
                            <Text style={{fontFamily: 'Poppins_600SemiBold', color: '#16c784', fontSize: 15}}>${item.price > 0.99 ? item.price.toFixed(2) : item.price.toFixed(8)}</Text>
                        </View>
                        <View style={{display: 'flex', flexDirection: 'column', paddingHorizontal: 15}}>
                            <Text style={{color:'rgba(255, 255, 255, 0.8)', fontFamily:"Poppins_600SemiBold", fontSize: 17}}>Sell Price: </Text>
                            <Text style={{fontFamily: 'Poppins_600SemiBold', color: item.status == 'profit' ? '#16c784' : item.status == 'loss' ? '#d92222' : 'orange', fontSize: 15}}>${item.price_plus_5 > 0.99 ? item.price_plus_5.toFixed(2) : item.price_plus_5.toFixed(8)}</Text>
                        </View>
                        <View style={{display: 'flex', flexDirection: 'column', paddingHorizontal: 15}}>
                            <Text style={{color:'rgba(255, 255, 255, 0.8)', fontFamily:"Poppins_600SemiBold", fontSize: 17}}>Stop Loss: </Text>
                            <Text style={{fontFamily: 'Poppins_600SemiBold', color: '#FF5555', fontSize: 15}}>${item.price_minus_5 > 0.99 ? item.price_minus_5.toFixed(2) : item.price_minus_5.toFixed(8)}</Text>
                        </View>
                    </View>
                    
                </View>
            )} 

        </View> 
    ); 
}; 

export default ExpandableListItem;

const styles = StyleSheet.create({ 
    container: { 
        flex: 1, 
        backgroundColor: "#f5f5f5", 
        padding: 20, 
    }, 
    header: { 
        fontSize: 30, 
        fontWeight: "bold", 
        marginBottom: 20, 
        color: "green", 
        textAlign: "center", 
    }, 
    subheader: { 
        fontSize: 20, 
        fontWeight: "bold", 
        marginBottom: 20, 
        textAlign: "center", 
    }, 
    itemContainer: { 
        marginBottom: 15, 
        padding: 20, 
        backgroundColor: "#D9D9D921", 
        borderRadius: 25, 
        elevation: 3, 
    }, 
    itemTouchable: { 
        borderRadius: 10, 
        overflow: "hidden", 
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between'
    }, 
    itemPrice: { 
        fontSize: 18, 
        fontWeight: "bold", 
        color: "#fff", 
        textAlign:'left'
    }, 
    itemTime: { 
        fontSize: 18, 
        fontWeight: "bold", 
        color: "#fff", 
        textAlign:'left'
    }, 
    itemSignal: { 
        fontSize: 18, 
        fontWeight: "bold", 
        color: "#16c784", 
        textAlign:'left',
        textTransform: 'uppercase'
    }, 
    itemSignal2: { 
        fontSize: 18, 
        fontWeight: "bold", 
        color: "#d92222", 
        textAlign:'left',
        textTransform: 'uppercase'
    }, 
    itemTicker: { 
        fontSize: 25, 
        fontWeight: "bold", 
        color: "#FF07C9", 
        textAlign:'left'
    }, 
    itemContent: { 
        marginTop: 10, 
        fontSize: 14, 
        color: "#fff", 
        textAlign: 'left'
    }, 
    itemProfit: { 
        color: '#16c784',
        fontWeight: 'bold',
        textTransform: 'capitalize'
    },
    itemLoss: {
        color: '#d92222',
        fontWeight: 'bold',
        textTransform: 'capitalize'
    }
});