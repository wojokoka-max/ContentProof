import type { AnalysisResult, InputMode } from './types';

export interface AnalysisHistorySummary {
  id: string;
  analysisId: string;
  ownerId?: string;
  title: string;
  inputMode: InputMode;
  sourceLabel: string | null;
  overallScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedAnalysis extends AnalysisHistorySummary {
  input: string;
  result: AnalysisResult;
}

export interface SaveAnalysisPayload {
  analysisId: string;
  title: string;
  inputMode: InputMode;
  sourceLabel: string | null;
  input: string;
  result: AnalysisResult;
}
