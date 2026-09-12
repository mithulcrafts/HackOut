import { NextResponse } from "next/server";
import { createClient } from "./supabase/server";
import { consumerActionSchema } from "./consumer";

export async function readConsumer() {
  const db=await createClient(); const {data:{user}}=await db.auth.getUser();
  if(!user) return NextResponse.json({error:"Sign in to use your consumer demo."},{status:401});
  const {data,error}=await db.rpc("consumer_snapshot");
  if(error) return NextResponse.json({error:"Consumer storage is unavailable. Please retry."},{status:503});
  return NextResponse.json(data);
}
export async function actConsumer(request:Request, allowed?:string[]) {
  const parsed=consumerActionSchema.safeParse(await request.json().catch(()=>null));
  if(!parsed.success || (allowed && !allowed.includes(parsed.data.command))) return NextResponse.json({error:"Invalid consumer action."},{status:400});
  const db=await createClient(); const {data:{user}}=await db.auth.getUser();
  if(!user) return NextResponse.json({error:"Sign in to continue."},{status:401});
  const v=parsed.data;
  const {data,error}=await db.rpc("consumer_action",{command:v.command,target_offer:v.offerId??null,expected_version:v.version??null,start_slot:v.startSlot??null,outcome:v.outcome??null});
  if(error) {
    const safeCodes=["P0001","P0002","40001"];
    return NextResponse.json({error:safeCodes.includes(error.code)?error.message:"Consumer storage is unavailable. Please retry."},{status:safeCodes.includes(error.code)?409:503});
  }
  return NextResponse.json(data);
}
