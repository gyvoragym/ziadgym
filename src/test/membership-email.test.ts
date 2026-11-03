import { describe, expect, it } from 'vitest';
import { membershipEmailSchema } from '../lib/validation';

describe('Optional membership email', () => {
  it('stores a blank email as null', () => {
    expect(membershipEmailSchema.parse('')).toBeNull();
    expect(membershipEmailSchema.parse('   ')).toBeNull();
  });
  it('accepts omitted or null membership email', () => {
    expect(membershipEmailSchema.parse(undefined)).toBeNull();
    expect(membershipEmailSchema.parse(null)).toBeNull();
  });
  it('retains and validates a provided email', () => {
    expect(membershipEmailSchema.parse(' fictional@example.invalid ')).toBe('fictional@example.invalid');
    expect(membershipEmailSchema.safeParse('invalid').success).toBe(false);
  });
});