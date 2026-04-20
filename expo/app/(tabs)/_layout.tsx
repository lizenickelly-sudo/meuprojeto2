import { Tabs, Redirect } from "expo-router";
import { Home, ScanLine, Wallet, User, MessageCircleQuestion } from "lucide-react-native";
import React, { useState, useCallback } from "react";
import { View, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import * as Haptics from 'expo-haptics';
import Colors from "@/constants/colors";
import AppTour from "@/components/AppTour";
import { useAuth } from "@/providers/AuthProvider";

console.log("[TabLayout] Tab layout initialized");

export default function TabLayout() {
  const { isLoggedIn, isReady } = useAuth();
  const [showTour, setShowTour] = useState<boolean>(false);

  const handleHelpPress = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowTour(true);
  }, []);

  const handleCloseTour = useCallback(() => {
    setShowTour(false);
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return <Redirect href="/login" />;
  }

  if (showTour) {
    return <AppTour onClose={handleCloseTour} />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.dark.primary,
        tabBarInactiveTintColor: Colors.dark.textMuted,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: 'rgba(0,0,0,0.06)',
          borderTopWidth: 1,
          overflow: 'visible',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 8,
        },
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600' as const,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="scanner"
        options={{
          title: "Scanner",
          tabBarIcon: ({ color, size }) => <ScanLine size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: "Ajuda",
          tabBarItemStyle: {
            zIndex: 30,
          },
          tabBarIcon: () => (
            <View style={fab.wrapper}>
              <View style={fab.button}>
                <MessageCircleQuestion size={26} color="#000" />
              </View>
            </View>
          ),
          tabBarLabel: () => null,
          tabBarButton: (props: any) => (
            <TouchableOpacity
              {...props}
              onPress={handleHelpPress}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Carteira",
          tabBarIcon: ({ color, size }) => <Wallet size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const fab = StyleSheet.create({
  wrapper: {
    position: 'relative',
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    top: -18,
    width: 60,
    height: 60,
  },
  button: {
    zIndex: 41,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F97316',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
});
