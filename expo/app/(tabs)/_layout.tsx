import { Tabs, Redirect, useRouter, useSegments } from "expo-router";
import { Home, ScanLine, Wallet, User, PlayCircle, MessageCircle } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { View, TouchableOpacity, Platform, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Colors from "@/constants/colors";
import { useAuth } from "@/providers/AuthProvider";
import AppTour from '@/components/AppTour';

console.log("[TabLayout] Tab layout initialized");

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { isLoggedIn, isReady } = useAuth();
  const [showHelpTour, setShowHelpTour] = useState<boolean>(false);
  const showHelpButton = segments[segments.length - 1] === 'profile';

  const handleReelsPress = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/reels');
  }, [router]);

  const handleOpenHelpSplash = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowHelpTour(true);
  }, []);

  const handleCloseHelpTour = useCallback(() => {
    setShowHelpTour(false);
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  if (!isLoggedIn) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          sceneStyle: {
            backgroundColor: 'transparent',
          },
          tabBarActiveTintColor: Colors.dark.primary,
          tabBarInactiveTintColor: Colors.dark.textMuted,
          tabBarStyle: {
            backgroundColor: 'rgba(255,255,255,0.78)',
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
            title: "Reels",
            tabBarIcon: ({ color, size }) => <PlayCircle size={size} color={color} />,
            tabBarButton: (props: any) => (
              <TouchableOpacity
                accessibilityLabel={props.accessibilityLabel}
                accessibilityState={props.accessibilityState}
                accessibilityRole={props.accessibilityRole}
                testID={props.testID}
                onLongPress={props.onLongPress}
                style={props.style}
                activeOpacity={0.8}
                onPress={handleReelsPress}
              >
                {props.children}
              </TouchableOpacity>
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

      {showHelpButton && (
        <TouchableOpacity
          style={[styles.helpButton, { bottom: insets.bottom + 72 }]}
          onPress={handleOpenHelpSplash}
          activeOpacity={0.85}
          testID="help-splash-btn"
        >
          <MessageCircle size={16} color="#FFFFFF" />
          <Text style={styles.helpButtonText}>Ajuda</Text>
        </TouchableOpacity>
      )}

      {showHelpTour && <AppTour onClose={handleCloseHelpTour} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  helpButton: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.dark.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  helpButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 0.2,
  },
});
