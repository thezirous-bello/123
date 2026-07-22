import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

const NotificationPage = () => {
  const [notifications, setNotifications] = useState([]);
  const navigation = useNavigation();

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Fetch both scheduled and delivered notifications
  const fetchNotifications = async () => {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const delivered = await Notifications.getPresentedNotificationsAsync(); // Get received notifications

      setNotifications([...scheduled, ...delivered]);

      // Reset badge count
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error("Error fetching notifications", error);
    }
  };

  // Clear a specific notification
  const clearNotification = async (identifier) => {
    try {
      await Notifications.dismissNotificationAsync(identifier);
      await Notifications.cancelScheduledNotificationAsync(identifier);
      
      setNotifications(notifications.filter(n => n.identifier !== identifier));
      
      // Reset badge count after clearing a notification
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error("Error clearing notification", error);
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    try {
      await Notifications.dismissAllNotificationsAsync(); // Clear push notifications
      await Notifications.cancelAllScheduledNotificationsAsync(); // Clear scheduled ones

      setNotifications([]);
      
      // Reset badge count after clearing all notifications
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error("Error clearing all notifications", error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons
          name="chevron-back-sharp"
          size={29}
          color="white"
          onPress={() => navigation.goBack()}
        />
        <Text style={styles.header}>Notifications</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.identifier}
        renderItem={({ item }) => (
          <View style={styles.notificationCard}>
            <Text style={styles.title}>{item.request?.content?.title || "No Title"}</Text>
            <Text style={styles.body}>{item.request?.content?.body || "No Body"}</Text>
            {/* <TouchableOpacity style={styles.clearButton} onPress={() => clearNotification(item.identifier)}>
              <Text style={styles.buttonText}>Clear</Text>
            </TouchableOpacity> */}
          </View>
        )}
      />
      
      {notifications.length > 0 ? (
        <TouchableOpacity style={styles.clearAllButton} onPress={clearAllNotifications}>
          <Text style={styles.buttonText}>Clear All</Text>
        </TouchableOpacity>
      ) : (
        <Text style={{ textAlign: 'center', color: 'white', fontSize: 17 }}>No notifications</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingVertical: 60,
    backgroundColor: '#0e0e0e',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#e0e0e0',
    marginLeft: 10,
  },
  notificationCard: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  body: {
    fontSize: 14,
    marginVertical: 5,
  },
  clearButton: {
    backgroundColor: '#ff5c5c',
    padding: 8,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  clearAllButton: {
    backgroundColor: '#98188d',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default NotificationPage;
