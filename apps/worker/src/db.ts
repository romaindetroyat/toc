// D1 through a per-request meter (plan 04-01, T-04-27; 04-RESEARCH Pattern 9 « Free-plan row
// budget »: 100 000 rows written a day). Every account route runs its statements through one Meter,
// which adds up the rows each statement wrote and read (D1Result.meta). In TOC_TEST_MODE the router
// sends the sums with every /api answer as `x-toc-d1: w=<written>;r=<read>`, so the tests measure
// what each route costs. A failed batch writes nothing and adds nothing.

export class Meter {
  written = 0;
  read = 0;
  readonly db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  prepare(sql: string): D1PreparedStatement {
    return this.db.prepare(sql);
  }

  private add(result: D1Result): void {
    this.written += result.meta?.rows_written ?? 0;
    this.read += result.meta?.rows_read ?? 0;
  }

  async run(statement: D1PreparedStatement): Promise<D1Result> {
    const result = await statement.run();
    this.add(result);
    return result;
  }

  async all<T = Record<string, unknown>>(statement: D1PreparedStatement): Promise<D1Result<T>> {
    const result = await statement.all<T>();
    this.add(result);
    return result;
  }

  async first<T = Record<string, unknown>>(statement: D1PreparedStatement): Promise<T | null> {
    const result = await this.all<T>(statement);
    return result.results[0] ?? null;
  }

  async batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
    const results = await this.db.batch(statements);
    for (const result of results) this.add(result);
    return results;
  }

  /** The value of the x-toc-d1 header. */
  header(): string {
    return `w=${this.written};r=${this.read}`;
  }
}
