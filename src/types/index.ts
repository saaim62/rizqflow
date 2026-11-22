export type StockGrade = 'A' | 'B' | 'C';
export type UserRole = 'student' | 'salaried' | 'business' | 'freelancer';
export type TaxStatus = 'filer' | 'non-filer';
export type SolarTariffMode = 'none' | 'net-billing-2026' | 'net-metering-legacy';

export interface PricePoint {
  date: string;
  price: number;
}

export interface StreakStats {
  currentStreak: number; // +N green days straight, -N red days straight
  longestUpStreak: number;
  longestDownStreak: number;
  changeToday: number;
  changeTodayPct: number;
  drawdownFromPeakPct: number;
  isSipDipZone: boolean;
}

export interface MetalAsset {
  id: 'gold-24k' | 'silver-24k';
  name: string;
  unit: string;
  currentPrice: number;
  history: PricePoint[];
  streak: StreakStats;
  insight: string;
}

export interface PsxStock {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  dividendYieldPct: number;
  payoutMonths: number[];
  isShariah: boolean;
  grade: StockGrade;
  gradeReason: string;
  trapWarning?: string;
  beginnerSummary: string;
  history: PricePoint[];
  streak: StreakStats;
}

export interface ExpenseBreakdown {
  fuelAndCommute: number;
  utilitiesAndInternet: number;
  groceriesAndFood: number;
  rentOrHousing: number;
  familyAndOther: number;
}

// --- WealthFlow Compounder Engine Types ---
export interface AssetBucket {
  id: 'psx-dividends' | 'gold' | 'real-estate' | 'money-market' | 'cash';
  label: string;
  currentValuePkr: number;
  monthlySplitPct: number; // 0..100 across buckets
  expectedAnnualReturnPct: number;
}

export interface LifeGoal {
  id: string;
  name: string; // e.g., "Paragon City House Construction", "Wedding", "EV Upgrade"
  targetAge: number;
  costInTodaysPkr: number;
}

export interface GoalOutcome {
  goalId: string;
  name: string;
  targetAge: number;
  inflatedCostPkr: number;
  trueOpportunityCostAtRetirementPkr: number; // What that cash would have compounded to
  funded: boolean;
  shortfallPkr: number;
}

// --- Car Decision Map 5-Year TCO Engine Types ---
export interface BankEmiQuote {
  enabled: boolean;
  downPaymentPkr: number;
  monthlyInstallmentPkr: number;
  tenureMonths: number;
}

export interface VehicleCandidate {
  id: string;
  name: string;
  fuelType: 'petrol' | 'ev' | 'e-scooty';
  pricePkr: number; // Current resale value if owned, or purchase price
  isCurrentVehicle?: boolean;
  kmPerLitre?: number; // petrol
  kwhPer100Km?: number; // ev / e-scooty
  fiveYearDepreciationPct: number;
  annualMaintenancePkr: number;
  emiQuote?: BankEmiQuote;
}

export interface VehicleWaterfallStep {
  label: string; // Fuel/Charging, Depreciation, Maintenance, Bank Interest, Opportunity Cost
  amountPkr: number;
  runningTotalPkr: number;
}

export interface VehicleTcoResult {
  vehicleId: string;
  name: string;
  fuelType: 'petrol' | 'ev' | 'e-scooty';
  isQuoteIncomplete: boolean;
  fiveYearFuelOrChargePkr: number;
  fiveYearDepreciationPkr: number;
  fiveYearMaintenancePkr: number;
  fiveYearBankInterestPkr: number;
  fiveYearOpportunityCostPkr: number;
  totalFiveYearCostPkr: number;
  realCostPerMonthPkr: number;
  waterfall: VehicleWaterfallStep[];
}

export interface DistanceCrossoverPoint {
  kmPerDay: number;
  [vehicleId: string]: number;
}

export interface CarDecisionSummary {
  results: VehicleTcoResult[];
  cheapestVehicleId: string | null;
  verdictSentence: string; // e.g., "Keep/Buy X — cheapest by Rs 4.36 Lac over 5 years"
  crossoverKmPerDay: number | null;
  crossoverSeries: DistanceCrossoverPoint[];
  effectiveSolarRatePerKwh: number;
}

