
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
    let principalPayment = roundToTwo(monthlyPayment - interestPayment);
    
    // On the final month, adjust the principal payment to exactly clear the remaining balance
    if (i === termInMonths) {
        const finalPrincipalPayment = roundToTwo(remainingBalance);
        // Adjust the final payment amount as well
        const finalPayment = roundToTwo(finalPrincipalPayment + interestPayment);
        schedule.push({
            month: i,
            payment: finalPayment,
            principal: finalPrincipalPayment,
            interest: interestPayment,
            remainingBalance: 0,
        });
        remainingBalance = 0;

    } else {
        remainingBalance = roundToTwo(remainingBalance - principalPayment);
        schedule.push({
            month: i,
            payment: roundToTwo(monthlyPayment),
            principal: principalPayment,
            interest: interestPayment,
            remainingBalance: remainingBalance,
        });
    }
  }

  return schedule;
}
