/**
 * Assessment Entity
 * 評価セッションのエンティティ
 */

import type { TestType } from '../../types';
import type { Landmark } from '../../core/mediapipe/types';

// 評価セッションID
export type AssessmentId = string;

// 評価ステータス
export type AssessmentStatus = 'preparing' | 'recording' | 'analyzing' | 'completed' | 'failed';

// 評価メタデータ
export interface AssessmentMetadata {
  sessionId: AssessmentId;
  patientId?: string;
  therapistId?: string;
  facility?: string;
  testEnvironment: 'clinic' | 'home' | 'research';
  equipmentUsed: string[];
  notes?: string;
}

// 評価設定
export interface AssessmentSettings {
  testType: TestType;
  duration: number;                    // 秒
  frameRate: number;                   // fps
  qualityThreshold: number;            // 0-1
  enableRealTimeAnalysis: boolean;
  enableDetailedReporting: boolean;
}

// ランドマークフレーム
export interface LandmarkFrame {
  timestamp: number;                   // ミリ秒
  landmarks: Landmark[];
  quality: number;                     // 0-1
  confidence: number;                  // 0-1
}

// 評価結果サマリー
export interface AssessmentSummary {
  overallScore: number;                // 0-100
  lumbarControlScore: number;          // 0-100
  movementQualityScore: number;        // 0-100
  stabilityScore: number;              // 0-100
  compensationScore: number;           // 0-100
  clinicalRecommendations: string[];
  riskFactors: string[];
  followUpRequired: boolean;
}

// 評価エンティティ
export class Assessment {
  private readonly id: AssessmentId;
  private readonly metadata: AssessmentMetadata;
  private readonly settings: AssessmentSettings;
  private readonly createdAt: Date;
  private status: AssessmentStatus;
  private startedAt?: Date;
  private completedAt?: Date;
  private landmarkFrames: LandmarkFrame[] = [];
  private summary?: AssessmentSummary;
  private errorMessage?: string;

  constructor(
    metadata: AssessmentMetadata,
    settings: AssessmentSettings
  ) {
    this.id = metadata.sessionId;
    this.metadata = { ...metadata };
    this.settings = { ...settings };
    this.createdAt = new Date();
    this.status = 'preparing';
  }

  // Getters
  getId(): AssessmentId {
    return this.id;
  }

  getMetadata(): Readonly<AssessmentMetadata> {
    return this.metadata;
  }

  getSettings(): Readonly<AssessmentSettings> {
    return this.settings;
  }

  getStatus(): AssessmentStatus {
    return this.status;
  }

  getCreatedAt(): Date {
    return new Date(this.createdAt);
  }

  getStartedAt(): Date | undefined {
    return this.startedAt ? new Date(this.startedAt) : undefined;
  }

  getCompletedAt(): Date | undefined {
    return this.completedAt ? new Date(this.completedAt) : undefined;
  }

  getDuration(): number | undefined {
    if (!this.startedAt) return undefined;
    const endTime = this.completedAt || new Date();
    return endTime.getTime() - this.startedAt.getTime();
  }

  getLandmarkFrames(): readonly LandmarkFrame[] {
    return [...this.landmarkFrames];
  }

  getFrameCount(): number {
    return this.landmarkFrames.length;
  }

  getSummary(): Readonly<AssessmentSummary> | undefined {
    return this.summary ? { ...this.summary } : undefined;
  }

  getErrorMessage(): string | undefined {
    return this.errorMessage;
  }

  // Status Management
  start(): void {
    if (this.status !== 'preparing') {
      throw new Error(`評価を開始できません。現在のステータス: ${this.status}`);
    }
    
    this.status = 'recording';
    this.startedAt = new Date();
    this.landmarkFrames = [];
    this.errorMessage = undefined;
  }

  startAnalysis(): void {
    if (this.status !== 'recording') {
      throw new Error(`解析を開始できません。現在のステータス: ${this.status}`);
    }
    
    this.status = 'analyzing';
  }

