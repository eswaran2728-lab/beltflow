import { apiClient } from './apiClient';
import { BeltLevelConfig } from '../theme/belts';

export interface CurriculumVersion {
  id: string;
  organization_id: string;
  system_name: string;
  martial_art_style: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  created_by?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
  rank_count?: number;
}

export interface ActiveCurriculumResponse {
  organizationId: string;
  curriculum: CurriculumVersion;
  ranks: BeltLevelConfig[];
}

export interface CurriculumVersionsResponse {
  organizationId: string;
  curriculums: CurriculumVersion[];
}

export interface CurriculumDetailResponse {
  curriculum: CurriculumVersion;
  ranks: BeltLevelConfig[];
}

export interface BeltRankInput {
  name: string;
  rankOrder: number;
  colorHex: string;
  textColor?: string;
  borderColor?: string;
  minMonths?: number;
  minSessions?: number;
  gradingFee?: number;
  syllabusCategory?: string;
  description?: string;
  isDanRank?: boolean;
  danLevel?: number;
}

export const curriculumService = {
  /**
   * Fetch the currently published curriculum and ranks for the tenant.
   * Auto-provisions from defaults if none exists.
   */
  async getActiveCurriculum(organizationId?: string): Promise<ActiveCurriculumResponse> {
    const endpoint = organizationId
      ? `/api/v1/curriculums/active?organizationId=${encodeURIComponent(organizationId)}`
      : '/api/v1/curriculums/active';
    return apiClient.get<ActiveCurriculumResponse>(endpoint);
  },

  /**
   * List all versions (Draft, Published, Archived) for the Persatuan.
   */
  async listVersions(organizationId?: string): Promise<CurriculumVersionsResponse> {
    const endpoint = organizationId
      ? `/api/v1/curriculums?organizationId=${encodeURIComponent(organizationId)}`
      : '/api/v1/curriculums';
    return apiClient.get<CurriculumVersionsResponse>(endpoint);
  },

  /**
   * Fetch specific curriculum version with its belt ranks.
   */
  async getVersionById(id: string): Promise<CurriculumDetailResponse> {
    return apiClient.get<CurriculumDetailResponse>(`/api/v1/curriculums/${id}`);
  },

  /**
   * Create a new draft curriculum version (optionally cloned from existing version).
   */
  async createDraft(payload: {
    systemName?: string;
    martialArtStyle?: string;
    cloneFromVersionId?: string;
  }): Promise<CurriculumDetailResponse> {
    return apiClient.post<CurriculumDetailResponse>('/api/v1/curriculums', payload);
  },

  /**
   * Update top-level metadata of a draft version.
   */
  async updateDraftMetadata(
    id: string,
    payload: { systemName?: string; martialArtStyle?: string }
  ): Promise<{ message: string; curriculum: CurriculumVersion }> {
    return apiClient.put<{ message: string; curriculum: CurriculumVersion }>(`/api/v1/curriculums/${id}`, payload);
  },

  /**
   * Update belt ranks in a draft curriculum version.
   */
  async updateBeltRanks(
    id: string,
    ranks: BeltRankInput[]
  ): Promise<{ message: string; curriculumId: string; ranks: BeltLevelConfig[] }> {
    return apiClient.put<{ message: string; curriculumId: string; ranks: BeltLevelConfig[] }>(
      `/api/v1/curriculums/${id}/ranks`,
      { ranks }
    );
  },

  /**
   * Publish a draft curriculum version atomically (archives any existing published version).
   */
  async publishVersion(id: string): Promise<{
    message: string;
    curriculum: CurriculumVersion;
    ranks: BeltLevelConfig[];
  }> {
    return apiClient.post<{
      message: string;
      curriculum: CurriculumVersion;
      ranks: BeltLevelConfig[];
    }>(`/api/v1/curriculums/${id}/publish`);
  },

  /**
   * Delete a draft curriculum version.
   */
  async deleteDraft(id: string): Promise<{ message: string; deletedId: string }> {
    return apiClient.delete<{ message: string; deletedId: string }>(`/api/v1/curriculums/${id}`);
  },
};
