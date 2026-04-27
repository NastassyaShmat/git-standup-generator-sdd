// Smoke test — verifies Jest + ts-jest can run TypeScript tests
import { OutputFormat, GroupBy } from '../src/types';

describe('TypeScript tooling setup', () => {
  it('can import types from src/types.ts', () => {
    const fmt: OutputFormat = 'text';
    const grp: GroupBy = 'type';
    expect(fmt).toBe('text');
    expect(grp).toBe('type');
  });

  it('package.json has no dependencies field (zero runtime deps)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../package.json') as Record<string, unknown>;
    expect(pkg['dependencies']).toBeUndefined();
  });
});
