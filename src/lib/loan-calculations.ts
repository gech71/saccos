export type AmortizationRow = {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
};

export function calculateRepaymentSchedule(
  principal: number,
  annualRate: number,
  termInMonths: number
): AmortizationRow[] {
  const monthlyRate = annualRate / 100 / 12;
  const schedule: AmortizationRow[] = [];

  if (principal <= 0 || monthlyRate <= 0 || termInMonths <= 0) {
    return schedule;
  }
  
  // Standard amortization formula for fixed monthly payment
  const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, termInMonths)) / (Math.pow(1 + monthlyRate, termInMonths) - 1);

  let remainingBalance = principal;

  for (let i = 1; i <= termInMonths; i++) {
    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = monthlyPayment - interestPayment;
    remainingBalance -= principalPayment;
    
    // Ensure last payment clears the balance exactly
    if (i === termInMonths && Math.abs(remainingBalance) > 0.01) {
        const finalPrincipal = principalPayment + remainingBalance;
        remainingBalance = 0;
        schedule.push({
            month: i,
            payment: finalPrincipal + interestPayment,
            principal: finalPrincipal,
            interest: interestPayment,
            remainingBalance: 0,
        });
    } else {
        schedule.push({
            month: i,
            payment: monthlyPayment,
            principal: principalPayment,
            interest: interestPayment,
            remainingBalance: remainingBalance < 0 ? 0 : remainingBalance,
        });
    }
  }

  return schedule;
}
