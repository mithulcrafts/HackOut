import { z } from "zod";

export const consumerActionSchema = z.object({
  command: z.enum(["seed", "accept", "skip", "modify", "override", "simulate", "verify", "reset"]),
  offerId: z.string().uuid().optional(), version: z.number().int().positive().optional(),
  startSlot: z.number().int().min(26).max(28).optional(),
  outcome: z.enum(["success", "partial", "missing", "late", "rebound"]).optional(),
}).strict().superRefine((v, ctx) => {
  if (v.command !== "seed" && (!v.offerId || !v.version)) ctx.addIssue({code:"custom",message:"Offer ID and version required"});
  if (v.command === "modify" && v.startSlot === undefined) ctx.addIssue({code:"custom",message:"Choose a new start time"});
  if (v.command === "simulate" && !v.outcome) ctx.addIssue({code:"custom",message:"Choose a simulated outcome"});
});
export type ConsumerAction = z.infer<typeof consumerActionSchema>;
export type ConsumerState = {
  offer: null | {id:string; name:string; version:number; decision:"pending"|"accepted"|"skipped"|"overridden"; baseline_start:number; proposed_start:number; duration_slots:number; deadline_slot:number; required_kwh:number; power_kw:number; simulation_run:boolean; completion_slot:number|null};
  readings: {slot:number;cumulative_kwh:number}[];
  verification: null | {status:"verified"|"partial"|"failed";reason:string;recorded_kwh:number;eligible_kwh:number;baseline_kwh:number;created_at:string};
  rewards: {id:string;points:number;illustrative_rupees:number;state:"pending"|"verified"|"redeemable";created_at:string}[];
  notifications: {id:string;message:string;created_at:string}[];
};
export function slotTime(slot:number) { return `${String(Math.floor(slot/2)).padStart(2,"0")}:${slot%2 ? "30" : "00"}`; }
export const emptyConsumerState: ConsumerState = {offer:null,readings:[],verification:null,rewards:[],notifications:[]};
