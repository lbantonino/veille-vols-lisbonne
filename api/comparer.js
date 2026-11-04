import { gererComparer } from '../src/robot/http.ts';
export function POST(request) { return gererComparer(request, process.env); }
