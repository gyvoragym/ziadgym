import { describe, expect, it } from 'vitest';
import { approvedGymColumns, approvedGymColumnWidths, approvedGymTotals, formatGymDate } from '@/lib/approved-gym-columns';

describe('Approved Gyms numbering and price totals', () => {
  it('keeps # as the first column followed by the required order', () => {
    expect(approvedGymColumns).toEqual(['#', 'Gym Name', 'Email', 'Contact', 'Plan', 'Monthly Price', 'Annual Price', 'Subscription Start', 'Subscription End', 'Status', 'Notes', 'Actions']);
  });

  it('places Subscription Start and End immediately before Status with matching column widths', () => {
    expect(approvedGymColumns.indexOf('Subscription Start')).toBe(approvedGymColumns.indexOf('Status') - 2);
    expect(approvedGymColumns.indexOf('Subscription End')).toBe(approvedGymColumns.indexOf('Status') - 1);
    expect(approvedGymColumnWidths).toHaveLength(approvedGymColumns.length);
  });

  it('formats saved subscription dates as numeric DD/MM/YYYY and shows an em dash when a date is missing', () => {
    expect(formatGymDate('2026-10-26')).toBe('26/10/2026');
    expect(formatGymDate('2026-03-05')).toBe('05/03/2026');
    expect(formatGymDate('2028-02-29T00:00:00.000Z')).toBe('29/02/2028');
    expect(formatGymDate('')).toBe('—');
    expect(formatGymDate(undefined)).toBe('—');
    expect(formatGymDate('not-a-date')).toBe('—');
  });

  it('sums monthly and annual prices across listed gyms, treating missing prices as zero', () => {
    // Legacy catalog: Basic 800 over 1 month, Premium 2100 over 3 months.
    const totals = approvedGymTotals([{ plan: 'Basic' }, { plan: 'Premium' }, {}]);
    expect(totals.monthlyPrice).toBeCloseTo(800 + 700);
    expect(totals.annualPrice).toBeCloseTo(9600 + 8400);
  });

  it('returns zero totals when no gyms are listed', () => {
    expect(approvedGymTotals([])).toEqual({ monthlyPrice: 0, annualPrice: 0 });
  });
});
