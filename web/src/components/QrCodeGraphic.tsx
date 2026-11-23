import React, { useMemo } from 'react';
import QRCode from 'qrcode';

interface QrCodeGraphicProps {
  readonly value: string;
  readonly size?: number;
}

/**
 * Pure SVG matrix QR renderer using `qrcode` matching mobile's opaque routing slip QRs.
 */
export const QrCodeGraphic: React.FC<QrCodeGraphicProps> = ({ value, size = 180 }) => {
  const { modules, moduleCount } = useMemo(() => {
    const generated = QRCode.create(value || 'TRC-QR:EMPTY', { errorCorrectionLevel: 'M' });
    const count = generated.modules.size;
    const coords: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < count; y += 1) {
      for (let x = 0; x < count; x += 1) {
        if (generated.modules.get(y, x)) {
          coords.push({ x, y });
        }
      }
    }
    return { modules: coords, moduleCount: count };
  }, [value]);

  const margin = 2;
  const viewBoxSize = moduleCount + margin * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR Code for ${value}`}
    >
      <rect x={0} y={0} width={viewBoxSize} height={viewBoxSize} fill="#FFFFFF" rx={1} />
      {modules.map((pt) => (
        <rect
          key={`${pt.x}-${pt.y}`}
          x={pt.x + margin}
          y={pt.y + margin}
          width={1}
          height={1}
          fill="#0D1B3E"
        />
      ))}
    </svg>
  );
};
