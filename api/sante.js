import { gererSante, gererSanteDetaillee } from '../src/robot/http.ts';
export function GET(request) {
  return new URL(request.url).searchParams.has('notes') ? gererSanteDetaillee(process.env) : gererSante();
}
