import React from 'react';
import { Clock, FileCheck2, FolderKanban, Layers, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  ConfidentialityTier,
  DocumentCopyFormat,
  SlaState,
} from '../domain/types';

export const SlaBadge: React.FC<{ state: SlaState; suffix?: string }> = ({ state, suffix }) => {
  const label =
    state === 'overdue'
      ? `Overdue${suffix ? ` · ${suffix}` : ''}`
      : state === 'at_risk'
        ? `Due soon${suffix ? ` · ${suffix}` : ''}`
        : `On track${suffix ? ` · ${suffix}` : ''}`;

  const cls =
    state === 'overdue'
      ? 'pill pill-rose'
      : state === 'at_risk'
        ? 'pill pill-amber'
        : 'pill pill-emerald';

  return (
    <span className={cls}>
      {state === 'overdue' ? <ShieldAlert size={11} /> : <Clock size={11} />}
      <span>{label}</span>
    </span>
  );
};

export const CopyFormatBadge: React.FC<{ format: DocumentCopyFormat }> = ({ format }) => {
  if (format === 'hard_copy') {
    return (
      <span className="pill pill-amber">
        <FolderKanban size={11} />
        <span>Hard Copy</span>
      </span>
    );
  }
  if (format === 'hybrid') {
    return (
      <span className="pill pill-indigo">
        <Layers size={11} />
        <span>Hard + Soft Copy</span>
      </span>
    );
  }
  return (
    <span className="pill pill-navy">
      <FileCheck2 size={11} />
      <span>Soft Copy</span>
    </span>
  );
};

export const TierBadge: React.FC<{ tier: ConfidentialityTier }> = ({ tier }) => {
  if (tier === 'confidential') {
    return (
      <span className="pill pill-rose">
        <Lock size={11} />
        <span>Confidential</span>
      </span>
    );
  }
  if (tier === 'restricted') {
    return (
      <span className="pill pill-amber">
        <ShieldCheck size={11} />
        <span>Restricted</span>
      </span>
    );
  }
  return <span className="pill pill-slate">Standard</span>;
};