// --- Master Profile & Plan Summary ---
export interface UserProfile {
  role: UserRole;
  gender: 'male' | 'female';
  age: number;
  retirementAge: number;
  maritalStatus: 'unmarried' | 'married';
  familyMembers: number;
  isBreadwinner: boolean;
  monthlyIncomePkr: number;
  annualSalaryRaisePct: number;
  lumpSumPkr: number;
  monthlyInvestPkr: number;
  currentCashReservePkr: number;
  expenses: ExpenseBreakdown;
  taxStatus: TaxStatus;
  shariahOnly: boolean;
  includeZakat: boolean;
  reinvestDividends: boolean;
  inflationAdjusted: boolean;
  annualInflationPct: number;
  dividendGrowthPct: number;
  opportunityCostReturnPct: number; // Default 10% for car TCO
  usdToPkr: number; // Default 276.5
  goldPerTolaPkr: number; // Default 379836
  petrolPricePerLitre: number; // Default 322 (OGRA, Nov 2026)
  gridRatePerKwh: number; // Default 55
  solarKw: number;
  solarTariffMode: SolarTariffMode; // 'net-metering-legacy' (Rs 26) | 'net-billing-2026' (Rs 11) | 'none' (Rs 55)
  dailyCommuteKm: number;
  assetBuckets: AssetBucket[];
  lifeGoals: LifeGoal[];
  vehicles: VehicleCandidate[];
  // Item-level detail (additive-optional, NOTES #23): the buckets above say
  // HOW money is split; these say WHAT is actually held / owed, item by
  // item — gold weight & purity, fund units & NAV, plot details, individual
  // bank balances, stock holdings, and debts (e.g. a Splitwise balance).
  holdings?: HoldingItem[];
  liabilities?: LiabilityItem[];
  appliedCarSwapKey?: string;
  currentVehicleType?: string;
  currentVehicleResalePkr?: number;
}

export type HoldingKind = 'gold' | 'fund' | 'real-estate' | 'bank' | 'stock' | 'other';

export interface HoldingItem {
  id: string;
  kind: HoldingKind;
  label: string; // e.g. "21K jewellery", "KMIF", "DHA plot", "Meezan account"
  valuePkr: number;
  quantity?: number; // tola (gold) / units (fund) / shares (stock)
  unitLabel?: string; // 'tola' | 'units' | 'shares'
  unitPricePkr?: number; // NAV per unit / price per share / rate per tola
  purityKarat?: number; // gold only: 24 / 22 / 21 / 18
  details?: string; // plot size & location, bank name, free notes
}

export type LiabilityCategory =
  | 'mortgage'
  | 'vehicle-loan'
  | 'education-loan'
  | 'personal-loan'
  | 'credit-card'
  | 'bnpl'
  | 'medical'
  | 'tax'
  | 'family-loan'
  | 'other';

export type LiabilityKind = 'amortizing' | 'revolving' | 'balloon';

/**
 * A liability (NOTES #23 simple item, extended NOTES #45 with a real
 * due-date schedule). The scheduled shape is: `name`, `category`, `kind`,
 * `balancePkr`, `aprPct` (0 allowed — family loans are often interest-free),
 * plus the kind-specific field (`monthlyPaymentPkr` for amortizing,
 * `minPaymentPctOfBalance` for revolving, `dueDateISO` for balloon; an
 * amortizing `dueDateISO` is an optional term-end note).
 *
 * Legacy NOTES #23 items carry only `label` + `amountPkr` and NO schedule
 * fields: they remain a position (counted in the net liquid position via
 * `totalLiabilitiesPkr`) but are NOT scheduled by the engine — scheduling
 * requires an explicit `kind` + `balancePkr`. All schedule fields are
 * additive-optional so legacy items stay valid without migration.
 * `label`/`amountPkr` are kept as mirrors of `name`/`balancePkr` (the
 * sanitizer syncs them) for the legacy consumers that read them.
 */
export interface Liability {
  id: string;
  name?: string; // e.g. "Family loan — return in 5 years"
  category?: LiabilityCategory;
  kind?: LiabilityKind;
  balancePkr?: number;
  aprPct?: number; // annual percentage rate; 0 allowed
  monthlyPaymentPkr?: number; // amortizing
  minPaymentPctOfBalance?: number; // revolving: % of current balance paid monthly
  dueDateISO?: string; // balloon due date (YYYY-MM-DD); amortizing: optional term end
  // Legacy NOTES #23 fields (mirrors of name / balancePkr)
  label?: string; // e.g. "Splitwise balance owed", "Credit card"
  amountPkr?: number;
  details?: string;
}

export type LiabilityItem = Liability;

/** Per-liability outcome of the engine's debt schedule (NOTES #45). */
export interface LiabilityPayoffInfo {
  liabilityId: string;
  name: string;
  payoffMonth: number | null; // 1-based month from projection start; null = not cleared in horizon
  totalInterestPkr: number;
  totalPaidPkr: number;
  negativeAmortization: boolean;
}