  complete(summary: AssessmentSummary): void {
    if (this.status !== 'analyzing') {
      throw new Error(`評価を完了できません。現在のステータス: ${this.status}`);
    }
    
    this.status = 'completed';
    this.completedAt = new Date();
    this.summary = { ...summary };
  }

  fail(errorMessage: string): void {
    this.status = 'failed';
    this.errorMessage = errorMessage;
    
    if (!this.completedAt) {
      this.completedAt = new Date();
    }
  }

  reset(): void {
    this.status = 'preparing';
    this.startedAt = undefined;
    this.completedAt = undefined;
    this.landmarkFrames = [];
    this.summary = undefined;
    this.errorMessage = undefined;
  }

  // Data Management
  addLandmarkFrame(frame: LandmarkFrame): void {
    if (this.status !== 'recording') {
      throw new Error('録画中以外はフレームを追加できません');
    }
    
    // 重複チェック
    const isDuplicate = this.landmarkFrames.some(
      existing => Math.abs(existing.timestamp - frame.timestamp) < 1
    );
    
    if (!isDuplicate) {
      this.landmarkFrames.push({ ...frame });
    }
  }

  addLandmarkFrames(frames: LandmarkFrame[]): void {
    frames.forEach(frame => this.addLandmarkFrame(frame));
  }

  getFramesInTimeRange(startTime: number, endTime: number): LandmarkFrame[] {
    return this.landmarkFrames.filter(
      frame => frame.timestamp >= startTime && frame.timestamp <= endTime
    );
  }

  getAverageQuality(): number {
    if (this.landmarkFrames.length === 0) return 0;
    
    const totalQuality = this.landmarkFrames.reduce(
      (sum, frame) => sum + frame.quality, 0
    );
    
    return totalQuality / this.landmarkFrames.length;
  }

  getAverageConfidence(): number {
    if (this.landmarkFrames.length === 0) return 0;
    
    const totalConfidence = this.landmarkFrames.reduce(
      (sum, frame) => sum + frame.confidence, 0
    );
    
    return totalConfidence / this.landmarkFrames.length;
  }

  // Validation
  isValidForAnalysis(): boolean {
    return (
      this.landmarkFrames.length > 0 &&
      this.getAverageQuality() >= this.settings.qualityThreshold &&
      this.getDuration() !== undefined &&
      this.getDuration()! >= 1000 // 最低1秒
    );
  }

  getValidationErrors(): string[] {
    const errors: string[] = [];
    
    if (this.landmarkFrames.length === 0) {
      errors.push('ランドマークデータがありません');
    }
    
    if (this.getAverageQuality() < this.settings.qualityThreshold) {
      errors.push(`データ品質が不十分です (${this.getAverageQuality().toFixed(2)} < ${this.settings.qualityThreshold})`);
    }
    
    const duration = this.getDuration();
    if (!duration || duration < 1000) {
      errors.push('録画時間が不十分です（最低1秒必要）');
    }
    
    return errors;
  }

  // Export
  toJSON() {
    return {
      id: this.id,
      metadata: this.metadata,
      settings: this.settings,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      startedAt: this.startedAt?.toISOString(),
      completedAt: this.completedAt?.toISOString(),
      frameCount: this.landmarkFrames.length,
      averageQuality: this.getAverageQuality(),
      averageConfidence: this.getAverageConfidence(),
      duration: this.getDuration(),
      summary: this.summary,
      errorMessage: this.errorMessage
    };
  }

  // Factory Methods
  static createNew(
    testType: TestType,
    patientId?: string,
    therapistId?: string
  ): Assessment {
    const sessionId = `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const metadata: AssessmentMetadata = {
      sessionId,
      patientId,
      therapistId,
      testEnvironment: 'clinic',
      equipmentUsed: ['MediaPipe Pose Landmarker']
    };
    
    const settings: AssessmentSettings = {
      testType,
      duration: 30,
      frameRate: 30,
      qualityThreshold: 0.5,
      enableRealTimeAnalysis: true,
      enableDetailedReporting: true
    };
    
    return new Assessment(metadata, settings);
  }
}