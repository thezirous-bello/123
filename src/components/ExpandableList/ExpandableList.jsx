import React, { useState } from "react"; 
import { 
    View, 
    Text, 
    TouchableOpacity, 
    FlatList, 
    StyleSheet, 
} from "react-native"; 
import ExpandableListItem from "./ExpandableListItem";

const ExpandableList = ({ data }) => { 
    const renderItem = ({ item }) => ( 
        <ExpandableListItem item={item} /> 
    ); 
  
    return ( 
        <FlatList 
            style={{marginBottom: 40}}
            data={data} 
            renderItem={renderItem} 
            keyExtractor={(item) => item._id.toString()} 
        /> 
    ); 
}; 

export default ExpandableList;

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
        padding: 10, 
        backgroundColor: "white", 
        borderRadius: 10, 
        elevation: 3, 
    }, 
    itemTouchable: { 
        borderRadius: 10, 
        overflow: "hidden", 
    }, 
    itemTitle: { 
        fontSize: 18, 
        fontWeight: "bold", 
        color: "#333", 
    }, 
    itemContent: { 
        marginTop: 10, 
        fontSize: 14, 
        color: "#666", 
    }, 
});