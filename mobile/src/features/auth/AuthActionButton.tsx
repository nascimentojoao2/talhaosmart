import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';

type AuthActionButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle | ViewStyle[];
};

const styles = StyleSheet.create({
  primary: {
    backgroundColor: '#f4d35e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 52
  },
  secondary: {
    backgroundColor: '#163528',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    minHeight: 52
  },
  disabled: {
    opacity: 0.6
  },
  primaryText: {
    color: '#173025',
    fontWeight: '800'
  },
  secondaryText: {
    color: '#f4fff7',
    fontWeight: '700'
  }
});

export function AuthActionButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style
}: AuthActionButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        variant === 'primary' ? styles.primary : styles.secondary,
        isDisabled && styles.disabled,
        style
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#173025' : '#f4fff7'} />
      ) : (
        <Text style={variant === 'primary' ? styles.primaryText : styles.secondaryText}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
