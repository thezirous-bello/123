// // NotificationService.js

// import * as Notifications from "expo-notifications";
// import * as Permissions from "expo-permissions";

// export const scheduleNotification = async () => {
//   const { status } = await Permissions.askAsync(Permissions.NOTIFICATIONS);

//   if (status !== "granted") {
//     console.error("Permission to receive notifications was denied");
//     return;
//   }

//   const tomorrow = new Date();
//   tomorrow.setDate(tomorrow.getDate() + 1);
//   tomorrow.setHours(0, 0, 0, 0);

//   await Notifications.scheduleNotificationAsync({
//     content: {
//       title: "Daily Task",
//       body: "Time to call the API!",
//     },
//     trigger: {
//       hour: 0,
//       minute: 0,
//       repeats: true,
//       nextTriggerDate: tomorrow,
//     },
//   });
// };
