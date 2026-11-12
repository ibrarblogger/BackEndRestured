export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  nativeSymbol: string;
  decimals: number;
  symbolPosition: 'prefix' | 'suffix';
  country: string;
}

export const SUPPORTED_CURRENCIES: readonly CurrencyInfo[] = [
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs.', nativeSymbol: '₨', decimals: 2, symbolPosition: 'prefix', country: 'Pakistan' },
  { code: 'USD', name: 'US Dollar', symbol: '$', nativeSymbol: '$', decimals: 2, symbolPosition: 'prefix', country: 'United States' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', nativeSymbol: 'د.إ', decimals: 2, symbolPosition: 'prefix', country: 'United Arab Emirates' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SAR', nativeSymbol: 'ر.س', decimals: 2, symbolPosition: 'prefix', country: 'Saudi Arabia' },
  { code: 'GBP', name: 'British Pound Sterling', symbol: '£', nativeSymbol: '£', decimals: 2, symbolPosition: 'prefix', country: 'United Kingdom' },
  { code: 'EUR', name: 'Euro', symbol: '€', nativeSymbol: '€', decimals: 2, symbolPosition: 'prefix', country: 'European Union' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', nativeSymbol: '$', decimals: 2, symbolPosition: 'prefix', country: 'Canada' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', nativeSymbol: '$', decimals: 2, symbolPosition: 'prefix', country: 'Australia' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'QAR', nativeSymbol: 'ر.ق', decimals: 2, symbolPosition: 'prefix', country: 'Qatar' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD', nativeSymbol: 'د.ك', decimals: 3, symbolPosition: 'prefix', country: 'Kuwait' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'OMR', nativeSymbol: 'ر.ع.', decimals: 3, symbolPosition: 'prefix', country: 'Oman' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD', nativeSymbol: 'د.ب', decimals: 3, symbolPosition: 'prefix', country: 'Bahrain' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', nativeSymbol: '₹', decimals: 2, symbolPosition: 'prefix', country: 'India' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', nativeSymbol: '৳', decimals: 2, symbolPosition: 'prefix', country: 'Bangladesh' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'LKR', nativeSymbol: 'රු', decimals: 2, symbolPosition: 'prefix', country: 'Sri Lanka' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', nativeSymbol: 'RM', decimals: 2, symbolPosition: 'prefix', country: 'Malaysia' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', nativeSymbol: '$', decimals: 2, symbolPosition: 'prefix', country: 'Singapore' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', nativeSymbol: 'Rp', decimals: 0, symbolPosition: 'prefix', country: 'Indonesia' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', nativeSymbol: '฿', decimals: 2, symbolPosition: 'prefix', country: 'Thailand' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', nativeSymbol: '₱', decimals: 2, symbolPosition: 'prefix', country: 'Philippines' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', nativeSymbol: '₺', decimals: 2, symbolPosition: 'prefix', country: 'Turkey' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'EGP', nativeSymbol: 'ج.م', decimals: 2, symbolPosition: 'prefix', country: 'Egypt' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', nativeSymbol: 'R', decimals: 2, symbolPosition: 'prefix', country: 'South Africa' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', nativeSymbol: '₦', decimals: 2, symbolPosition: 'prefix', country: 'Nigeria' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', nativeSymbol: 'CHF', decimals: 2, symbolPosition: 'prefix', country: 'Switzerland' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', nativeSymbol: 'kr', decimals: 2, symbolPosition: 'suffix', country: 'Sweden' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', nativeSymbol: 'kr', decimals: 2, symbolPosition: 'suffix', country: 'Norway' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', nativeSymbol: 'kr', decimals: 2, symbolPosition: 'suffix', country: 'Denmark' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', nativeSymbol: '¥', decimals: 2, symbolPosition: 'prefix', country: 'China' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', nativeSymbol: 'HK$', decimals: 2, symbolPosition: 'prefix', country: 'Hong Kong' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', nativeSymbol: '¥', decimals: 0, symbolPosition: 'prefix', country: 'Japan' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', nativeSymbol: '₩', decimals: 0, symbolPosition: 'prefix', country: 'South Korea' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', nativeSymbol: '$', decimals: 2, symbolPosition: 'prefix', country: 'New Zealand' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', nativeSymbol: 'R$', decimals: 2, symbolPosition: 'prefix', country: 'Brazil' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', nativeSymbol: '$', decimals: 2, symbolPosition: 'prefix', country: 'Mexico' },
] as const;

export const SUPPORTED_CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code) as [
  string,
  ...string[],
];

const currencyMap = new Map<string, CurrencyInfo>(
  SUPPORTED_CURRENCIES.map((c) => [c.code.toUpperCase(), c])
);

export function getCurrencyDetails(code?: string | null): CurrencyInfo {
  const normalized = (code || 'PKR').trim().toUpperCase();
  return (
    currencyMap.get(normalized) ?? {
      code: normalized,
      name: normalized,
      symbol: normalized,
      nativeSymbol: normalized,
      decimals: 2,
      symbolPosition: 'prefix',
      country: 'Global',
    }
  );
}

export function formatCurrencyAmount(amount: number | string, code?: string | null): string {
  const info = getCurrencyDetails(code);
  const num = typeof amount === 'string' ? Number(amount) : amount;
  const formatted = Number.isFinite(num) ? num.toFixed(info.decimals) : '0.00';
  return info.symbolPosition === 'suffix'
    ? `${formatted} ${info.symbol}`
    : `${info.symbol} ${formatted}`;
}
