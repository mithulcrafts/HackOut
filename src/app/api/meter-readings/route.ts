import { actConsumer } from '@/lib/consumer-server';
export async function POST(request:Request) {return actConsumer(request,['simulate']);}
