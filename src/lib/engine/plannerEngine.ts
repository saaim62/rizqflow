/**
 * Re-exports from wealthEngine for convenient access across planner components.
 */
export {
  applyCarSavingsToPlan,
  calculateExecutionSheet,
  calculateLifePlan,
  netLiquidReservePkr,
  normalizeAssetSplits,
  selectStockPortfolio,
  totalHoldingsPkr,
  totalLiabilitiesPkr,
} from '@/lib/engine/wealthEngine';
export {
  balloonDueMonth,
  buildLiabilitySchedule,
  isScheduledLiability,
  liabilityBalancePkr,
  liabilityDisplayName,
  summarizeLiability,
} from '@/lib/engine/debtSchedule';
export type { ProjectionStart } from '@/lib/engine/debtSchedule';
