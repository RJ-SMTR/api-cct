export const DASHBOARD_DATE_TYPES = ['tentative', 'effective'] as const;

export type DashboardDateType = (typeof DASHBOARD_DATE_TYPES)[number];

export const DEFAULT_DASHBOARD_DATE_TYPE: DashboardDateType = 'tentative';
