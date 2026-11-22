/**
 * Curated vehicle ground truth (NOTES #46 — AI Assist v2).
 *
 * Stamped-data discipline, same as src/lib/marketRates.ts: every
 * entry carries the date it was compiled and a named source that was
 * actually consulted when the entry was written (see the per-entry
 * comments). The predict route checks this table BEFORE any model
 * call for car-price / car-efficiency / car-depreciation; a hit is
 * returned instantly and labelled as SOURCED DATA — never as an
 * "AI estimate" (Gate 6 Amendment 3 labelling discipline: model
 * output is never presented as sourced, sourced data never as live).
 *
 * Prices are a single representative figure per model (base-variant
 * ex-factory for cars sold new, or the cited used-market figure) —
 * they are a stamped snapshot as of DATA_AS_OF, not live prices.
 * Depreciation is intentionally NOT seeded: no consulted source
 * publishes a defensible 5-year % per model, so the field is omitted
 * rather than guessed (the model path still answers it).
 */

import {
  PredictionResult,
  PredictionType,
  clampPrediction,
  deriveEvEfficiencyKwhPer100Km,
} from '@/lib/aiPredictions';

export const VEHICLE_GROUND_TRUTH_AS_OF = '2026-11-23';

export type GroundTruthType = 'car-price' | 'car-efficiency' | 'car-depreciation';

export interface VehicleGroundTruthEntry {
  /** Display name used in reasoning strings. */
  name: string;
  /** All tokens (lowercase) must appear as whole words in the queried name. */
  matchTokens: string[];
  fuelType: 'petrol' | 'ev' | 'e-scooty';
  pricePkr?: number;
  /** Petrol efficiency, km per litre (city figure from the source). */
  efficiencyKmPerLitre?: number;
  /** EV rated specs — efficiency is DERIVED from these in code. */
  batteryKwh?: number;
  ratedRangeKm?: number;
  /** Pre-derived EV efficiency, only when specs are not carried. */
  efficiencyKwhPer100Km?: number;
  depreciationPct?: number;
  source: string;
  sourceUrl: string;
  note: string;
}

