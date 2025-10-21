export interface ChartDataPoint {
  key: number;
  startDate: Date;
  endDate: Date;
  count: number;
  date: number;
  fill?: string;
}