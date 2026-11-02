/**
 * Daybook's merge rule for an import, and Delete everything for tasks. From Daybook's
 * portability.js. Reading a file is backup.js's job (coerceTask on every record);
 * writing an import is portability.js's writeBackup, in one storage write.
 */

import { mutate } from './storage.js';

/** @typedef {import('./schema.js').Task} Task */

/**
 * Daybook's rule, pure: tasks already here always win; only new ids are added.
 * @param {Task[]} current @param {Task[]} incoming @returns {{ tasks: Task[], added: number }}
 */
export function mergeTaskLists(current, incoming) {
  const have = new Set(current.map((t) => t.id));
  const add = incoming.filter((t) => !have.has(t.id));
  return { tasks: [...current, ...add], added: add.length };
}

/** @returns {Promise<number>} how many were deleted */
export async function deleteEverything() {
  return mutate((cur) => ({ tasks: [], result: cur.length }));
}
