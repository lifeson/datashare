export interface ExpiryBadge {
  text: string;
  expired: boolean;
}

/** Libellé court d'expiration pour la liste « Mes fichiers ». */
export function expiryBadge(item: {
  status: string;
  expiresAt: string;
}): ExpiryBadge {
  const expired =
    item.status === 'expired' ||
    new Date(item.expiresAt).getTime() <= Date.now();

  if (expired) {
    return { text: 'Expiré', expired: true };
  }
  const days = Math.ceil(
    (new Date(item.expiresAt).getTime() - Date.now()) / 86_400_000,
  );
  return {
    text: days <= 1 ? 'Expire demain' : `Expire dans ${days} jours`,
    expired: false,
  };
}