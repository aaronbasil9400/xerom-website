export interface ResourceLifecycleInput { resourceId: string; lifecycle: "draft" | "provisioning" | "ready" | "active" | "retired" | "error"; isPrimary: boolean; isControl: boolean; historyEventCount: number; futureEventCount: number; hasRecurringEvents: boolean; }
export type LifecycleDecision = { allowed: true; action: "retire" | "delete" } | { allowed: false; action: "retire" | "delete"; reasons: string[] };

export function canRetireResource(resource: ResourceLifecycleInput): LifecycleDecision {
  const reasons: string[] = [];
  if (resource.isPrimary || resource.isControl) reasons.push("Primary and Booking Control calendars cannot be retired.");
  if (resource.lifecycle === "retired") reasons.push("Resource is already retired.");
  if (resource.futureEventCount > 0 || resource.hasRecurringEvents) reasons.push("Future reservations or recurring events require resolution first.");
  return reasons.length ? { allowed: false, action: "retire", reasons } : { allowed: true, action: "retire" };
}

export function canDeleteResourceCalendar(resource: ResourceLifecycleInput, confirmationValid: boolean): LifecycleDecision {
  const reasons: string[] = [];
  if (!confirmationValid) reasons.push("A fresh owner confirmation is required.");
  if (resource.isPrimary || resource.isControl) reasons.push("Primary and Booking Control calendars cannot be deleted.");
  if (resource.lifecycle !== "retired") reasons.push("Only retired resources can be permanently deleted.");
  if (resource.futureEventCount > 0 || resource.hasRecurringEvents) reasons.push("Future reservations or recurring events block deletion.");
  if (resource.historyEventCount > 0) reasons.push("Non-empty history requires an owner-approved retention/export policy.");
  return reasons.length ? { allowed: false, action: "delete", reasons } : { allowed: true, action: "delete" };
}
