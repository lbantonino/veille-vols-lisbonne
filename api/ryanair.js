import { gererRyanair } from '../src/robot/http.ts';
export function POST(request) { return gererRyanair(request, process.env); }
