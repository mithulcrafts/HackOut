import { z } from "zod";

export type ConsumerNotificationKind =
  | "offer"
  | "expired"
  | "accepted"
  | "upcoming"
  | "start"
  | "activity_status"
  | "deadline"
  | "verification_pending"
  | "verification"
  | "review"
  | "reward"
  | "skipped"
  | "overridden"
  | "recovery";

export type ConsumerNotificationPriority = "normal" | "important";

/**
 * Statuses shown to a participant.  These are deliberately separate from
 * the domain's mutation decisions (`accept`, `skip`, etc.): an offer can be
 * pending in storage while its response window has expired for the user.
 */
export type ConsumerOfferDecision = "pending" | "accepted" | "expired" | "skipped" | "overridden";

export const consumerActionSchema = z.object({
  command: z.enum(["seed", "accept", "skip", "modify", "override", "simulate", "verify", "reset"]),
  offerId: z.string().min(1).max(120).optional(), version: z.number().int().positive().optional(),
  startSlot: z.number().int().min(0).max(47).optional(),
  outcome: z.enum(["success", "partial", "missing", "late", "rebound"]).optional(),
}).strict().superRefine((v, ctx) => {
  if (!['seed','reset'].includes(v.command) && (!v.offerId || !v.version)) ctx.addIssue({code:"custom",message:"Offer ID and version required"});
  if (v.command === "modify" && v.startSlot === undefined) ctx.addIssue({code:"custom",message:"Choose a new start time"});
  if (v.command === "simulate" && !v.outcome) ctx.addIssue({code:"custom",message:"Choose a simulated outcome"});
});
export type ConsumerAction = z.infer<typeof consumerActionSchema>;
export type ConsumerState = {
  availableOffers?: {id:string;name:string;decision:ConsumerOfferDecision|string}[];
  upcoming?: { id: string; name: string; proposed_start: number; duration_slots: number; deadline_slot: number; decision: ConsumerOfferDecision|string }[];
  rewardSummary?: { verifiedRupees: number; pendingRupees: number; points: number };
  offer: null | {id:string; name:string; version:number; decision:ConsumerOfferDecision; reward_eligible?:boolean; baseline_start:number; proposed_start:number; duration_slots:number; deadline_slot:number; required_kwh:number; power_kw:number; simulation_run:boolean; completion_slot:number|null; expires_at?: string | null};
  readings: {slot:number;cumulative_kwh:number}[];
  verification: null | {status:"pending"|"verified"|"partial"|"failed"|"needs_review";reason:string;recorded_kwh:number;eligible_kwh:number;baseline_kwh:number;created_at:string};
  rewards: {id:string;points:number;illustrative_rupees:number;state:"pending"|"verified"|"redeemable";created_at:string}[];
  notifications: {
    id:string;
    message:string;
    created_at:string;
    read_at?:string|null;
    /** Optional metadata lets clients group/filter lifecycle updates without
     * changing the message contract used by the authenticated snapshot. */
    kind?: ConsumerNotificationKind;
    priority?: ConsumerNotificationPriority;
    offer_id?: string;
    activity_id?: string;
  }[];
  reviewRequest?: { id: string; offer_id: string; status: "open" | "acknowledged"; created_at: string } | null;
  recovery?: { eventId: string; lostActivityId: string; lostPowerKW: number; replacementOfferIds: string[]; batterySupportKW: number; unresolvedGapKW: number; createdAt: string } | null;
};
export function slotTime(slot:number) { return `${String(Math.floor(slot/2)).padStart(2,"0")}:${slot%2 ? "30" : "00"}`; }
export const emptyConsumerState: ConsumerState = {offer:null,readings:[],verification:null,rewards:[],notifications:[],reviewRequest:null};
