import { type Reason, reasonSpec } from './reason';

export function entityUrlForReason(reason: Reason | null): string | null {
  if (!reason) return null;
  return reasonSpec(reason.kind).url?.(reason.value) ?? null;
}
