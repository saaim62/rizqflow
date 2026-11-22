import {
  CarDecisionSummary,
  DistanceCrossoverPoint,
  UserProfile,
  VehicleCandidate,
  VehicleTcoResult,
  VehicleWaterfallStep,
} from '@/types';
import { formatCompactPkr, formatPkr } from '@/lib/format';

/**
 * Calculates 5-Year Total Cost of Ownership (TCO) for a single vehicle candidate.
 */
function computeSingleVehicleTco(
  vehicle: VehicleCandidate,
  dailyKm: number,
  profile: UserProfile,
  effectiveSolarRate: number
): VehicleTcoResult {
  const fiveYearDays = 5 * 365;
  const totalKm = dailyKm * fiveYearDays;

  // 1. Fuel or Charging Cost
  let fiveYearFuelOrChargePkr = 0;
  if (vehicle.fuelType === 'petrol') {
    const kmPerLitre = vehicle.kmPerLitre && vehicle.kmPerLitre > 0 ? vehicle.kmPerLitre : 14;
    const petrolPrice = profile.petrolPricePerLitre && profile.petrolPricePerLitre > 0
      ? profile.petrolPricePerLitre
      : 322;
    fiveYearFuelOrChargePkr = (totalKm / kmPerLitre) * petrolPrice;
  } else {
    // EV or E-Scooty: charging is NEVER Rs 0 because of export opportunity cost or grid tariff
    const kwhPer100Km =
      vehicle.kwhPer100Km && vehicle.kwhPer100Km > 0
        ? vehicle.kwhPer100Km
        : vehicle.fuelType === 'e-scooty'
        ? 3.5
        : 14;
    const totalKwh = (totalKm / 100) * kwhPer100Km;
    fiveYearFuelOrChargePkr = totalKwh * effectiveSolarRate;
  }

  // 2. Depreciation
  const depPct = vehicle.fiveYearDepreciationPct ?? 35;
  const fiveYearDepreciationPkr = vehicle.pricePkr * (depPct / 100);

  // 3. Maintenance
  const annualMaint = vehicle.annualMaintenancePkr ?? 50000;
  const fiveYearMaintenancePkr = annualMaint * 5;

  // 4. Quote-based Bank EMI Interest
  let isQuoteIncomplete = false;
  let fiveYearBankInterestPkr = 0;
  let equityTiedUp = vehicle.pricePkr;

  if (vehicle.emiQuote && vehicle.emiQuote.enabled) {
    const quote = vehicle.emiQuote;
    const isDownPaymentInvalid =
      quote.downPaymentPkr === null ||
      quote.downPaymentPkr === undefined ||
      quote.downPaymentPkr < 0;
    const isInstallmentInvalid =
      quote.monthlyInstallmentPkr === null ||
      quote.monthlyInstallmentPkr === undefined ||
      quote.monthlyInstallmentPkr <= 0;
    const isTenureInvalid =
      quote.tenureMonths === null ||
      quote.tenureMonths === undefined ||
      quote.tenureMonths <= 0;

    if (isDownPaymentInvalid || isInstallmentInvalid || isTenureInvalid) {
      isQuoteIncomplete = true;
    } else {
      const totalPaid = quote.downPaymentPkr + quote.monthlyInstallmentPkr * quote.tenureMonths;
      const totalInterest = Math.max(0, totalPaid - vehicle.pricePkr);
      // FIX-2.7: For tenures > 60 months, prorate bank markup over the 5-year evaluation window.
      // Linear-proration simplification: totalInterest * Math.min(tenure, 60) / tenure
      fiveYearBankInterestPkr =
        quote.tenureMonths > 60
          ? (totalInterest * Math.min(quote.tenureMonths, 60)) / quote.tenureMonths
          : totalInterest;
      // 100% financing (downPaymentPkr === 0) is valid; equity tied up is 0
      equityTiedUp = quote.downPaymentPkr;
    }
  }

  // 5. Capital Opportunity Cost on upfront cash (default 10% p.a. compounded over 5 years)
  const oppRate = (profile.opportunityCostReturnPct ?? 10) / 100;
  const oppMultiplier = Math.pow(1 + oppRate, 5) - 1;
  const fiveYearOpportunityCostPkr = equityTiedUp * oppMultiplier;

  // Sum total 5-year cost
  const totalFiveYearCostPkr = Math.round(
    fiveYearFuelOrChargePkr +
      fiveYearDepreciationPkr +
      fiveYearMaintenancePkr +
      fiveYearBankInterestPkr +
      fiveYearOpportunityCostPkr
  );
  const realCostPerMonthPkr = Math.round(totalFiveYearCostPkr / 60);

  // Running 5-step waterfall
  let run = 0;
  const fuelLabel =
    vehicle.fuelType === 'petrol'
      ? `Fuel (${vehicle.kmPerLitre || 14} km/L @ Rs ${profile.petrolPricePerLitre || 322})`
      : `Charging (@ Rs ${effectiveSolarRate}/kWh opportunity cost)`;

  const waterfall: VehicleWaterfallStep[] = [
    {
      label: fuelLabel,
      amountPkr: Math.round(fiveYearFuelOrChargePkr),
      runningTotalPkr: (run += Math.round(fiveYearFuelOrChargePkr)),
    },
    {
      label: `5-Yr Depreciation (${depPct}%)`,
      amountPkr: Math.round(fiveYearDepreciationPkr),
      runningTotalPkr: (run += Math.round(fiveYearDepreciationPkr)),
    },
    {
      label: '5-Yr Routine Maintenance',
      amountPkr: Math.round(fiveYearMaintenancePkr),
      runningTotalPkr: (run += Math.round(fiveYearMaintenancePkr)),
    },
    {
      label: vehicle.emiQuote?.enabled ? 'Bank Financing Markup' : 'No Bank Financing',
      amountPkr: Math.round(fiveYearBankInterestPkr),
      runningTotalPkr: (run += Math.round(fiveYearBankInterestPkr)),
    },
    {
      label: `Capital Opportunity Cost (${Math.round(oppRate * 100)}% p.a.)`,
      amountPkr: Math.round(fiveYearOpportunityCostPkr),
      runningTotalPkr: (run += Math.round(fiveYearOpportunityCostPkr)),
    },
  ];

  return {
    vehicleId: vehicle.id,
    name: vehicle.name,
    fuelType: vehicle.fuelType,
    isQuoteIncomplete,
    fiveYearFuelOrChargePkr: Math.round(fiveYearFuelOrChargePkr),
    fiveYearDepreciationPkr: Math.round(fiveYearDepreciationPkr),
    fiveYearMaintenancePkr: Math.round(fiveYearMaintenancePkr),
    fiveYearBankInterestPkr: Math.round(fiveYearBankInterestPkr),
    fiveYearOpportunityCostPkr: Math.round(fiveYearOpportunityCostPkr),
    totalFiveYearCostPkr,
    realCostPerMonthPkr,
    waterfall,
  };
}

