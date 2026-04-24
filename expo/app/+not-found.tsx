import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SearchX } from "lucide-react-native";
import Colors from "@/constants/colors";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Página não encontrada" }} />
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <SearchX size={48} color={Colors.dark.neonGreen} />
        </View>
        <Text style={styles.title}>Esta tela não existe.</Text>
        <Text style={styles.subtitle}>
          A página que você procura não foi encontrada.
        </Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Ir para a página inicial</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: 'transparent',
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.neonGreenFaint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.neonGreenBorder,
  },
  title: {
    fontSize: 20,
    fontWeight: "800" as const,
    color: Colors.dark.text,
    textAlign: "center" as const,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: "center" as const,
    marginTop: 8,
    lineHeight: 20,
  },
  link: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.dark.neonGreenFaint,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.neonGreenBorder,
  },
  linkText: {
    fontSize: 14,
    color: Colors.dark.neonGreen,
    fontWeight: "700" as const,
  },
});
