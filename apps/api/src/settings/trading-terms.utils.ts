export function calculateDueDate(
  invoiceDate: Date,
  termType: string,
  days: number,
): Date {
  const result = new Date(invoiceDate);

  switch (termType) {
    case 'cash_on_delivery':
      return result; // Due immediately

    case 'net':
      result.setDate(result.getDate() + days);
      return result;

    case 'end_of_month':
      // Move to the end of the month of the invoice date
      // month is 0-indexed. setMonth(month + 1, 0) gives the last day of the current month.
      result.setMonth(result.getMonth() + 1, 0);
      result.setDate(result.getDate() + days);
      return result;

    default:
      // Fallback if type is unknown
      result.setDate(result.getDate() + days);
      return result;
  }
}
