import type { ServiceId } from "@/config/service-core";

export interface BookingLineItem {
  serviceId: ServiceId;
  quantity: number;
  additionalControllers?: number;
}

export interface BookingRequest {
  start: string;
  durationMinutes: 30 | 60 | 120;
  items: BookingLineItem[];
  customer: { name: string; phone: string; notes?: string };
  idempotencyKey: string;
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
