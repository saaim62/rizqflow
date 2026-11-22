import { describe, it, expect } from 'vitest';
import { renderSnapshotCanvas, SnapshotCanvasContextLike } from '@/components/ui/ShareSnapshotModal';
import { PlanSummary, UserProfile } from '@/types';

interface FillTextCall {
  text: string;
  x: number;
  y: number;
  fillStyle: string;
  font: string;
}

function createMockCanvasContext(): {
  ctx: SnapshotCanvasContextLike;
  textCalls: FillTextCall[];
} {
  const textCalls: FillTextCall[] = [];
  let currentFillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  let currentStrokeStyle: string | CanvasGradient | CanvasPattern = '#000000';
  let currentFont = '10px sans-serif';
  let currentLineWidth = 1;

  const mockGradient = {
    addColorStop: () => {},
  } as unknown as CanvasGradient;

  const ctx: SnapshotCanvasContextLike = {
    get fillStyle() {
      return currentFillStyle;
    },
    set fillStyle(val: string | CanvasGradient | CanvasPattern) {
      currentFillStyle = val;
    },
    get strokeStyle() {
      return currentStrokeStyle;
    },
    set strokeStyle(val: string | CanvasGradient | CanvasPattern) {
      currentStrokeStyle = val;
    },
    get font() {
      return currentFont;
    },
    set font(val: string) {
      currentFont = val;
    },
    get lineWidth() {
      return currentLineWidth;
    },
    set lineWidth(val: number) {
      currentLineWidth = val;
    },
    createLinearGradient: () => mockGradient,
    createRadialGradient: () => mockGradient,
    fillRect: () => {},
    strokeRect: () => {},
    roundRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    fillText: (text: string, x: number, y: number) => {
      textCalls.push({
        text,
        x,
        y,
        fillStyle: typeof currentFillStyle === 'string' ? currentFillStyle : 'gradient/pattern',
        font: currentFont,
      });
    },
  };

  return { ctx, textCalls };
}

const sampleProfile: UserProfile = {
  age: 30,
  retirementAge: 55,
  monthlyIncomePkr: 500000,
  monthlyExpensesPkr: 200000,
  monthlyInvestPkr: 300000,
  lumpSumPkr: 1500000,
  currentCashReservePkr: 500000,
  monthlyDebtPkr: 0,
  goldPerTolaPkr: 376336,
  usdToPkr: 276.51,
  petrolPricePerLitre: 322,
  gridRatePerKwh: 65,
  hasSolar: true,
  solarCapacityKw: 10,
  isFiler: true,
  taxRate: 0.15,
  assetBuckets: [],
  lifeGoals: [],
  vehicles: [],
};

const samplePlan: PlanSummary = {
  freedomDateLabel: 'Nov 2035',
  freedomAge: 39,
  freedomYear: 2035,
  finalRealTodaysPkr: 45000000,
  finalNominalPkr: 120000000,
  initialMonthlyNetDividendPkr: 150000,
  finalWealthGoldTolas: 119.5,
  finalWealthUsd: 162740,
  monthlySafeIncomePkr: 180000,
  emergencyFundPkr: 600000,
  taxRatePct: 15,
  isFreedomAchieved: true,
  totalMonthlyContributionsPkr: 300000,
  yearsToSimulate: 25,
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

function contrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 1;
  const l1 = relativeLuminance(rgb1);
  const l2 = relativeLuminance(rgb2);
  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (brighter + 0.05) / (darker + 0.05);
}

describe('FIX-1.5: ShareSnapshotModal Canvas Export Contrast & Fills', () => {
  it('asserts zero #0C0C0F text fills remain in rendered canvas text calls', () => {
    const { ctx, textCalls } = createMockCanvasContext();
    renderSnapshotCanvas(ctx, samplePlan, sampleProfile, false);

    expect(textCalls.length).toBeGreaterThan(0);

    const darkTextFills = textCalls.filter(
      (call) => call.fillStyle.toLowerCase() === '#0c0c0f'
    );

    expect(darkTextFills).toEqual([]);
  });

  it('verifies "Rizq", freedom date, and real wealth render in #F5F1E6 cream ink', () => {
    const { ctx, textCalls } = createMockCanvasContext();
    renderSnapshotCanvas(ctx, samplePlan, sampleProfile, false);

    const rizqCall = textCalls.find((c) => c.text === 'Rizq');
    expect(rizqCall).toBeDefined();
    expect(rizqCall?.fillStyle.toUpperCase()).toBe('#F5F1E6');

    const freedomCall = textCalls.find((c) => c.text === samplePlan.freedomDateLabel);
    expect(freedomCall).toBeDefined();
    expect(freedomCall?.fillStyle.toUpperCase()).toBe('#F5F1E6');

    const realWealthCall = textCalls.find((c) => c.text.includes('Lac'));
    expect(realWealthCall).toBeDefined();
    expect(realWealthCall?.fillStyle.toUpperCase()).toBe('#F5F1E6');
  });

  it('verifies masked mode renders masked text in #F5F1E6 without #0C0C0F', () => {
    const { ctx, textCalls } = createMockCanvasContext();
    renderSnapshotCanvas(ctx, samplePlan, sampleProfile, true);

    const maskedCall = textCalls.find((c) => c.text === 'Rs •••••');
    expect(maskedCall).toBeDefined();
    expect(maskedCall?.fillStyle.toUpperCase()).toBe('#F5F1E6');

    const darkTextFills = textCalls.filter(
      (call) => call.fillStyle.toLowerCase() === '#0c0c0f'
    );
    expect(darkTextFills).toEqual([]);
  });

  it('audits all canvas text fills for contrast >= 3:1 against their background', () => {
    const { ctx, textCalls } = createMockCanvasContext();
    renderSnapshotCanvas(ctx, samplePlan, sampleProfile, false);

    // Canvas background is obsidian #050505; card bento is #0C0C0F
    const bgObsidian = '#050505';
    const bgCard = '#0C0C0F';

    for (const call of textCalls) {
      if (call.fillStyle.startsWith('#')) {
        const ratioObsidian = contrastRatio(call.fillStyle, bgObsidian);
        const ratioCard = contrastRatio(call.fillStyle, bgCard);
        const minRatio = Math.min(ratioObsidian, ratioCard);

        expect(
          minRatio,
          `Text "${call.text}" color ${call.fillStyle} has contrast ratio ${minRatio.toFixed(2)}:1 (< 3:1)`
        ).toBeGreaterThanOrEqual(3.0);
      }
    }
  });
});
