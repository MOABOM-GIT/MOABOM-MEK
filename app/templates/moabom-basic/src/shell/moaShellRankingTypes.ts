export type ShellRankingChange = 'up' | 'down' | 'same';

export type ShellAppRankingItem = {
  app_id: string;
  rank: number;
  change: ShellRankingChange;
  open_hits: number;
  active_seconds: number;
  score: number;
};

export type ShellUserRankingItem = {
  user_id: number;
  name: string;
  score: number;
  rank: number;
  change: ShellRankingChange;
};

export type ShellAppRankingsPayload = {
  period_hours: number;
  generated_at: string;
  items: ShellAppRankingItem[];
};

export type ShellUserRankingsPayload = {
  period_hours: number;
  generated_at: string;
  items: ShellUserRankingItem[];
};
