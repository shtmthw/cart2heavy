import { describe, expect, it } from 'vitest';
import { SHARED_PACKAGE } from '@cart2heavy/shared';

describe('scaffold', () => {
  it('imports the shared package', () => {
    expect(SHARED_PACKAGE).toBe('@cart2heavy/shared');
  });
});
