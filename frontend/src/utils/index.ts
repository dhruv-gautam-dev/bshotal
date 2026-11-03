// General TypeScript utility types and helper functions placeholder
export type ID = string;

export interface BaseEntity {
  id: ID;
  createdAt?: string;
  updatedAt?: string;
}

export const noop = (): void => {};

