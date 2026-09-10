/**
 * Extensions interdites au téléversement (politique de sécurité, US01).
 *
 * Le contrôle porte sur l'extension du nom d'origine. Le type MIME étant
 * facilement falsifiable, ce filtrage reste volontairement simple pour le
 * prototype (voir SECURITY.md pour l'analyse et les limites).
 */
export const FORBIDDEN_EXTENSIONS: readonly string[] = [
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.scr',
  '.cpl',
  '.ps1',
  '.psm1',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.jar',
  '.wsf',
  '.wsh',
  '.hta',
  '.sh',
  '.bash',
  '.app',
  '.dmg',
];

/** Nombre de tours bcrypt pour les mots de passe de fichiers. */
export const FILE_BCRYPT_ROUNDS = 12;

/** Longueur du jeton public de téléchargement (nanoid). */
export const DOWNLOAD_TOKEN_LENGTH = 21;

/** Durée d'expiration par défaut, en jours. */
export const DEFAULT_EXPIRY_DAYS = 7;
