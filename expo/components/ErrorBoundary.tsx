import React, { Component } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AlertTriangle, RefreshCw } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface Props {
  children: React.ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    console.log('[ErrorBoundary] Caught error:', error.message);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.log('[ErrorBoundary] Error details:', error.message);
    console.log('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  handleReset = () => {
    console.log('[ErrorBoundary] Resetting error state');
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={s.container}>
          <View style={s.content}>
            <View style={s.iconCircle}>
              <AlertTriangle size={40} color={Colors.dark.warning} />
            </View>
            <Text style={s.title}>Ops! Algo deu errado</Text>
            <Text style={s.message}>
              {this.props.fallbackMessage || 'Ocorreu um erro inesperado. Tente novamente.'}
            </Text>

            {__DEV__ && this.state.error && (
              <ScrollView style={s.errorBox} contentContainerStyle={s.errorContent}>
                <Text style={s.errorLabel}>Debug Info:</Text>
                <Text style={s.errorText}>{this.state.error.message}</Text>
              </ScrollView>
            )}

            <TouchableOpacity
              style={s.retryBtn}
              onPress={this.handleReset}
              activeOpacity={0.8}
              testID="error-boundary-retry"
            >
              <RefreshCw size={18} color="#000" />
              <Text style={s.retryTxt}>TENTAR NOVAMENTE</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245,158,11,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 22,
    fontWeight: '800' as const,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  message: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 24,
  },
  errorBox: {
    maxHeight: 120,
    width: '100%',
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    marginBottom: 24,
  },
  errorContent: {
    padding: 12,
  },
  errorLabel: {
    color: Colors.dark.warning,
    fontSize: 11,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  errorText: {
    color: Colors.dark.textMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  retryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.dark.neonGreen,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    shadowColor: Colors.dark.neonGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryTxt: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
});
