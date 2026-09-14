import type { ReactNode } from 'react';

/**
 * The tags messages use around data, for `t.rich` — so a name or a figure
 * inside a sentence is marked up the same way in every screen.
 *
 * `<bdi>`: data inside a sentence — a name, a date, a search term — isolated,
 * so Arabic text around it can't reorder it. `<num>`: a figure, isolated too.
 */
export const bdi = (chunks: ReactNode) => <bdi>{chunks}</bdi>;
export const num = (chunks: ReactNode) => <bdi className="num">{chunks}</bdi>;
/** `<b>`: the figure a sentence is about — "Showing **1–20** of 312 orders". */
export const b = (chunks: ReactNode) => (
  <span className="num font-medium text-foreground">{chunks}</span>
);
