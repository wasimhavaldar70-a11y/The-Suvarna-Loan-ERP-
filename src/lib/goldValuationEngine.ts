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
  if (karat.includes('20K')) return 83.33;
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

export interface DisbursementFinancials {
  disbursementId: string;
  disbursementNumber: number;
  originalAmount: number;
  monthlyInterestRate: number;
  disbursementDate: string;
  dueDate: string;
  elapsedDays: number;
  elapsedMonths: number;
  grossAccruedInterest: number;
  totalInterestPaid: number;
  totalPrincipalPaid: number;
  remainingPrincipal: number;
  netAccruedInterest: number;
  totalBalanceDue: number;
  isOverdue: boolean;
  overdueDays: number;
}

/**
 * Calculates independent financial metrics for a single disbursement tranche
 */
export function calculateDisbursementFinancials(
  disbursement: {
    id?: string;
    disbursement_number?: number;
    amount: number;
    interest_rate: number;
    disbursement_date: string;
    interest_start_date?: string;
    due_date?: string;
    tenure_months?: number;
  },
  payments: Array<{ amount: number; payment_type: string; payment_date: string; disbursement_id?: string; disbursement_number?: number }> = [],
  repaymentModel: 'Reducing Balance EMI' | 'Bullet Repayment' | 'Interest Only' = 'Bullet Repayment'
): DisbursementFinancials {
  const safeAmount = Math.max(0, Number(disbursement.amount) || 0);
  const safeRate = Math.max(0, Number(disbursement.interest_rate) || 0);
  const safeTenure = Math.max(1, Number(disbursement.tenure_months) || 12);

  const startDateStr = disbursement.interest_start_date || disbursement.disbursement_date || new Date().toISOString().split('T')[0];
  const safeDueDateStr = disbursement.due_date || new Date(Date.now() + safeTenure * 30 * 24 * 3600 * 1000).toISOString().split('T')[0];

  const parsedStartDate = new Date(startDateStr);
  const parsedDueDate = new Date(safeDueDateStr);
  const startDate = isNaN(parsedStartDate.getTime()) ? new Date() : parsedStartDate;
  const dueDate = isNaN(parsedDueDate.getTime()) ? new Date(Date.now() + 365 * 24 * 3600 * 1000) : parsedDueDate;
  const today = new Date();

  const diffTime = Math.max(0, today.getTime() - startDate.getTime()) || 0;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 0;
  const diffMonths = Math.max(1, Math.ceil(diffDays / 30)) || 1;

  let remainingPrincipal = safeAmount;
  let totalInterestPaid = 0;
  let totalPrincipalPaid = 0;

  // Filter payments specifically for this tranche if allocated, or general payments
  const relevantPayments = payments.filter(p => {
    if (disbursement.id && p.disbursement_id) {
      return p.disbursement_id === disbursement.id;
    }
    if (disbursement.disbursement_number && p.disbursement_number) {
      return p.disbursement_number === disbursement.disbursement_number;
    }
    return !p.disbursement_id && !p.disbursement_number; // general payment shared proportionally
  });

  const sortedPayments = [...relevantPayments].sort((a, b) => {
    const da = a?.payment_date ? (typeof a.payment_date === 'number' ? a.payment_date : Date.parse(a.payment_date) || 0) : 0;
    const db = b?.payment_date ? (typeof b.payment_date === 'number' ? b.payment_date : Date.parse(b.payment_date) || 0) : 0;
    return da - db;
  });

  // Calculate gross accrued interest for this tranche
  const grossAccruedInterest = Math.round((safeAmount * (safeRate / 100)) * diffMonths);
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
    } else if (pType.includes('principal') || pType.includes('partial') || pType.includes('part')) {
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
  const isOverdue = today > dueDate && remainingPrincipal > 0;
  const overdueDays = isOverdue ? Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 3600 * 24)) : 0;

  return {
    disbursementId: disbursement.id || `disb-${disbursement.disbursement_number || 1}`,
    disbursementNumber: disbursement.disbursement_number || 1,
    originalAmount: safeAmount,
    monthlyInterestRate: safeRate,
    disbursementDate: startDateStr,
    dueDate: safeDueDateStr,
    elapsedDays: diffDays,
    elapsedMonths: diffMonths,
    grossAccruedInterest,
    totalInterestPaid,
    totalPrincipalPaid,
    remainingPrincipal,
    netAccruedInterest,
    totalBalanceDue,
    isOverdue,
    overdueDays,
  };
}

/**
 * Dual Model Loan Financial Calculation (Reducing Balance EMI vs Bullet Repayment Gold Loan)
 * Supports Multi-Disbursement Tranches & Aggregation
 */
