import RealmWrapper from "./src/screens/LoginScreen/RealmWrapper";
import { NavigationContainer } from "@react-navigation/native";
import "react-native-get-random-values";
import { CoinsProvider } from "./src/services/CoinsContext";
import { ActivityIndicator } from "react-native";

import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from "@expo-google-fonts/poppins";

const BarnacleAI_ID = "barnacleai-kwazd";

const App = () => {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    // Poppins_600SemiBold: require("../../../assets/Poppins/Poppins-SemiBold.ttf"),
  });

  if (!fontsLoaded) {
    return <ActivityIndicator size={"large"} />;
  }

  return (
    <CoinsProvider>
      <NavigationContainer
        theme={{
          colors: {
            background: "#0f0f0f",
          },
        }}
      >        
          <RealmWrapper />
      </NavigationContainer>
    </CoinsProvider>
  );
};

export default App;
