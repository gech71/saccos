
export type AmortizationRow = {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
};

function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}


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
    const interestPayment = roundToTwo(remainingBalance * monthlyRate);
    const principalPayment = roundToTwo(monthlyPayment - interestPayment);
    remainingBalance = roundToTwo(remainingBalance - principalPayment);
    
    // Ensure last payment clears the balance exactly
    if (i === termInMonths && Math.abs(remainingBalance) > 0.01) {
        const finalPrincipal = roundToTwo(principalPayment + remainingBalance);
        remainingBalance = 0;
        schedule.push({
            month: i,
            payment: roundToTwo(finalPrincipal + interestPayment),
            principal: finalPrincipal,
            interest: interestPayment,
            remainingBalance: 0,
        });
    } else {
        schedule.push({
            month: i,
            payment: roundToTwo(monthlyPayment),
            principal: principalPayment,
            interest: interestPayment,
            remainingBalance: roundToTwo(remainingBalance < 0 ? 0 : remainingBalance),
        });
    }
  }

  return schedule;
}
