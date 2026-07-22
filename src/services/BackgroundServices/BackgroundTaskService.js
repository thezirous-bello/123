// // BackgroundTaskService.js
// import { useUser } from "@realm/react";
// import * as NotificationService from "../Notifications/NotificationService";

// import * as TaskManager from "expo-task-manager";
// import * as Notifications from "expo-notifications";

// const API_TASK_NAME = "API_TASK";

// TaskManager.defineTask(API_TASK_NAME, async ({ data, error }) => {
//   const user = useUser();
//   if (error) {
//     console.error(error);
//     return;
//   }

//   // Call your API here
//   console.log("This user is logged in" + user.id);
//   // Optionally, you can schedule the next notification
//   await NotificationService.scheduleNotification();

//   return Notifications.dismissAllNotificationsAsync();
// });

// TaskManager.registerTaskAsync(API_TASK_NAME, {
//   minimumInterval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
// });
