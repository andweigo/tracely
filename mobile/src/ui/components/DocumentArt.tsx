import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface DocumentArtProps {
  size?: number;
}

/**
 * Vector document sheet illustration matching the Tracely visual identity.
 */
export const DocumentArt: React.FC<DocumentArtProps> = ({ size = 112 }) => {
  const height = Math.round(size * 1.16);
  return (
    <Svg width={size} height={height} viewBox="0 0 100 116">
      <Path
        d="M16 8 H68 L88 28 V102 C88 106.4 84.4 110 80 110 H16 C11.6 110 8 106.4 8 102 V16 C8 11.6 11.6 8 16 8 Z"
        fill="#FFFFFF"
      />
      <Path d="M68 8 V24 C68 26.2 69.8 28 72 28 H88 Z" fill="#DBEAFE" />
      <Rect x="22" y="26" width="38" height="6" rx="3" fill="#DBEAFE" />
      <Rect x="22" y="38" width="30" height="6" rx="3" fill="#DBEAFE" />
      <Rect x="22" y="50" width="22" height="6" rx="3" fill="#E2E8F0" />
      <Circle cx="67" cy="84" r="9" fill="#F3B32A" />
    </Svg>
  );
};
