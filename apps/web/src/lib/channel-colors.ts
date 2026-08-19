import type { SalesChannel } from '@app/contracts';

/**
 * One recognisable colour per channel, so a glance at the catalog tells you
 * where something sells without reading the label. Chosen to loosely echo each
 * channel's own brand without imitating it exactly.
 */
export const CHANNEL_TONES: Record<SalesChannel, string> = {
  EASYORDERS: 'text-[#0f766e] bg-[#0f766e]/10 border-[#0f766e]/20',
  AMAZON: 'text-[#92400e] bg-[#92400e]/10 border-[#92400e]/20',
  NOON: 'text-[#a21caf] bg-[#a21caf]/10 border-[#a21caf]/20',
  SOCIAL: 'text-[#1d4ed8] bg-[#1d4ed8]/10 border-[#1d4ed8]/20',
};
