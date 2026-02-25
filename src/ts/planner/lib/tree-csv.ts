/**
 * Generate CSV from the full ProcessedNode tree.
 *
 * Walks every node at every depth — researches, intermediates, leaves.
 * Outputs one row per node occurrence (not deduplicated).
 * Depth and parent columns preserve hierarchy for pivot tables.
 */

import type { ProcessedNode } from '../../types/index.js';

const HEADER = [
  'research',
  'depth',
  'parent',
  'name',
  'tier',
  'required',
  'have',
  'deficit',
  'pctComplete',
  'status',
  'trackable',
  'mappingType',
].join(',');

function escapeCSV(value: string): string {
  return value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value;
}

function walkNode(
  node: ProcessedNode,
  research: string,
  parent: string,
  depth: number,
  lines: string[]
): void {
  const deficit = Math.max(0, node.required - node.have);

  lines.push(
    [
      escapeCSV(research),
      depth,
      escapeCSV(parent),
      escapeCSV(node.name),
      node.tier,
      node.required,
      node.have,
      deficit,
      node.pctComplete,
      node.status,
      node.trackable,
      node.mappingType ?? 'unknown',
    ].join(',')
  );

  for (const child of node.children) {
    walkNode(child, research, node.name, depth + 1, lines);
  }
}

export function generateTreeCSV(
  researches: ProcessedNode[],
  studyJournals: ProcessedNode | null
): string {
  const lines: string[] = [HEADER];

  for (const research of researches) {
    walkNode(research, research.name, '', 0, lines);
  }

  if (studyJournals) {
    walkNode(studyJournals, 'Study Journals', '', 0, lines);
  }

  return lines.join('\n');
}
