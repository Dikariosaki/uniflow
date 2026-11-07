export interface Slot {
  id: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  available: number;
  active?: boolean;
}
export interface Order {
  id: string;
  pickupCode?: string;
  status: string;
  totalCop: number;
  token?: string;
  slot?: string;
  customerAlias?: string;
  customerPhone?: string;
  pickupMode?: string;
  createdAt?: string;
  events?: Array<{
    previousStatus?: string;
    newStatus: string;
    actorLabel?: string;
    reason?: string;
    createdAt: string;
  }>;
  items: Array<{ nameSnapshot: string; quantity: number; unitPriceCop?: number; subtotalCop?: number }>;
}