export function calculateLoanFinancials(
  loanAmount: number = 0,
  monthlyInterestRate: number = 0,
  loanDateStr: string = '',
  dueDateStr: string = '',
  payments: Array<{ amount: number; payment_type: string; payment_date: string; disbursement_id?: string; disbursement_number?: number }> = [],
  repaymentModel: 'Reducing Balance EMI' | 'Bullet Repayment' | 'Interest Only' = 'Bullet Repayment',
  tenureMonths: number = 12,
  disbursements?: Array<{
    id?: string;
    disbursement_number?: number;
    amount: number;
    interest_rate: number;
    disbursement_date: string;
    interest_start_date?: string;
    due_date?: string;
    tenure_months?: number;
  }>
) {
  const safePayments = Array.isArray(payments) ? payments : [];

  // If explicit multi-disbursements are provided, calculate tranche-by-tranche and aggregate
  if (Array.isArray(disbursements) && disbursements.length > 0) {
    const trancheMetrics = disbursements.map((d, index) => {
      return calculateDisbursementFinancials(
        {
          ...d,
          disbursement_number: d.disbursement_number || (index + 1),
          interest_rate: d.interest_rate !== undefined ? d.interest_rate : monthlyInterestRate,
          tenure_months: d.tenure_months || tenureMonths,
        },
        safePayments,
        repaymentModel
      );
    });

    const totalDisbursed = trancheMetrics.reduce((sum, t) => sum + t.originalAmount, 0);
    const totalRemainingPrincipal = trancheMetrics.reduce((sum, t) => sum + t.remainingPrincipal, 0);
    const totalPrincipalPaid = trancheMetrics.reduce((sum, t) => sum + t.totalPrincipalPaid, 0);
    const totalInterestPaid = trancheMetrics.reduce((sum, t) => sum + t.totalInterestPaid, 0);
    const totalGrossAccruedInterest = trancheMetrics.reduce((sum, t) => sum + t.grossAccruedInterest, 0);
    const totalNetAccruedInterest = trancheMetrics.reduce((sum, t) => sum + t.netAccruedInterest, 0);
    const totalBalanceDue = trancheMetrics.reduce((sum, t) => sum + t.totalBalanceDue, 0);

    const isOverdue = trancheMetrics.some(t => t.isOverdue);
    const maxOverdueDays = Math.max(0, ...trancheMetrics.map(t => t.overdueDays));
    const isAuctionEligible = maxOverdueDays > 30 && totalRemainingPrincipal > 0;

    const earliestDate = trancheMetrics.reduce((min, t) => t.disbursementDate < min ? t.disbursementDate : min, trancheMetrics[0].disbursementDate);
    const diffTime = Math.max(0, new Date().getTime() - new Date(earliestDate).getTime()) || 0;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 0;
    const diffMonths = Math.max(1, Math.ceil(diffDays / 30)) || 1;

    const emiAmount = repaymentModel === 'Reducing Balance EMI'
      ? calculateMonthlyEMI(totalDisbursed, monthlyInterestRate, tenureMonths)
      : Math.round(totalDisbursed * (monthlyInterestRate / 100));

    return {
      repaymentModel,
      elapsedDays: diffDays,
      elapsedMonths: diffMonths,
      monthlyInterestRate,
      annualInterestRate: monthlyInterestRate * 12,
      emiAmount,
      totalDisbursed,
      grossAccruedInterest: totalGrossAccruedInterest,
      totalInterestPaid,
      totalPrincipalPaid,
      remainingPrincipal: totalRemainingPrincipal,
      netAccruedInterest: totalNetAccruedInterest,
      totalBalanceDue,
      isOverdue,
      overdueDays: maxOverdueDays,
      isAuctionEligible,
      trancheBreakdown: trancheMetrics,
    };
  }

  // Fallback for single disbursement
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

  let sortedPayments = safePayments;
  if (safePayments.length > 1) {
    sortedPayments = [...safePayments].sort((a, b) => {
      const da = a?.payment_date ? (typeof a.payment_date === 'number' ? a.payment_date : Date.parse(a.payment_date) || 0) : 0;
      const db = b?.payment_date ? (typeof b.payment_date === 'number' ? b.payment_date : Date.parse(b.payment_date) || 0) : 0;
      return da - db;
    });
  }

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
    } else if (pType.includes('principal') || pType.includes('partial') || pType.includes('part')) {
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

  const singleTranche: DisbursementFinancials = {
    disbursementId: 'disb-1',
    disbursementNumber: 1,
    originalAmount: safeLoanAmount,
    monthlyInterestRate: safeRate,
    disbursementDate: safeLoanDateStr,
    dueDate: safeDueDateStr,
    elapsedDays: diffDays,
    elapsedMonths: diffMonths,
    grossAccruedInterest,
    totalInterestPaid,
    totalPrincipalPaid,
    remainingPrincipal,
    netAccruedInterest,
    totalBalanceDue,
    isOverdue,
    overdueDays,
  };

  return {
    repaymentModel,
    elapsedDays: diffDays,
    elapsedMonths: diffMonths,
    monthlyInterestRate: safeRate,
    annualInterestRate: safeRate * 12,
    emiAmount,
    totalDisbursed: safeLoanAmount,
    grossAccruedInterest,
    totalInterestPaid,
    totalPrincipalPaid,
    remainingPrincipal,
    netAccruedInterest,
    totalBalanceDue,
    isOverdue,
    overdueDays,
    isAuctionEligible,
    trancheBreakdown: [singleTranche],
  };
}
