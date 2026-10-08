/** The shapes the gateway returns, written from the contracts in sprout-contracts. Money is always a string. */

export interface Problem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  code: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
  requestId?: string;
}

export interface TokenPair {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  totpEnabled: boolean;
  createdAt: string;
}

export interface SignInResponse {
  status: 'AUTHENTICATED' | 'TOTP_REQUIRED';
  tokens?: TokenPair;
  challengeId?: string;
}

/** Whether the sandbox can give out a demo account now (sandbox v3). */
export interface DemoStatus {
  ready: boolean;
  sessionsLived?: number;
  endsAfterMinutes: number;
}

export interface DemoSession extends TokenPair {
  name: string;
  sessionsLived: number;
  endsAt: string;
}

export interface Market {
  mode: string;
  state: 'PRE_OPEN' | 'OPEN' | 'CLOSED';
  sessionDate: string;
  marketTime: string;
  speed: number;
  source: string;
}

export interface Instrument {
  symbol: string;
  name: string;
  industry?: string;
  type: 'EQUITY' | 'INDEX';
  tickSize: number;
  tradable: boolean;
}

export interface Quote {
  symbol: string;
  last: number;
  open: number;
  high: number;
  low: number;
  prevClose: number;
  change: number;
  changePercent: number;
  volume: number;
  ts: string;
  seq: number;
}

export interface Candle {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  complete: boolean;
}

export interface Funds {
  availableToTrade: string;
  cash: string;
  blocked: string;
  unsettled: string;
  dues: string;
}

export interface Holding {
  symbol: string;
  quantity: number;
  t1Quantity: number;
  averagePrice: string;
  investedValue: string;
  lastPrice?: string;
  currentValue?: string;
  pnl?: string;
}

export interface Charges {
  brokerage: string;
  stt: string;
  exchangeCharges: string;
  sebiFees: string;
  stampDuty: string;
  gst: string;
  total: string;
}

export interface Order {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT';
  limitPrice?: string;
  product: 'CNC' | 'MIS';
  variety: 'REGULAR' | 'AMO';
  status: 'AMO_QUEUED' | 'PENDING' | 'OPEN' | 'FILLED' | 'CANCELLED' | 'EXPIRED' | 'REJECTED';
  blocked: string;
  price?: string;
  value?: string;
  charges?: Charges;
  tag?: string;
  rejection?: { code: string; message: string };
  createdAt: string;
  updatedAt: string;
}

export interface NewOrder {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT';
  limitPrice?: string;
  product: 'CNC' | 'MIS';
}

export interface BankAccount {
  vpa: string;
  holderName: string;
  balance: string;
  openedAt: string;
}

export interface SproutAccount {
  id: string;
  legalName: string;
  panMasked: string;
  bankVpa: string;
  status: string;
  dematAccount?: string;
  openedAt: string;
}

export interface CollectRequest {
  id: string;
  payeeName: string;
  amount: string;
  note?: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string;
}

export interface Transaction {
  id: string;
  amount: string;
  direction: 'IN' | 'OUT';
  description: string;
  counterparty?: string;
  balanceAfter: string;
  at: string;
}

export interface Merchant {
  vpa: string;
  name: string;
  category: string;
}

export interface BankMandate {
  id: string;
  payeeName: string;
  maxAmount: string;
  purpose: string;
  shareSpends: boolean;
  status: 'PENDING' | 'ACTIVE' | 'DECLINED' | 'EXPIRED' | 'REVOKED';
  expiresAt: string;
}

export interface Deposit {
  id: string;
  amount: string;
  status: 'AWAITING_APPROVAL' | 'COMPLETED' | 'DECLINED' | 'EXPIRED' | 'FAILED';
  failureReason?: string;
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  amount: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  failureReason?: string;
  createdAt: string;
}

export interface AutoPay {
  id: string;
  maxAmount: string;
  status: 'AWAITING_APPROVAL' | 'ACTIVE' | 'DECLINED' | 'EXPIRED' | 'REVOKED' | 'FAILED';
  failureReason?: string;
}

export interface Plan {
  id: string;
  symbol: string;
  amount: string;
  dayOfMonth: number;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  nextDue?: string;
  invested?: string;
  instalments: { month: string; status: string; reason?: string; quantity?: number; price?: string; at: string }[];
}

export interface Habits {
  streak: { months: number; longest: number; freezes: number; atRisk: boolean };
  level: { name: string; monthsInvested: number; nextName?: string; monthsToNext?: number };
  badges: { code: string; name: string; earnedOn: string }[];
  points: { vested: number; pending: number; forfeited: number };
  nudge?: { code: string; message: string };
}

export interface Challenge {
  code: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  points: number;
}

export interface Wrapped {
  year: number;
  title: string;
  monthsInvested: number;
  longestStreak: number;
  purchases: number;
  differentShares: number;
  invested: string;
  topShare?: { symbol: string; purchases: number };
  planInstalments: number;
  potPurchases: number;
  challengesCompleted: number;
  pointsEarned: number;
  badges: string[];
}

export interface Pot {
  id: string;
  name: string;
  symbol: string;
  target: string;
  targetDate?: string;
  status: 'OPEN' | 'REACHED' | 'CLOSED';
  saved: string;
  invested: string;
  quantity: number;
  value: string;
  uninvested: string;
  progressPercent: number;
  monthlyNeeded?: string;
  movements?: { id: string; kind: string; amount: string; quantity?: number; status: string; reason?: string; at: string }[];
}

export interface RoundUps {
  enabled: boolean;
  roundTo: 10 | 50 | 100;
  multiplier: 1 | 2 | 3;
  potId?: string;
  autoPay: 'NONE' | 'AWAITING_APPROVAL' | 'ACTIVE';
  waiting: string;
  sweepAt?: string;
  swept: string;
  recent: { spendId: string; spent: string; payeeName: string; amount: string; status: 'WAITING' | 'SWEPT'; at: string }[];
}

export interface Vault {
  balance: { habitPoints: number; referralPoints: number; spent: number; available: number; pending: number };
  items: { code: string; name: string; brand: string; kind: string; points: number; affordable: boolean }[];
}

export interface Redemption {
  id: string;
  itemCode: string;
  name: string;
  points: number;
  voucherCode?: string;
  at: string;
}

export interface Referrals {
  code: string;
  referredBy?: string;
  friends: { joinedOn: string; monthsInvested: number; rewarded: boolean }[];
  pointsEarned: number;
}

export interface Squad {
  id: string;
  name: string;
  inviteCode: string;
  members: { rank: number; nickname: string; streakMonths: number; monthsInvestedLast12: number; investedRange?: string; you: boolean }[];
}
