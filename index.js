import { AppRegistry } from "react-native";
import App from "./App";
import "react-native-get-random-values";
import { registerRootComponent } from 'expo';

// registerRootComponent(App);
AppRegistry.registerComponent("BarnacleAI", () => App);
