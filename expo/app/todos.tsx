import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

type Todo = {
  id: number;
  name: string;
};

export default function TodosScreen() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const getTodos = async () => {
      try {
        setLoading(true);
        setError('');

        const { data, error: fetchError } = await supabase
          .from('todos')
          .select('id,name')
          .order('id', { ascending: false });

        if (fetchError) {
          setError(fetchError.message);
          return;
        }

        setTodos((data as Todo[]) || []);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erro inesperado ao buscar tarefas';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    getTodos();
  }, []);

  return (
    <View style={s.container}>
      <Stack.Screen options={{ title: 'Todo List' }} />
      <Text style={s.title}>Todo List</Text>

      {loading && <Text style={s.info}>Carregando...</Text>}
      {!loading && !!error && <Text style={s.error}>Erro: {error}</Text>}
      {!loading && !error && todos.length === 0 && <Text style={s.info}>Sem tarefas</Text>}

      <FlatList
        data={todos}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <Text style={s.item}>{item.name}</Text>}
        contentContainerStyle={s.list}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 16,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  list: {
    paddingBottom: 24,
    gap: 8,
  },
  item: {
    color: Colors.dark.text,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  info: {
    color: Colors.dark.textSecondary,
    marginBottom: 10,
  },
  error: {
    color: Colors.dark.danger,
    marginBottom: 10,
  },
});
