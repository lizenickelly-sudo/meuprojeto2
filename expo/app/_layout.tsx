import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { AppProvider } from "@/providers/AppProvider";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import AppWallpaper from "@/components/AppWallpaper";
import Colors from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Voltar",
        headerStyle: { backgroundColor: 'rgba(255,255,255,0.78)' },
        headerTintColor: Colors.dark.primary,
        headerTitleStyle: {
          color: Colors.dark.text,
          fontWeight: "700" as const,
          fontSize: 17,
        },
        contentStyle: { backgroundColor: 'transparent' },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="admin"
        options={{ title: "Painel Admin", presentation: "modal" }}
      />
      <Stack.Screen name="leaderboard" options={{ title: "Ranking Semanal" }} />
      <Stack.Screen name="reels" options={{ headerShown: false }} />
      <Stack.Screen
        name="sponsor-detail"
        options={{ title: "Patrocinador" }}
      />
      <Stack.Screen
        name="withdraw"
        options={{ title: "Sacar PIX", presentation: "modal" }}
      />
      <Stack.Screen
        name="identity-verify"
        options={{ title: "Verificação de Identidade", presentation: "modal" }}
      />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}

function AppShell() {
  const { resetEpoch, isLoggedIn, userEmail } = useAuth();
  return (
    <AppProvider key={`app_${resetEpoch}_${isLoggedIn ? userEmail : 'guest'}`}>
      <View style={s.shell}>
        <AppWallpaper />
        <StatusBar style="dark" />
        <RootLayoutNav />
      </View>
    </AppProvider>
  );
}

export default function RootLayout() {
  const onLayoutReady = useCallback(async () => {
    console.log("[RootLayout] Layout ready, hiding splash");
    await SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    onLayoutReady();
  }, [onLayoutReady]);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView
        style={s.gestureRoot}
      >
        <ErrorBoundary>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </ErrorBoundary>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const s = StyleSheet.create({
  gestureRoot: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  shell: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
