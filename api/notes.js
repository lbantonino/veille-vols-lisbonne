import { gererNotes } from '../src/robot/http.ts';
export function GET(request) { return gererNotes(request, process.env); }
