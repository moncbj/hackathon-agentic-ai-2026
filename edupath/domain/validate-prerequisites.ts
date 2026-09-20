// domain/validate-prerequisites.ts
// Pure graph validation function for skill prerequisites.
// Ensures the dependency graph is a valid Directed Acyclic Graph (DAG) with no cycles or self-references.

export interface PrerequisiteEdge {
  skill_id: string;
  prerequisite_skill_id: string;
}

export interface PrerequisiteValidationResult {
  valid: boolean;
  error?: string;
  cycle?: string[];
}

/**
 * Validates a list of prerequisite edges to ensure there are no self-references or circular dependencies.
 * Pure function: no database, network, or external dependencies.
 */
export function validatePrerequisites(
  edges: PrerequisiteEdge[]
): PrerequisiteValidationResult {
  if (!edges || edges.length === 0) {
    return { valid: true };
  }

  // 1. Check for immediate self-references
  for (const edge of edges) {
    if (edge.skill_id === edge.prerequisite_skill_id) {
      return {
        valid: false,
        error: `Self-reference detected: skill "${edge.skill_id}" cannot depend on itself.`,
        cycle: [edge.skill_id, edge.skill_id],
      };
    }
  }

  // 2. Build adjacency list: skill_id -> prerequisite_skill_ids
  const adj = new Map<string, string[]>();
  const allNodes = new Set<string>();

  for (const edge of edges) {
    allNodes.add(edge.skill_id);
    allNodes.add(edge.prerequisite_skill_id);

    const neighbors = adj.get(edge.skill_id) ?? [];
    neighbors.push(edge.prerequisite_skill_id);
    adj.set(edge.skill_id, neighbors);
  }

  // 3. Three-color DFS cycle detection
  // 0 = unvisited (white), 1 = visiting (gray), 2 = visited (black)
  const state = new Map<string, number>();
  const parent = new Map<string, string>();

  function dfs(node: string): string[] | null {
    state.set(node, 1); // Mark as currently visiting (in recursion stack)

    const neighbors = adj.get(node) ?? [];
    for (const neighbor of neighbors) {
      const neighborState = state.get(neighbor) ?? 0;

      if (neighborState === 1) {
        // Cycle detected! Reconstruct the cycle
        const cyclePath: string[] = [neighbor, node];
        let curr = node;
        while (curr !== neighbor && parent.has(curr)) {
          curr = parent.get(curr)!;
          cyclePath.push(curr);
        }
        cyclePath.reverse();
        return cyclePath;
      }

      if (neighborState === 0) {
        parent.set(neighbor, node);
        const cycleFound = dfs(neighbor);
        if (cycleFound) {
          return cycleFound;
        }
      }
    }

    state.set(node, 2); // Mark as fully visited
    return null;
  }

  for (const node of allNodes) {
    if ((state.get(node) ?? 0) === 0) {
      const cycle = dfs(node);
      if (cycle) {
        const cycleStr = cycle.join(' -> ');
        return {
          valid: false,
          error: `Circular dependency cycle detected: ${cycleStr}`,
          cycle,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Asserts that the prerequisite edges form a valid DAG.
 * Throws an Error if validation fails.
 */
export function assertValidPrerequisites(edges: PrerequisiteEdge[]): void {
  const result = validatePrerequisites(edges);
  if (!result.valid) {
    throw new Error(result.error ?? 'Invalid prerequisite hierarchy.');
  }
}
