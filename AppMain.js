import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import Navigation from "./src/navigation";
import WatchlistProvider from "./src/contexts/watchlistContect";
import { RecoilRoot } from "recoil";
import { RevenueCatProvider } from "./src/services/RevenueCatProvider";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from "@expo-google-fonts/poppins";

export default function AppMain() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <ActivityIndicator size={"large"} />;
  }

  return (
    <RecoilRoot>
      <RevenueCatProvider>
      <WatchlistProvider>
        <View style={[styles.container, { backgroundColor: "transparent" }]}>
          <Navigation/>
          <StatusBar translucent={true} style='dark' backgroundColor="transparent" />
        </View>
      </WatchlistProvider>
      </RevenueCatProvider>
    </RecoilRoot>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
});
