// ========================================================
// SuvarnaLoan ERP - Gold Valuation & Dual Repayment Engine
// Location: src/lib/goldValuationEngine.ts
// ========================================================

export interface ValuationInput {
  metalType?: 'Gold' | 'Silver';
  grossWeightGrams: number;
  stoneWeightGrams: number;
  purityKarat: '24K (99.9%)' | '22K (91.6%)' | '18K (75.0%)' | '14K (58.5%)' | '999 Fine Silver (99.9%)' | '925 Sterling Silver (92.5%)' | '900 Coin Silver (90.0%)' | '800 Silver (80.0%)' | string;
  goldRatePerGram24K: number;
  silverRatePerGram?: number;
  ltvPercentage?: number; // Default 75%
}

export interface ValuationResult {
  grossWeight: number;
  stoneWeight: number;
  netWeight: number;
  purityKarat: string;
  purityPercentage: number;
  pureGoldWeightGrams: number;
  rateAppliedPerGram: number;
  estimatedMarketValue: number;
  maxLoanAmount: number;
  ltvPercentage: number;
}

export interface EMIScheduleRow {
  month: number;
  openingPrincipal: number;
  monthlyInterest: number;
  principalPaid: number;
  emiAmount: number;
  closingPrincipal: number;
}

export function getPurityPercentage(karat: string): number {
  if (!karat) return 75.0;
  if (karat.includes('999')) return 99.9;
  if (karat.includes('925') || karat.toLowerCase().includes('sterling')) return 92.5;
  if (karat.includes('900') || karat.toLowerCase().includes('coin')) return 90.0;
  if (karat.includes('800')) return 80.0;
  if (karat.includes('24K')) return 99.9;
  if (karat.includes('22K')) return 91.66;
  if (karat.includes('18K')) return 75.0;
  if (karat.includes('14K')) return 58.33;
  const pctMatch = karat.match(/(\d+(?:\.\d+)?)%/);
  if (pctMatch) return parseFloat(pctMatch[1]);
  const match = karat.match(/(\d+)K/i);
  if (match) {
    const k = parseInt(match[1], 10);
    return Number(((k / 24) * 100).toFixed(2));
  }
  return 75.0;
}

export function calculateGoldValuation(input: ValuationInput): ValuationResult {
  const metalType = input.metalType || 'Gold';
  const grossWeight = Math.max(0, input.grossWeightGrams || 0);
  const stoneWeight = Math.max(0, input.stoneWeightGrams || 0);
  const netWeight = Math.max(0, grossWeight - stoneWeight);
  
  const purityPercentage = getPurityPercentage(input.purityKarat);
  const pureGoldWeightGrams = Number(((netWeight * purityPercentage) / 100).toFixed(3));
  
  let rateAppliedPerGram = 0;
  if (metalType === 'Silver') {
    const baseSilverRate = input.silverRatePerGram || 95;
    rateAppliedPerGram = Number(((baseSilverRate * purityPercentage) / 100).toFixed(2));
  } else {
    rateAppliedPerGram = Number(((input.goldRatePerGram24K * purityPercentage) / 100).toFixed(2));
  }

  const estimatedMarketValue = Math.round(netWeight * rateAppliedPerGram);
  
  const ltvPercentage = input.ltvPercentage !== undefined ? input.ltvPercentage : 75;
  const maxLoanAmount = Math.floor((estimatedMarketValue * ltvPercentage) / 100);

  return {
    grossWeight,
    stoneWeight,
    netWeight,
    purityKarat: input.purityKarat,
    purityPercentage,
    pureGoldWeightGrams,
    rateAppliedPerGram,
    estimatedMarketValue,
    maxLoanAmount,
    ltvPercentage,
  };
}

/**
 * Calculates Monthly EMI for Reducing Balance Loan
 * EMI = [P x R x (1+R)^N]/[(1+R)^N-1]
 */
export function calculateMonthlyEMI(principal: number, monthlyRatePercentage: number, tenureMonths: number): number {
  if (principal <= 0 || tenureMonths <= 0) return 0;
  const r = monthlyRatePercentage / 100;
  if (r === 0) return Math.round(principal / tenureMonths);
  const pow = Math.pow(1 + r, tenureMonths);
  const emi = (principal * r * pow) / (pow - 1);
  return Math.round(emi);
}

/**
 * Generates month-by-month Reducing Balance Amortization Schedule
 */
export function calculateReducingBalanceSchedule(
  principal: number,
  monthlyRatePercentage: number,
  tenureMonths: number
): EMIScheduleRow[] {
  const emi = calculateMonthlyEMI(principal, monthlyRatePercentage, tenureMonths);
  const schedule: EMIScheduleRow[] = [];
  let currentPrincipal = principal;
  const r = monthlyRatePercentage / 100;

  for (let m = 1; m <= tenureMonths; m++) {
    const monthlyInterest = Math.round(currentPrincipal * r);
    const principalPaid = m === tenureMonths ? currentPrincipal : Math.min(currentPrincipal, emi - monthlyInterest);
    const closingPrincipal = Math.max(0, currentPrincipal - principalPaid);

    schedule.push({
      month: m,
      openingPrincipal: Math.round(currentPrincipal),
      monthlyInterest,
      principalPaid,
      emiAmount: monthlyInterest + principalPaid,
      closingPrincipal: Math.round(closingPrincipal),
    });

    currentPrincipal = closingPrincipal;
  }

  return schedule;
}

