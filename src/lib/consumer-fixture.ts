// Static chart fixture for Teammate B's standalone demo. Replace at A's integration boundary.
// These are illustrative slot averages, not weather-derived or utility generation.
export const outlookFixture = [
  [0,3],[0,3],[0,4],[0,4],[0,3],[0,3],[0,2],[0,2],[0,3],[0,3],[0,4],[0,4],
  [0,4],[1,3],[2,3],[3,4],[4,4],[5,3],[6,3],[7,4],[8,4],[9,5],[10,5],[11,5],
  [12,5],[12,6],[13,6],[13,5],[12,5],[11,4],[10,4],[8,5],[6,5],[4,4],[3,4],[1,3],
  [0,3],[0,4],[0,4],[0,5],[0,5],[0,4],[0,4],[0,3],[0,3],[0,4],[0,4],[0,3],
].map(([solarKW, windKW], slot) => ({ slot, solarKW, windKW, renewableKW: solarKW + windKW }));
export type OutlookSlot = (typeof outlookFixture)[number];
