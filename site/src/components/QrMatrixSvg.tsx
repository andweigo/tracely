import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QrMatrixSvgProps {
  value: string;
  size?: number;
  darkColor?: string;
  lightColor?: string;
  label: string;
  className?: string;
}

export const QrMatrixSvg: React.FC<QrMatrixSvgProps> = ({
  value,
  size = 160,
  darkColor = '#09234D',
  lightColor = '#FFFFFF',
  label,
  className,
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: size * 2,
      color: {
        dark: darkColor,
        light: lightColor,
      },
    })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [value, size, darkColor, lightColor]);

  if (!dataUrl) {
    return (
      <div
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: 12,
          background: '#F1F5F9',
          display: 'grid',
          placeItems: 'center',
          fontSize: 11,
          color: '#64748B',
        }}
        aria-label={label}
      >
        Generating QR…
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={label}
      className={className}
      style={{ display: 'block', borderRadius: 10 }}
    />
  );
};
