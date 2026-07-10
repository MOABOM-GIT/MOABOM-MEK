export type ShellRankingChange = 'up' | 'down' | 'same';

export type ShellAppRankingItem = {
  app_id: string;
  rank: number;
  change: ShellRankingChange;
  open_hits: number;
  active_seconds: number;
  score: number;
};

export type ShellUserRankingLevel = {
  level: number;
  slug: string;
  progress_ratio?: number;
};

export type ShellUserRankingItem = {
  user_id: number;
  user_uuid: string;
  name: string;
  score: number;
  rank: number;
  change: ShellRankingChange;
  is_self?: boolean;
  level?: ShellUserRankingLevel | null;
};

export type ShellAppRankingsPayload = {
  period_hours: number;
  change_period_hours?: number;
  generated_at: string;
  items: ShellAppRankingItem[];
};

export type ShellUserRankingsPayload = {
  period_hours: number;
  change_period_hours?: number;
  generated_at: string;
  viewer_outside_top?: boolean;
  items: ShellUserRankingItem[];
};
