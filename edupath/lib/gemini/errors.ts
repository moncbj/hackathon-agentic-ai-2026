import { z } from 'zod';

export interface AgentOutputErrorOptions {
  fixtureKey?: string;
  lastOutput?: unknown;
  zodErrors?: z.ZodIssue[];
  cause?: unknown;
}

/**
 * Typed error thrown when an AI agent's structured output fails validation
 * or when an expected fixture is invalid or missing.
 */
export class AgentOutputError extends Error {
  public readonly fixtureKey?: string;
  public readonly lastOutput?: unknown;
  public readonly zodErrors?: z.ZodIssue[];

  constructor(message: string, options?: AgentOutputErrorOptions) {
    super(message);
    this.name = 'AgentOutputError';
    this.fixtureKey = options?.fixtureKey;
    this.lastOutput = options?.lastOutput;
    this.zodErrors = options?.zodErrors;
    if (options?.cause) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, AgentOutputError.prototype);
  }
}
