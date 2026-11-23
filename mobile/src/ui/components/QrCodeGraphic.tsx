import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QRCode from 'qrcode';
import Svg, { Rect } from 'react-native-svg';
import { SDO_COLORS } from '../theme/tokens';

interface QrCodeGraphicProps {
  value: string;
  size?: number;
  caption?: string;
}

/**
 * Pure vector QR renderer via qrcode matrix + react-native-svg (zero WebView/DOM).
 */
export const QrCodeGraphic: React.FC<QrCodeGraphicProps> = ({
  value,
  size = 180,
  caption,
}) => {
  const matrix = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    const count = qr.modules.size;
    const cells: Array<{ x: number; y: number }> = [];
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (qr.modules.get(row, col)) {
          cells.push({ x: col, y: row });
        }
      }
    }
    return { count, cells };
  }, [value]);

  const cellSize = size / matrix.count;

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Rect x={0} y={0} width={size} height={size} fill="#FFFFFF" />
          {matrix.cells.map((cell) => (
            <Rect
              key={`${cell.x}-${cell.y}`}
              x={cell.x * cellSize}
              y={cell.y * cellSize}
              width={cellSize + 0.35}
              height={cellSize + 0.35}
              fill={SDO_COLORS.navy}
            />
          ))}
        </Svg>
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
  },
  caption: {
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
    textAlign: 'center',
  },
});
