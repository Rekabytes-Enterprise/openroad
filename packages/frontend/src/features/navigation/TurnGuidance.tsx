import { CircleHelp, Flag, LocateFixed, RotateCcw } from 'lucide-react';
import type { RouteStep } from '../routing/route';

const paths: Record<string, string> = {
  straight: 'M24 42V6 M15 15L24 6L33 15',
  left: 'M30 42V25Q30 16 21 16H6 M15 7L6 16L15 25',
  right: 'M18 42V25Q18 16 27 16H42 M33 7L42 16L33 25',
  'slight left': 'M29 42V28Q29 22 24 17L10 5 M10 18V5H23',
  'slight right': 'M19 42V28Q19 22 24 17L38 5 M25 5H38V18',
  'sharp left': 'M30 42V12Q30 5 24 11L7 28 M7 15V28H20',
  'sharp right': 'M18 42V12Q18 5 24 11L41 28 M28 28H41V15',
  uturn: 'M34 42V16A10 10 0 0 0 14 16V30 M6 22L14 30L22 22',
};
function RoadArrow({ indications, className }: { indications: string[]; className?: string }) {
  return <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{indications.map((direction, index) => <path key={`${direction}-${index}`} d={paths[direction]} />)}</svg>;
}
export function ManeuverIcon({ step, active, arrived }: { step: RouteStep | undefined; active: boolean; arrived: boolean }) {
  if (!active) return <LocateFixed className="maneuver-icon" aria-hidden="true" />;
  if (arrived || step?.type === 'arrive') return <Flag className="maneuver-icon" aria-hidden="true" />;
  if (step?.type.includes('roundabout') || step?.type.includes('rotary')) return <RotateCcw className="maneuver-icon" aria-hidden="true" />;
  const direction = step?.modifier || 'straight';
  if (!Object.hasOwn(paths, direction)) return <CircleHelp className="maneuver-icon" aria-hidden="true" />;
  return <RoadArrow className="maneuver-icon" indications={[direction]} />;
}