export const VEHICLE_GROUND_TRUTH: VehicleGroundTruthEntry[] = [
  {
    name: 'Nissan Leaf (40 kWh)',
    matchTokens: ['nissan', 'leaf'],
    fuelType: 'ev',
    // PakWheels Nissan Leaf page (consulted 23 Nov 2026): used Leaf
    // range PKR 5,550,000–6,800,000; the "Nissan Leaf EV" variant is
    // listed at PKR 6,245,000. Battery capacity 40–62 kWh on the same
    // page; a PakWheels used listing for a 2022 40.0 kWh Leaf states
    // 275 km range — efficiency derived in code: 40/275×100 ≈ 14.5.
    pricePkr: 6245000,
    batteryKwh: 40,
    ratedRangeKm: 275,
    source: 'PakWheels',
    sourceUrl: 'https://www.Pakwheels.com/new-cars/nissan/leaf/',
    note: 'Used-market variant price (Leaf EV); range from a PakWheels 40 kWh listing.',
  },
  {
    name: 'Changan Alsvin',
    matchTokens: ['changan', 'alsvin'],
    fuelType: 'petrol',
    // PakWheels Changan Alsvin page (consulted 23 Nov 2026): ex-factory
    // PKR 4,189,000 (1.3L MT Comfort) to PKR 4,999,000 (Black Edition).
    // PakWheels City-vs-Alsvin comparison: Alsvin city mileage 12 km/L.
    pricePkr: 4189000,
    efficiencyKmPerLitre: 12,
    source: 'PakWheels',
    sourceUrl: 'https://www.pakwheels.com/new-cars/changan/alsvin/',
    note: 'Base variant 1.3L MT Comfort ex-factory; city mileage from PakWheels comparison data.',
  },
  {
    name: 'Yadea M3',
    matchTokens: ['yadea', 'm3'],
    fuelType: 'e-scooty',
    // PakWheels Yadea M3 page (consulted 23 Nov 2026): price
    // PKR 174,000; battery capacity 1.38 kWh; range 80 km.
    // Efficiency derived in code: 1.38/80×100 = 1.725 kWh/100km.
    pricePkr: 174000,
    batteryKwh: 1.38,
    ratedRangeKm: 80,
    source: 'PakWheels',
    sourceUrl: 'https://www.pakwheels.com/bikes/yadea/m3/',
    note: 'Official listed price; 60V 23Ah graphene battery, 80 km rated range.',
  },
  {
    name: 'Honda City',
    matchTokens: ['honda', 'city'],
    fuelType: 'petrol',
    // PakWheels Honda City page (consulted 23 Nov 2026): ex-factory
    // PKR 4,737,000 (1.2L CVT) to PKR 6,149,000 (1.5L Aspire S CVT).
    // PakWheels City-vs-Corolla comparison: City city mileage 14 km/L.
    pricePkr: 4737000,
    efficiencyKmPerLitre: 14,
    source: 'PakWheels',
    sourceUrl: 'https://www.pakwheels.com/new-cars/honda/city/',
    note: 'Base variant 1.2L CVT ex-factory; city mileage from PakWheels comparison data.',
  },
  {
    name: 'Toyota Corolla',
    matchTokens: ['toyota', 'corolla'],
    fuelType: 'petrol',
    // PakWheels Toyota Corolla page (consulted 23 Nov 2026): ex-factory
    // PKR 6,099,000 (Altis X Manual 1.6) to PKR 7,749,000 (Grande).
    // PakWheels City-vs-Corolla comparison: Corolla city mileage 12 km/L.
    pricePkr: 6099000,
    efficiencyKmPerLitre: 12,
    source: 'PakWheels',
    sourceUrl: 'https://www.pakwheels.com/new-cars/toyota/corolla/',
    note: 'Base variant Altis X Manual 1.6 ex-factory; city mileage from PakWheels comparison data.',
  },
  {
    name: 'Suzuki Alto',
    matchTokens: ['suzuki', 'alto'],
    fuelType: 'petrol',
    // HamariWeb Suzuki Alto 2026 page (consulted 23 Nov 2026):
    // ex-factory from PKR 2,994,861 (VXR); fuel average 18–22 km/L,
    // ~18 km/L in city driving.
    pricePkr: 2994861,
    efficiencyKmPerLitre: 18,
    source: 'HamariWeb Autos',
    sourceUrl: 'https://autos.hamariweb.com/suzuki/alto/2026/',
    note: 'Base variant VXR ex-factory; city fuel average ~18 km/L.',
  },
  {
    name: 'Suzuki Mehran',
    matchTokens: ['suzuki', 'mehran'],
    fuelType: 'petrol',
    // DealDone Pakistan used-car guide (consulted 23 Nov 2026):
    // used Mehran (2008–2019) Rs 6–13 lac, a decent car Rs 8.5–10 lac.
    // CarMatchAI 2026 budget guide (consulted 23 Nov 2026): Mehran
    // fuel average ~16 km/L (14–18 range).
    pricePkr: 900000,
    efficiencyKmPerLitre: 16,
    source: 'DealDone Pakistan / CarMatchAI',
    sourceUrl: 'https://dealdone.pk/blog/buy-used-cars-in-pakistan-2026-dealdone-pakistan',
    note: 'Used only (discontinued); representative decent-condition asking price.',
  },
  {
    name: 'Honda CG 125',
    matchTokens: ['honda', 'cg', '125'],
    fuelType: 'petrol',
    // PakWheels Honda CG 125 page (consulted 23 Nov 2026): price
    // PKR 238,500 (base kick-start); fuel average 45.0 km/L.
    pricePkr: 238500,
    efficiencyKmPerLitre: 45,
    source: 'PakWheels',
    sourceUrl: 'https://www.pakwheels.com/bikes/honda/cg-125--2/',
    note: 'Base variant ex-factory; PakWheels-rated fuel average.',
  },
  {
    name: 'Lifan V16S',
    matchTokens: ['lifan', 'v16s'],
    fuelType: 'petrol',
    // PakWheels used listing (consulted 23 Nov 2026): a 2022 Lifan
    // V16S (1,500 km, Wazirabad) listed at PKR 1,300,000 — single
    // listing basis, flagged in the note. Efficiency omitted: no
    // Pakistani source for a rated km/L figure was found.
    pricePkr: 1300000,
    source: 'PakWheels (used listing)',
    sourceUrl: 'https://www.pakwheels.com/used-bikes/lifan-250-2022-for-sale-in-wazirabad-479418',
    note: 'Single used-listing price (2022 model) — treat as indicative only.',
  },
];

