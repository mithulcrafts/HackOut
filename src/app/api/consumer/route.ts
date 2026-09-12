import { readConsumer, actConsumer } from "@/lib/consumer-server";
export const GET=readConsumer;
export async function POST(request:Request) {return actConsumer(request,["seed","reset"]);}
