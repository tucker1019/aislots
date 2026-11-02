export const ART_TYPES = ['mahjong', 'candy', 'seven', 'ocean', 'gems', 'fruit', 'moon'] as const;
export type GameArt = (typeof ART_TYPES)[number];
export type Category = 'all' | 'cascade' | 'lines';
export type LobbyView = 'discover' | 'favorites' | 'recent';
export interface Game {
  id: string;
  title: string;
  subtitle: string;
  category: Exclude<Category, 'all'>;
  art: GameArt;
  status: 'available' | 'upcoming';
  featured: boolean;
  isNew: boolean;
  description: string;
  tags: string[];
  launchUrl?: string;
}