function nameTokens(name: unknown): Set<string> {
  if (typeof name !== 'string') return new Set();
  return new Set(
    name
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
  );
}

export function findGroundTruthEntry(
  context: Record<string, unknown>
): VehicleGroundTruthEntry | null {
  const tokens = nameTokens(context.name);
  if (tokens.size === 0) return null;
  for (const entry of VEHICLE_GROUND_TRUTH) {
    if (entry.matchTokens.every((t) => tokens.has(t))) return entry;
  }
  return null;
}

/**
 * Resolve a prediction from the ground-truth table, or null on a
 * miss (unknown vehicle, or the entry carries no value for this
 * type). Pure and network-free so the hit path is unit-testable.
 * Hits are labelled source: 'sourced' — never "AI estimate".
 */
export function findGroundTruth(
  type: PredictionType,
  context: Record<string, unknown>
): (PredictionResult & { model: string }) | null {
  if (type !== 'car-price' && type !== 'car-efficiency' && type !== 'car-depreciation') {
    return null;
  }
  const entry = findGroundTruthEntry(context);
  if (!entry) return null;

  const base = {
    confidence: 'high' as const,
    source: 'sourced' as const,
    sourceNote: entry.source,
    model: 'Sourced data',
  };

  if (type === 'car-price') {
    if (entry.pricePkr === undefined) return null;
    return {
      ...base,
      value: clampPrediction(type, entry.pricePkr),
      reasoning: `Sourced data (as of ${VEHICLE_GROUND_TRUTH_AS_OF}, ${entry.source}): ${entry.name} — ${entry.note}`,
    };
  }

  if (type === 'car-depreciation') {
    if (entry.depreciationPct === undefined) return null;
    return {
      ...base,
      value: clampPrediction(type, entry.depreciationPct),
      reasoning: `Sourced data (as of ${VEHICLE_GROUND_TRUTH_AS_OF}, ${entry.source}): ${entry.name} — ${entry.note}`,
    };
  }

  // car-efficiency
  if (entry.fuelType === 'petrol') {
    if (entry.efficiencyKmPerLitre === undefined) return null;
    return {
      ...base,
      value: clampPrediction(type, entry.efficiencyKmPerLitre),
      reasoning: `Sourced data (as of ${VEHICLE_GROUND_TRUTH_AS_OF}, ${entry.source}): ${entry.name} rated city fuel average ${entry.efficiencyKmPerLitre} km/L.`,
    };
  }
  const derived = deriveEvEfficiencyKwhPer100Km(entry.batteryKwh, entry.ratedRangeKm);
  if (derived !== null) {
    const value = clampPrediction(type, derived);
    return {
      ...base,
      value,
      batteryKwh: entry.batteryKwh,
      ratedRangeKm: entry.ratedRangeKm,
      specSource: entry.source,
      reasoning:
        `Sourced data (as of ${VEHICLE_GROUND_TRUTH_AS_OF}, ${entry.source}): ${entry.name} rated specs ${entry.batteryKwh} kWh / ${entry.ratedRangeKm} km. ` +
        `Derived in code: ${entry.batteryKwh} kWh ÷ ${entry.ratedRangeKm} km × 100 = ${value} kWh/100km.`,
    };
  }
  if (entry.efficiencyKwhPer100Km !== undefined) {
    return {
      ...base,
      value: clampPrediction(type, entry.efficiencyKwhPer100Km),
      reasoning: `Sourced data (as of ${VEHICLE_GROUND_TRUTH_AS_OF}, ${entry.source}): ${entry.name} rated consumption ${entry.efficiencyKwhPer100Km} kWh/100km.`,
    };
  }
  return null;
}
