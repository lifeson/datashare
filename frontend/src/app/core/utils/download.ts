/** Déclenche l'enregistrement d'un blob sous `filename` dans le navigateur. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Extrait le nom de fichier d'un en-tête Content-Disposition. */
export function filenameFromHeader(
  header: string | null,
  fallback: string,
): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return fallback;
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : fallback;
}

/** Libellé d'expiration à partir de la date ISO. */
export function expiryHint(expiresAt: string): {
  text: string;
  tone: 'info' | 'warn';
} {
  const days = Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  if (days <= 1) {
    return { text: 'Ce fichier expirera demain.', tone: 'warn' };
  }
  return { text: `Ce fichier expirera dans ${days} jours.`, tone: 'info' };
}