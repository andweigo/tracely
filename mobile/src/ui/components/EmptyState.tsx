import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
}) => (
  <View style={styles.container}>
    <View style={styles.iconCircle}>{icon}</View>
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.description}>{description}</Text>
    {action ? <View style={styles.actionWrap}>{action}</View> : null}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: SDO_COLORS.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
    textAlign: 'center',
  },
  description: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  actionWrap: {
    marginTop: 14,
  },
});
