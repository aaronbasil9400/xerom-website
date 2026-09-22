import type { ConfigRevision, Promotion, ServiceId } from "@/lib/config/schema";
import type { QuoteRequest } from "./contracts";

export interface QuoteCandidateExplanation {
  candidateId: string;
  eligible: boolean;
  reason: string;
}

export interface CalculatedQuoteLine {
  serviceId: ServiceId;
  quantity: number;
  baseAmountSenPerResource: number;
  selectedAmountSenPerResource: number;
  selectedPromotionId: string | null;
  savingsSen: number;
  addOnAmountSen: number;
  lineTotalSen: number;
  explanations: QuoteCandidateExplanation[];
}

export interface CalculatedQuote {
  currency: "MYR";
  configRevision: string;
  pricingEngineVersion: "race-control-v1";
  lines: CalculatedQuoteLine[];
  totalSen: number;
}

const MYT_OFFSET_MS = 8 * 60 * 60 * 1_000;
const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

function localDateFromEpoch(epoch: number): string {
  return new Date(epoch + MYT_OFFSET_MS).toISOString().slice(0, 10);
}

function localEpoch(date: string, time: string, dayOffset = 0): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return Date.UTC(year, month - 1, day + dayOffset, hour, minute) - MYT_OFFSET_MS;
}

function addLocalDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function weekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function minutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function resolveBusinessDate(config: ConfigRevision, startEpoch: number, endEpoch: number): string {
  const localDate = localDateFromEpoch(startEpoch);
  for (const candidate of [localDate, addLocalDays(localDate, -1)]) {
    const intervals = config.hours.exceptions.find((exception) => exception.businessDate === candidate)?.intervals ?? config.hours.weekly[dayNames[weekday(candidate)]];
    if (intervals.some((interval) => startEpoch >= localEpoch(candidate, interval.open) && endEpoch <= localEpoch(candidate, interval.close, interval.closeDayOffset))) return candidate;
  }
  throw new Error("The requested interval is outside configured opening hours.");
}

function offerEligibilityReason(promotion: Promotion, request: QuoteRequest, serviceId: ServiceId, businessDate: string, startEpoch: number, endEpoch: number): string | null {
  if (promotion.state !== "enabled") return "Offer is not enabled.";
  const eligibility = promotion.eligibility;
  if (!eligibility.serviceIds.includes(serviceId)) return "Service is not eligible.";
  if (!eligibility.channels.includes(request.channel)) return "Booking channel is not eligible.";
  if (!eligibility.weekdays.includes(weekday(businessDate))) return "Business weekday is not eligible.";
  if (eligibility.startDate && businessDate < eligibility.startDate) return "Offer has not started.";
  if (eligibility.endDate && businessDate > eligibility.endDate) return "Offer has expired for this booking date.";
  if (!eligibility.durationMinutes.includes(request.durationMinutes)) return "Duration is not eligible.";
  if (promotion.type === "duration-package" && promotion.packageDurationMinutes !== request.durationMinutes) return "Package duration does not match.";
  if (eligibility.startTime && eligibility.endTime) {
    const offerStart = localEpoch(businessDate, eligibility.startTime);
    const endOffset = minutes(eligibility.endTime) <= minutes(eligibility.startTime) ? 1 : 0;
    const offerEnd = localEpoch(businessDate, eligibility.endTime, endOffset);
    if (startEpoch < offerStart || endEpoch > offerEnd) return "The full session does not fit the offer window.";
  }
  return null;
}

function percentageAmount(base: number, basisPoints: number): number {
  return Math.floor((base * (10_000 - basisPoints) + 5_000) / 10_000);
}

export function calculateRuntimeQuote(config: ConfigRevision, request: QuoteRequest): CalculatedQuote {
  if (!config.bookingRules.allowedDurationsMinutes.includes(request.durationMinutes)) throw new Error("Duration is not allowed by the active configuration.");
  const controllerQuantity = request.items.filter((item) => item.serviceId === "ps5").reduce((total, item) => total + (item.additionalControllers ?? 0), 0);
  if (controllerQuantity > config.controllers.maxAdditionalQuantity) throw new Error("Too many additional controllers were requested.");
  const startEpoch = Date.parse(request.start);
  const endEpoch = startEpoch + request.durationMinutes * 60_000;
  if (!Number.isFinite(startEpoch)) throw new Error("Start time is invalid.");
  const businessDate = resolveBusinessDate(config, startEpoch, endEpoch);

  const lines = request.items.map((item): CalculatedQuoteLine => {
    const rates = config.rates.filter((rate) => rate.serviceId === item.serviceId && Date.parse(rate.effectiveFrom) <= startEpoch && (!rate.effectiveUntil || startEpoch < Date.parse(rate.effectiveUntil)));
    if (rates.length !== 1) throw new Error(`Exactly one base rate must apply to ${item.serviceId}.`);
    const base = Math.floor((rates[0].amountSenPerResourceHour * request.durationMinutes) / 60);
    const candidates: Array<{ candidateId: string; amount: number; priority: number }> = [{ candidateId: "base", amount: base, priority: Number.MAX_SAFE_INTEGER }];
    const explanations: QuoteCandidateExplanation[] = [{ candidateId: "base", eligible: true, reason: "Base rate applies." }];
    for (const promotion of config.promotions) {
      const ineligibleReason = offerEligibilityReason(promotion, request, item.serviceId, businessDate, startEpoch, endEpoch);
      explanations.push({ candidateId: promotion.promotionId, eligible: !ineligibleReason, reason: ineligibleReason ?? "Eligible candidate." });
      if (ineligibleReason) continue;
      candidates.push({
        candidateId: promotion.promotionId,
        amount: promotion.type === "percentage" ? percentageAmount(base, promotion.percentageBasisPoints) : promotion.packagePriceSenPerResource,
        priority: promotion.priority,
      });
    }
    candidates.sort((left, right) => left.amount - right.amount || (left.candidateId === "base" ? -1 : right.candidateId === "base" ? 1 : right.priority - left.priority || left.candidateId.localeCompare(right.candidateId)));
    const selected = candidates[0];
    return {
      serviceId: item.serviceId,
      quantity: item.quantity,
      baseAmountSenPerResource: base,
      selectedAmountSenPerResource: selected.amount,
      selectedPromotionId: selected.candidateId === "base" ? null : selected.candidateId,
      savingsSen: (base - selected.amount) * item.quantity,
      addOnAmountSen: item.serviceId === "ps5" ? (item.additionalControllers ?? 0) * config.controllers.additionalPriceSen : 0,
      lineTotalSen: selected.amount * item.quantity + (item.serviceId === "ps5" ? (item.additionalControllers ?? 0) * config.controllers.additionalPriceSen : 0),
      explanations,
    };
  });

  return {
    currency: "MYR",
    configRevision: config.revisionId,
    pricingEngineVersion: "race-control-v1",
    lines,
    totalSen: lines.reduce((total, line) => total + line.lineTotalSen, 0),
  };
}