/**
 * Dual Model Loan Financial Calculation (Reducing Balance EMI vs Bullet Repayment Gold Loan)
 */
export function calculateLoanFinancials(
  loanAmount: number = 0,
  monthlyInterestRate: number = 0,
  loanDateStr: string = '',
  dueDateStr: string = '',
  payments: Array<{ amount: number; payment_type: string; payment_date: string }> = [],
  repaymentModel: 'Reducing Balance EMI' | 'Bullet Repayment' | 'Interest Only' = 'Bullet Repayment',
  tenureMonths: number = 12
) {
  const safeLoanAmount = Math.max(0, Number(loanAmount) || 0);
  const safeRate = Math.max(0, Number(monthlyInterestRate) || 0);
  const safeTenure = Math.max(1, Number(tenureMonths) || 12);

  const safeLoanDateStr = loanDateStr || new Date().toISOString().split('T')[0];
  const safeDueDateStr = dueDateStr || new Date(Date.now() + safeTenure * 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

  const parsedLoanDate = new Date(safeLoanDateStr);
  const parsedDueDate = new Date(safeDueDateStr);
  const loanDate = isNaN(parsedLoanDate.getTime()) ? new Date() : parsedLoanDate;
  const dueDate = isNaN(parsedDueDate.getTime()) ? new Date(Date.now() + 365 * 24 * 3600 * 1000) : parsedDueDate;
  const today = new Date();
  
  const diffTime = Math.max(0, today.getTime() - loanDate.getTime()) || 0;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 0;
  const diffMonths = Math.max(1, Math.ceil(diffDays / 30)) || 1;

  let remainingPrincipal = safeLoanAmount;
  let totalInterestPaid = 0;
  let totalPrincipalPaid = 0;

  const safePayments = Array.isArray(payments) ? payments : [];
  const sortedPayments = [...safePayments].sort((a, b) => {
    const da = a?.payment_date ? new Date(a.payment_date).getTime() : 0;
    const db = b?.payment_date ? new Date(b.payment_date).getTime() : 0;
    return da - db;
  });

  // Calculate gross accrued interest over elapsed duration
  const grossAccruedInterest = Math.round((safeLoanAmount * (safeRate / 100)) * diffMonths);
  let unpaidInterest = grossAccruedInterest;

  sortedPayments.forEach((p) => {
    const amt = Number(p.amount) || 0;
    if (amt <= 0) return;

    const pType = (p.payment_type || '').toLowerCase();

    if (pType.includes('full settlement') || pType.includes('closure')) {
      totalPrincipalPaid += remainingPrincipal;
      totalInterestPaid += unpaidInterest;
      remainingPrincipal = 0;
      unpaidInterest = 0;
    } else if (pType.includes('principal')) {
      // Direct principal part-payment: subtracts from remaining principal first
      const partPrincipal = Math.min(amt, remainingPrincipal);
      remainingPrincipal = Math.max(0, remainingPrincipal - partPrincipal);
      totalPrincipalPaid += partPrincipal;
      const excess = amt - partPrincipal;
      if (excess > 0) {
        const partInterest = Math.min(excess, unpaidInterest);
        unpaidInterest = Math.max(0, unpaidInterest - partInterest);
        totalInterestPaid += partInterest;
      }
    } else {
      // Interest / EMI / General Repayment: covers accrued interest first, excess reduces principal
      if (amt <= unpaidInterest) {
        totalInterestPaid += amt;
        unpaidInterest -= amt;
      } else {
        totalInterestPaid += unpaidInterest;
        const excessToPrincipal = amt - unpaidInterest;
        unpaidInterest = 0;
        totalPrincipalPaid += excessToPrincipal;
        remainingPrincipal = Math.max(0, remainingPrincipal - excessToPrincipal);
      }
    }
  });

  const netAccruedInterest = Math.max(0, unpaidInterest);
  const totalBalanceDue = Math.max(0, remainingPrincipal + netAccruedInterest);
  const emiAmount = repaymentModel === 'Reducing Balance EMI'
    ? calculateMonthlyEMI(safeLoanAmount, safeRate, safeTenure)
    : Math.round(safeLoanAmount * (safeRate / 100));

  const isOverdue = today > dueDate && remainingPrincipal > 0;
  const overdueDays = isOverdue ? Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24)) : 0;
  const isAuctionEligible = overdueDays > 30 && remainingPrincipal > 0;

  return {
    repaymentModel,
    elapsedDays: diffDays,
    elapsedMonths: diffMonths,
    monthlyInterestRate: safeRate,
    annualInterestRate: safeRate * 12,
    emiAmount,
    grossAccruedInterest,
    totalInterestPaid,
    totalPrincipalPaid,
    remainingPrincipal,
    netAccruedInterest,
    totalBalanceDue,
    isOverdue,
    overdueDays,
    isAuctionEligible,
  };
}
