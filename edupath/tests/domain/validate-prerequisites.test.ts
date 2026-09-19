import { describe, it, expect } from 'vitest';
import {
  validatePrerequisites,
  assertValidPrerequisites,
  PrerequisiteEdge,
} from '@/domain/validate-prerequisites';

describe('domain/validate-prerequisites', () => {
  it('should validate an empty prerequisite graph as valid', () => {
    const result = validatePrerequisites([]);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(() => assertValidPrerequisites([])).not.toThrow();
  });

  it('should validate a linear DAG without cycles', () => {
    const edges: PrerequisiteEdge[] = [
      { skill_id: 'pandas', prerequisite_skill_id: 'basic-python' },
      { skill_id: 'data-cleaning', prerequisite_skill_id: 'pandas' },
    ];

    const result = validatePrerequisites(edges);
    expect(result.valid).toBe(true);
    expect(() => assertValidPrerequisites(edges)).not.toThrow();
  });

  it('should validate a branching DAG with shared dependencies', () => {
    const edges: PrerequisiteEdge[] = [
      { skill_id: 'descriptive-statistics', prerequisite_skill_id: 'spreadsheets' },
      { skill_id: 'sql', prerequisite_skill_id: 'spreadsheets' },
      { skill_id: 'probability', prerequisite_skill_id: 'descriptive-statistics' },
      { skill_id: 'data-visualization', prerequisite_skill_id: 'descriptive-statistics' },
      { skill_id: 'communicating-results', prerequisite_skill_id: 'data-visualization' },
    ];

    const result = validatePrerequisites(edges);
    expect(result.valid).toBe(true);
    expect(() => assertValidPrerequisites(edges)).not.toThrow();
  });

  it('should detect direct self-references as invalid', () => {
    const edges: PrerequisiteEdge[] = [
      { skill_id: 'sql', prerequisite_skill_id: 'sql' },
    ];

    const result = validatePrerequisites(edges);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Self-reference detected');
    expect(() => assertValidPrerequisites(edges)).toThrow(/Self-reference detected/);
  });

  it('should detect a 2-node cycle (A -> B -> A)', () => {
    const edges: PrerequisiteEdge[] = [
      { skill_id: 'skill-a', prerequisite_skill_id: 'skill-b' },
      { skill_id: 'skill-b', prerequisite_skill_id: 'skill-a' },
    ];

    const result = validatePrerequisites(edges);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Circular dependency cycle detected');
    expect(() => assertValidPrerequisites(edges)).toThrow(/Circular dependency cycle detected/);
  });

  it('should detect a 3-node cycle in a larger graph (A -> B -> C -> A)', () => {
    const edges: PrerequisiteEdge[] = [
      { skill_id: 'root', prerequisite_skill_id: 'base' },
      { skill_id: 'node-a', prerequisite_skill_id: 'node-b' },
      { skill_id: 'node-b', prerequisite_skill_id: 'node-c' },
      { skill_id: 'node-c', prerequisite_skill_id: 'node-a' },
    ];

    const result = validatePrerequisites(edges);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Circular dependency cycle detected');
    expect(() => assertValidPrerequisites(edges)).toThrow(/Circular dependency cycle detected/);
  });
});
