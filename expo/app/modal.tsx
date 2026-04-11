import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gift, X } from "lucide-react-native";
import Colors from "@/constants/colors";

export default function ModalScreen() {
  console.log("[ModalScreen] Info modal initialized");

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Pressable style={styles.overlay} onPress={handleClose}>
        <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
          <TouchableOpacity
            style={styles.closeIcon}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={Colors.dark.textMuted} />
          </TouchableOpacity>

          <View style={styles.iconWrap}>
            <Gift size={32} color={Colors.dark.neonGreen} />
          </View>

          <Text style={styles.title}>Como funciona a Premiação</Text>
          <Text style={styles.description}>
            Cada cupom escaneado já tem um número para participar do grande
            prêmio. Quanto mais cupons, mais chances de ganhar!
          </Text>

          <View style={styles.stepsWrap}>
            {[
              { num: "1", text: "Cada cupom escaneado já tem número para participar do grande prêmio" },
              { num: "2", text: "O sorteio é baseado na Loteria Federal, do 1º ao 5º prêmio" },
              { num: "3", text: "Prêmio em PIX para os ganhadores" },
              { num: "4", text: "Quanto mais cupons, mais chances de ganhar!" },
            ].map((step) => (
              <View key={step.num} style={styles.stepRow}>
                <View style={styles.stepCircle}>
                  <Text style={styles.stepNum}>{step.num}</Text>
                </View>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.8}
            testID="close-modal-btn"
          >
            <Text style={styles.closeButtonText}>Entendi!</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: Colors.dark.overlay,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 24,
    padding: 28,
    margin: 20,
    alignItems: "center",
    minWidth: 300,
    maxWidth: 380,
    borderWidth: 1,
    borderColor: Colors.dark.neonGreenBorder,
    shadowColor: "#00FF87",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  closeIcon: {
    position: "absolute" as const,
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.neonGreenFaint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.neonGreenBorder,
  },
  title: {
    fontSize: 22,
    fontWeight: "800" as const,
    marginBottom: 10,
    color: Colors.dark.text,
    textAlign: "center" as const,
  },
  description: {
    textAlign: "center" as const,
    marginBottom: 20,
    color: Colors.dark.textSecondary,
    lineHeight: 22,
    fontSize: 14,
  },
  stepsWrap: {
    width: "100%" as const,
    gap: 12,
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    backgroundColor: Colors.dark.neonGreenFaint,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.neonGreenBorder,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.dark.neonGreen,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  stepNum: {
    color: "#000",
    fontSize: 13,
    fontWeight: "800" as const,
  },
  stepText: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 13,
    fontWeight: "600" as const,
  },
  closeButton: {
    backgroundColor: Colors.dark.neonGreen,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    minWidth: 120,
    shadowColor: "#00FF87",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  closeButtonText: {
    color: "#000",
    fontWeight: "800" as const,
    textAlign: "center" as const,
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
