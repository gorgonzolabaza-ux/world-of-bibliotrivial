export interface AchievementDef { id: string; name: string; description: string; }

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_win', name: 'Primera victoria', description: 'Completa una partida.' },
  { id: 'streak_5', name: 'Racha de 5', description: '5 aciertos consecutivos.' },
  { id: 'streak_10', name: 'Racha de 10', description: '10 aciertos consecutivos.' },
  { id: 'no_errors', name: 'Partida perfecta', description: 'Completa sin fallos.' },
  { id: 'speed_demon', name: 'Velocista', description: 'Completa en menos de 5 minutos.' },
];

// dynamic achievements generated for quesitos/perfect themes are also tracked but not listed
export function achievementName(id: string): string {
  if (id.startsWith('quesito_')) return 'Quesito: ' + id.replace('quesito_', '');
  if (id.startsWith('perfect_theme_')) return 'Tema perfecto: ' + id.replace('perfect_theme_', '');
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  return a ? a.name : id;
}
