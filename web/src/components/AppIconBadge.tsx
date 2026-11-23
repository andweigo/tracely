import React, { useState } from 'react';

interface AppIconBadgeProps {
  readonly size?: number;
  readonly animated?: boolean;
  readonly interactive?: boolean;
  readonly showBackground?: boolean;
}

/**
 * Official Tracely brand logo image (synced with mobile/src/assets/app-icon.png).
 */
export const AppIconBadge: React.FC<AppIconBadgeProps> = ({
  size = 44,
  animated = true,
  interactive = false,
  showBackground = true,
}) => {
  const [replayKey, setReplayKey] = useState(0);
  const radius = showBackground ? Math.round(size * 0.24) : 0;

  const img = (
    <img
      key={replayKey}
      src="/tracely-logo.png"
      alt="Tracely logo"
      aria-label="Tracely app icon"
      width={size}
      height={size}
      className={animated ? 'dt-anim-sheet' : undefined}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        objectFit: 'contain',
        display: 'block',
        flexShrink: 0,
      }}
    />
  );

  if (!interactive) return img;

  return (
    <button
      type="button"
      className="brand-badge-btn"
      onClick={() => setReplayKey((k) => k + 1)}
      aria-label="Tracely app icon"
      title="Tracely"
    >
      {img}
    </button>
  );
};
