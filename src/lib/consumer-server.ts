import { NextResponse } from "next/server";
import { createClient } from "./supabase/server";
import { consumerActionSchema } from "./consumer";
import { consumerView } from "./consumer-view";
import { syncConsumerToOperator } from "./consumer-integration";
import { setDemoCookie } from "./demo-cookie";
import { getScenario } from "./demo-store";

export async function readConsumer() {
  let db;
  try { db=await createClient(); } catch { return NextResponse.json({error:"Consumer storage is not configured for this environment."},{status:503}); }
  const {data:{user}}=await db.auth.getUser();
  if(!user) return NextResponse.json({error:"Sign in to use your consumer demo."},{status:401});
  const {data,error}=await db.rpc("consumer_snapshot");
  if(error) return NextResponse.json({error:"Consumer storage is unavailable. Please retry."},{status:503});
  const session = await syncConsumerToOperator("load", data);
  const response = NextResponse.json(consumerView(data, getScenario(session)));
  setDemoCookie(response, session);
  return response;
}
export async function actConsumer(request:Request, allowed?:string[]) {
  const parsed=consumerActionSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success || (allowed && !allowed.includes(parsed.data.command))) return NextResponse.json({error:"Invalid consumer action."},{status:400});
  let db;
  try { db=await createClient(); } catch { return NextResponse.json({error:"Consumer storage is not configured for this environment."},{status:503}); }
  const {data:{user}}=await db.auth.getUser();
  if(!user) return NextResponse.json({error:"Sign in to continue."},{status:401});
  const v=parsed.data;
  const {data,error}=await db.rpc("consumer_action",{command:v.command,target_offer:v.offerId??null,expected_version:v.version??null,start_slot:v.startSlot??null,outcome:v.outcome??null});
  if(error) {
    const safeCodes=["P0001","P0002","40001"];
    return NextResponse.json({error:safeCodes.includes(error.code)?error.message:"Consumer storage is unavailable. Please retry."},{status:safeCodes.includes(error.code)?409:503});
  }
  const session = await syncConsumerToOperator(v.command, data);
  const response = NextResponse.json(consumerView(data, getScenario(session)));
  setDemoCookie(response, session);
  return response;
}
