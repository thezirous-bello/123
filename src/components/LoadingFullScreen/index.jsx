import React from 'react';
import { View, Image, StyleSheet, ImageBackground, Animated, Easing } from 'react-native';

const LoadingFullScreen = ({ spinnerSource, backgroundSource }) => {
    const spinValue = new Animated.Value(0);

    Animated.loop(
        Animated.timing(spinValue, {
            toValue: 1,
            duration: 1000,
            easing: Easing.linear,
            useNativeDriver: true,
        })
    ).start();

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <ImageBackground source={backgroundSource} style={styles.background}>
            <View style={styles.container}>
                <Animated.Image 
                    source={spinnerSource} 
                    style={[styles.spinner, { transform: [{ rotate: spin }] }]} 
                />
            </View>
        </ImageBackground>
    );
};

const styles = StyleSheet.create({
    background: {
        flex: 1,
        resizeMode: 'cover',
        justifyContent: 'center',
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    spinner: {
        width: 100,
        height: 100,
    },
});

export default LoadingFullScreen;