/**
 * Evaluates the full Car Decision Map across all configured vehicles.
 */
export function evaluateCarDecision(profile: UserProfile): CarDecisionSummary {
  // Determine effective electricity rate for EV charging based on solar tariff mode
  let effectiveSolarRatePerKwh = profile.gridRatePerKwh || 55;
  if (profile.solarKw > 0) {
    if (profile.solarTariffMode === 'net-metering-legacy') {
      effectiveSolarRatePerKwh = 26; // Lost export tariff credit
    } else if (profile.solarTariffMode === 'net-billing-2026') {
      effectiveSolarRatePerKwh = 11; // 2026 gross-billing buyback rate
    } else {
      effectiveSolarRatePerKwh = profile.gridRatePerKwh || 55;
    }
  }

  const vehicles = profile.vehicles && profile.vehicles.length > 0 ? profile.vehicles : [];

  // Compute 5-year TCO for each candidate
  const results: VehicleTcoResult[] = vehicles.map((v) =>
    computeSingleVehicleTco(v, profile.dailyCommuteKm, profile, effectiveSolarRatePerKwh)
  );

  // Sort by lowest 5-year total cost
  const sorted = [...results].sort((a, b) => a.totalFiveYearCostPkr - b.totalFiveYearCostPkr);
  const cheapest = sorted.length > 0 ? sorted[0] : null;
  const runnerUp = sorted.length > 1 ? sorted[1] : null;

  // Verdict sentence
  let verdictSentence = 'Add vehicles to evaluate your 5-year total cost of ownership.';
  if (cheapest) {
    if (runnerUp) {
      const diff = runnerUp.totalFiveYearCostPkr - cheapest.totalFiveYearCostPkr;
      verdictSentence = `Buy / Keep ${cheapest.name} — lowest 5-year TCO by ${formatCompactPkr(
        diff
      )} compared to ${runnerUp.name} (${formatPkr(cheapest.realCostPerMonthPkr)}/mo true cost).`;
    } else {
      verdictSentence = `${cheapest.name} has a 5-year true cost of ${formatCompactPkr(
        cheapest.totalFiveYearCostPkr
      )} (${formatPkr(cheapest.realCostPerMonthPkr)}/mo).`;
    }
  }

  // Generate 5–100 km/day crossover series
  const crossoverSeries: DistanceCrossoverPoint[] = [];
  let previousCheapestId: string | null = null;
  let crossoverKmPerDay: number | null = null;

  for (let km = 5; km <= 100; km += 5) {
    const point: DistanceCrossoverPoint = { kmPerDay: km };
    let currentMinCost = Infinity;
    let currentCheapestId: string | null = null;

    for (const v of vehicles) {
      const tco = computeSingleVehicleTco(v, km, profile, effectiveSolarRatePerKwh);
      point[v.id] = tco.realCostPerMonthPkr;
      if (tco.realCostPerMonthPkr < currentMinCost) {
        currentMinCost = tco.realCostPerMonthPkr;
        currentCheapestId = v.id;
      }
    }

    if (previousCheapestId && currentCheapestId && currentCheapestId !== previousCheapestId && crossoverKmPerDay === null) {
      crossoverKmPerDay = km;
    }
    previousCheapestId = currentCheapestId;
    crossoverSeries.push(point);
  }

  return {
    // Ranked order (lowest 5-year TCO first) is the single source of truth:
    // the podium, the leaderboard and the verdict must never disagree.
    // (Previously this returned the unsorted array and the podium crowned
    // whichever vehicle happened to be first in the profile.)
    results: sorted,
    cheapestVehicleId: cheapest ? cheapest.vehicleId : null,
    verdictSentence,
    crossoverKmPerDay,
    crossoverSeries,
    effectiveSolarRatePerKwh,
  };
}

export { applyCarSavingsToPlan } from '@/lib/engine/wealthEngine';
