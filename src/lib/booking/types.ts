import type { ServiceId } from "@/config/service-core";

export type BookingDurationMinutes = 30 | 60 | 90 | 120;
export type BookingStatus = "confirmed" | "checked_in" | "completed" | "no_show" | "cancelled";

export interface BookingLineItem {
  serviceId: ServiceId;
  quantity: number;
  additionalControllers?: number;
}

export interface BookingRequest {
  start: string;
  durationMinutes: BookingDurationMinutes;
  items: BookingLineItem[];
  customer: { name: string; phone: string; email?: string; notes?: string };
  idempotencyKey: string;
}

export interface BookingRecord {
  bookingId: string;
  calendarEventIds: string[];
  customer: BookingRequest["customer"];
  start: string;
  end: string;
  durationMinutes: BookingDurationMinutes;
  items: BookingLineItem[];
  includedControllers: number;
  additionalControllers: number;
  totalControllers: number;
  price: { total: number; currency: "MYR"; pricingVersion: string };
  status: BookingStatus;
  createdAt: string;
}

export interface AvailabilitySlot {
  start: string;
  end: string;
  available: boolean;
  capacity: Record<ServiceId, number>;
}

export interface BookingConfirmation {
  bookingId: string;
  start: string;
  end: string;
  durationMinutes: number;
  items: BookingLineItem[];
  customerName: string;
  total: number;
  currency: "MYR";
  replayed?: boolean;
}

export interface BusyInterval { start: string; end: string }
export type BusyByCalendar = Record<string, BusyInterval[]>;