/** A scheduled outflow the portfolio could not fully cover (NOTES #45). */
export interface LiabilityShortfall {
  liabilityId: string;
  name: string;
  month: number; // 1-based month from projection start
  duePkr: number;
  shortfallPkr: number;
}

export interface WealthTimelinePoint {
  age: number;
  year: number;
  nominalPortfolioPkr: number;
  realTodaysPkr: number;
  monthlyNetDividendPkr: number;
  realMonthlyDividendPkr: number;
  monthlyExpensesPkr: number;
  goalWithdrawnPkr: number;
  liabilityPaidPkr?: number; // NOTES #45: scheduled liability outflows this year
  liabilityBalancePkr?: number; // NOTES #45: scheduled liabilities outstanding at year end
}

export interface ExpenseCoverageStep {
  label: string;
  monthlyCostPkr: number;
  coveredPkr: number;
  coveragePct: number;
  isFullyCovered: boolean;
}

export interface PlanSummary {
  emergencyFundTargetPkr: number;
  emergencyFundGapPkr: number;
  blendedGrossYieldPct: number;
  taxRatePct: number;
  initialMonthlyGrossDividendPkr: number;
  initialMonthlyNetDividendPkr: number;
  nonFilerTaxPenaltyYearlyPkr: number;
  freedomDateLabel: string;
  freedomAge: number | null;
  finalNominalWealthPkr: number;
  finalRealTodaysPkr: number;
  finalWealthUsd: number;
  finalWealthGoldTolas: number;
  safeMonthlyIncome4PctTodaysPkr: number;
  goalOutcomes: GoalOutcome[];
  // NOTES #45 (additive, present only when scheduled liabilities exist):
  liabilityWarnings?: string[];
  liabilityShortfalls?: LiabilityShortfall[];
  liabilityPayoffs?: LiabilityPayoffInfo[];
  totalLiabilityPaymentsPkr?: number;
  monthlyPayoutCalendar: { month: string; amountPkr: number }[];
  expenseWaterfall: ExpenseCoverageStep[];
  timeline: WealthTimelinePoint[];
  recommendedAllocations: {
    stock: PsxStock;
    weightPct: number;
    amountPkr: number;
    annualNetDivPkr: number;
  }[];
  carDecision: CarDecisionSummary;
}

// --- Phase 3 Additive Engine Types ---
export interface PsxExecutionItem {
  ticker: string;
  name: string;
  price: number;
  weightPct: number;
  targetAmountPkr: number;
  shares: number;
  actualSpentPkr: number;
  feePkr: number;
  remainderPkr: number;
  effectiveYieldPct: number;
}

export interface PsxExecutionSheet {
  items: PsxExecutionItem[];
  totalTargetPkr: number;
  totalSpentPkr: number;
  totalFeesPkr: number;
  totalRemainderPkr: number;
  totalShares: number;
}

export interface DipStrategyResult {
  dcaShares: number;
  dcaAvgCost: number;
  dcaTotalInvested: number;
  dipShares: number;
  dipAvgCost: number;
  dipTotalInvested: number;
  sharesLiftPct: number;
  costBasisReductionPct: number;
  yieldLiftPct: number;
  verdict: string;
}

export interface MarketRatesConfig {
  petrolPricePerLitre: number;
  goldPerTolaPkr: number;
  usdToPkr: number;
  gridRatePerKwh: number;
  kse100Index: number;
  solarNetMeteringLegacyRate: number;
  solarNetBilling2026Rate: number;
  lastUpdated: string;
}

// --- Phase 4 Additive Portfolio Transfer Types ---
export interface PortfolioExportSingle {
  app: 'RizqFlow';
  kind: 'portfolio-export';
  formatVersion: 1;
  exportedAt: string;
  name: string;
  profile: UserProfile;
}

export interface PortfolioExportAllItem {
  name: string;
  profile: UserProfile;
}

export interface PortfolioExportAll {
  app: 'RizqFlow';
  kind: 'portfolio-export';
  formatVersion: 1;
  exportedAt: string;
  portfolios: PortfolioExportAllItem[];
}

export type PortfolioExportEnvelope = PortfolioExportSingle | PortfolioExportAll;

export type MappingConfidence = 'high' | 'medium' | 'low';

export interface FieldMappingEntry {
  source: string;
  target: string;
  confidence: MappingConfidence;
  note: string;
}

export interface ForeignMappingResult {
  profile: UserProfile;
  mapping: FieldMappingEntry[];
  unmapped: string[];
}

