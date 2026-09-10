/** Fichier renvoyé par l'API (POST /api/files, GET /api/files). */
export interface FileItem {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  tags: string[];
  isProtected: boolean;
  status: 'active' | 'expired';
  expiresAt: string;
  downloadCount: number;
  downloadToken?: string;
  downloadUrl?: string;
  createdAt: string;
}
