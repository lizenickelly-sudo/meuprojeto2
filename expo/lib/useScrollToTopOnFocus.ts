import { useCallback, type RefObject } from 'react';
import { InteractionManager } from 'react-native';
import { useFocusEffect } from 'expo-router';

type ScrollableRef = {
  scrollTo?: (options: { x?: number; y?: number; animated?: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated?: boolean }) => void;
};

export function useScrollToTopOnFocus(scrollRef: RefObject<ScrollableRef | null>) {
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        const target = scrollRef.current;
        if (!target) return;

        if (typeof target.scrollTo === 'function') {
          target.scrollTo({ x: 0, y: 0, animated: false });
          return;
        }

        if (typeof target.scrollToOffset === 'function') {
          target.scrollToOffset({ offset: 0, animated: false });
        }
      });

      return () => task.cancel();
    }, [scrollRef])
  );
}