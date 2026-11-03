import {describe,it,expect} from 'vitest';
import {accountQrValue,isGyvoraId,normalizeAccountLookup} from '@/lib/gyvora-id';
import {findSessionClient} from '@/lib/session-client';
import {members} from '@/lib/mock';
describe('permanent GYVORA identity',()=>{
 it('accepts three-digit zero-padded IDs and growing suffixes without a configured length cap',()=>{expect(isGyvoraId('GYVORA-C-001')).toBe(true);expect(isGyvoraId('GYVORA-C-010')).toBe(true);expect(isGyvoraId('GYVORA-C-100')).toBe(true);expect(isGyvoraId('GYVORA-G-999')).toBe(true);expect(isGyvoraId('GYVORA-C-1000')).toBe(true);expect(isGyvoraId(`GYVORA-G-1${'0'.repeat(1000)}`)).toBe(true);expect(isGyvoraId('GYVORA-C-000')).toBe(false);expect(isGyvoraId('GYVORA-C-99')).toBe(false);expect(isGyvoraId('GYVORA-G-0100')).toBe(false);});
 it('uses gym and client prefixes with numeric identifiers',()=>{expect(isGyvoraId('GYVORA-G-123456789012345')).toBe(true);expect(isGyvoraId('GYVORA-C-987654321012345')).toBe(true);expect(isGyvoraId('GYVORA-C-client@example.invalid')).toBe(false);});
 it('QR encodes only the permanent account ID',()=>{expect(accountQrValue('GYVORA-C-123456789012345')).toBe('GYVORA-C-123456789012345');expect(()=>accountQrValue('client@example.invalid')).toThrow();});
 it('normalizes legacy QR without changing the permanent ID',()=>{expect(normalizeAccountLookup(' GYVORA-C-123456789012345 ')).toBe('GYVORA-C-123456789012345');expect(normalizeAccountLookup('ironhaus:member:legacy')).toBe('legacy');});
 it('resolves QR to the same gym member and never another gym',()=>{const base=members[0];if(!base)throw new Error('Member fixture missing');const member={...base,gyvoraId:'GYVORA-C-123456789012345'};expect(findSessionClient([member],member.gyvoraId)).toBe(member);expect(findSessionClient([],member.gyvoraId)).toBeUndefined();});
});