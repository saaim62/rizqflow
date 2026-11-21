/**
 * Pakistani Rupee (PKR), Currency, and Financial Formatting Utilities
 */

export interface FormatPkrOptions {
  showRs?: boolean;
  decimals?: number;
  compact?: boolean;
  hidden?: boolean;
}

/**
 * Format a number as Pakistani Rupee (PKR).
 * Examples:
 * - 379836 -> "Rs 379,836"
 * - -15400 -> "-Rs 15,400"
 * - options: { showRs: false } -> "379,836"
 * - options: { compact: true } -> "Rs 3.8 Lac"
 * - options: { hidden: true } -> "Rs •••••"
 */
export function formatPkr(n: number, options?: FormatPkrOptions): string {
  if (options?.hidden) {
    const showRs = options?.showRs ?? true;
    return showRs ? 'Rs •••••' : '•••••';
  }

  if (n === null || n === undefined || isNaN(n) || !isFinite(n)) {
    return (options?.showRs ?? true) ? 'Rs 0' : '0';
  }

  if (options?.compact) {
    const compactStr = formatCompactPkr(n);
    if (options.showRs === false) {
      return compactStr.replace(/^-?Rs\s?/, (match) => (match.startsWith('-') ? '-' : ''));
    }
    return compactStr;
  }

  const showRs = options?.showRs ?? true;
  const isNegative = n < 0;
  const abs = Math.abs(n);

  const decimals = options?.decimals ?? 0;
  const formatted =
    decimals > 0
      ? abs.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(abs).toLocaleString('en-US');

  const prefix = showRs ? 'Rs ' : '';
  return isNegative ? `-${prefix}${formatted}` : `${prefix}${formatted}`;
}

/**
 * Format a number as US Dollars ($).
 * Examples:
 * - 1350 -> "$ 1,350"
 * - options: { hidden: true } -> "$ •••••"
 */
export function formatUsd(
  n: number,
  options?: { hidden?: boolean; decimals?: number }
): string {
  if (options?.hidden) {
    return '$ •••••';
  }
  if (n === null || n === undefined || isNaN(n) || !isFinite(n)) {
    return '$ 0';
  }
  const isNegative = n < 0;
  const abs = Math.abs(n);
  const decimals = options?.decimals ?? 0;
  const formatted =
    decimals > 0
      ? abs.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(abs).toLocaleString('en-US');

  return isNegative ? `-$ ${formatted}` : `$ ${formatted}`;
}

/**
 * Format an amount in Gold Tolas.
 * Examples:
 * - 14.2 -> "14.2 tolas"
 * - 1 -> "1.0 tola"
 * - options: { hidden: true } -> "••••• tolas"
 */
export function formatTolas(
  n: number,
  options?: { hidden?: boolean; decimals?: number }
): string {
  if (options?.hidden) {
    return '••••• tolas';
  }
  if (n === null || n === undefined || isNaN(n) || !isFinite(n)) {
    return '0.0 tolas';
  }
  const decimals = options?.decimals ?? 1;
  const formatted = n.toFixed(decimals);
  const unit = Math.abs(n) === 1 ? 'tola' : 'tolas';
  return `${formatted} ${unit}`;
}

/**
 * Format number in compact Pakistani Rupee units:
 * >= 1 Crore (10M) -> "Rs 1.25 Cr" or "Rs 1.0 Cr"
 * >= 1 Lakh (100k) -> "Rs 30.0 Lac"
 * >= 1k -> "Rs 20.4k"
 * else -> "Rs 500"
 */
export function formatCompactPkr(n: number): string {
  if (n === null || n === undefined || isNaN(n) || !isFinite(n)) {
    return 'Rs 0';
  }
  const isNegative = n < 0;
  const abs = Math.abs(n);
  const prefix = isNegative ? '-Rs ' : 'Rs ';

  if (abs >= 10_000_000) {
    const cr = abs / 10_000_000;
    const formatted =
      cr >= 100
        ? Math.round(cr).toString()
        : cr >= 10
        ? cr.toFixed(1)
        : cr % 1 === 0
        ? cr.toFixed(1)
        : cr.toFixed(2).replace(/0$/, '');
    return `${prefix}${formatted} Cr`;
  }
  if (abs >= 100_000) {
    const lac = abs / 100_000;
    const formatted = lac >= 100 ? Math.round(lac).toString() : lac.toFixed(1);
    return `${prefix}${formatted} Lac`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    const formatted = k >= 100 ? Math.round(k).toString() : k.toFixed(1);
    return `${prefix}${formatted}k`;
  }

  return `${prefix}${Math.round(abs)}`;
}

/**
 * Format number as a percentage:
 * Examples: "+9.2%", "-12.8%", "8.5%"
 */
export function formatPct(
  n: number,
  decimalsOrOptions?: number | { decimals?: number; showPlus?: boolean },
  maybeShowPlus?: boolean
): string {
  if (n === null || n === undefined || isNaN(n) || !isFinite(n)) {
    return '0.0%';
  }
  let decimals = 1;
  let showPlus = false;

  if (typeof decimalsOrOptions === 'number') {
    decimals = decimalsOrOptions;
    showPlus = maybeShowPlus ?? false;
  } else if (decimalsOrOptions && typeof decimalsOrOptions === 'object') {
    decimals = decimalsOrOptions.decimals ?? 1;
    showPlus = decimalsOrOptions.showPlus ?? false;
  }

  const abs = Math.abs(n);
  const formatted = abs.toFixed(decimals);

  if (n > 0) {
    return `${showPlus ? '+' : ''}${formatted}%`;
  }
  if (n < 0) {
    return `-${formatted}%`;
  }
  return `${(0).toFixed(decimals)}%`;
}

/**
 * Privacy masking utility.
 * When isHidden is true, masks monetary and asset figures:
 * - "Rs 379,836" -> "Rs •••••"
 * - "-Rs 15,400" -> "-Rs •••••"
 * - "$ 1,350" -> "$ •••••"
 * - "14.2 tolas" -> "••••• tolas"
 * - "30.0 Lac" -> "•••••"
 */
export function maskAmount(formattedStr: string, isHidden: boolean): string {
  if (!isHidden) {
    return formattedStr;
  }
  if (!formattedStr) {
    return '•••••';
  }

  // Tolas check
  if (/tolas?/i.test(formattedStr)) {
    return '••••• tolas';
  }

  // Dollar check
  if (formattedStr.startsWith('$')) {
    return '$ •••••';
  }

  // Rupee check
  if (formattedStr.startsWith('-Rs ') || formattedStr.startsWith('-Rs')) {
    return '-Rs •••••';
  }
  if (formattedStr.startsWith('Rs ') || formattedStr.startsWith('Rs')) {
    return 'Rs •••••';
  }

  return '•••••';
}
