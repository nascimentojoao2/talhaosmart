import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AuthFeedback } from './types';

type AuthFeedbackBannerProps = {
  feedback: AuthFeedback | null;
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    padding: 12,
    gap: 4
  },
  info: {
    backgroundColor: 'rgba(125, 207, 182, 0.16)'
  },
  success: {
    backgroundColor: 'rgba(43, 182, 115, 0.18)'
  },
  error: {
    backgroundColor: 'rgba(217,83,79,0.18)'
  },
  title: {
    color: '#f4fff7',
    fontWeight: '700'
  },
  message: {
    color: '#bfd7c7',
    lineHeight: 20
  }
});

export function AuthFeedbackBanner({ feedback }: AuthFeedbackBannerProps) {
  if (!feedback) return null;

  return (
    <View
      style={[
        styles.container,
        feedback.type === 'success'
          ? styles.success
          : feedback.type === 'error'
            ? styles.error
            : styles.info
      ]}
    >
      {!!feedback.title && <Text style={styles.title}>{feedback.title}</Text>}
      <Text style={styles.message}>{feedback.message}</Text>
    </View>
  );
}
