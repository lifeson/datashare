export interface FileMeta {
  originalName: string;
  size: number;
  mimeType: string;
  isProtected: boolean;
  expiresAt: string;
  expired: boolean;
}