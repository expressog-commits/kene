const numberFr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

const dateShort = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

const dateLong = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const timeFr = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
});

/** 2 500 FCFA */
export const fcfa = (value: number) =>
  `${numberFr.format(Math.round(Number.isFinite(value) ? value : 0))} FCFA`;

/** 2 500 F */
export const fcfaShort = (value: number) =>
  `${numberFr.format(Math.round(Number.isFinite(value) ? value : 0))} F`;

export const formatDate = (iso?: string) =>
  iso ? dateShort.format(new Date(`${iso.slice(0, 10)}T12:00:00`)) : "—";

export const formatLongDate = (date: Date) => dateLong.format(date);

export const formatTime = (iso?: string | Date) =>
  iso ? timeFr.format(typeof iso === "string" ? new Date(iso) : iso) : "—";

export const formatDateTime = (iso?: string) =>
  iso ? `${formatDate(iso)}, ${formatTime(iso)}` : "—";

export function phoneDisplay(phone?: string): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("225") ? digits.slice(3) : digits;
  if (local.length !== 10) return phone;
  return `+225 ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)} ${local.slice(8)}`;
}

export function digitsOnly(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("225")) return digits;
  if (digits.length === 10) return `225${digits}`;
  return digits;
}

export function waLink(phone: string, message: string): string {
  return `https://wa.me/${digitsOnly(phone)}?text=${encodeURIComponent(message)}`;
}

export function mapsLink(
  name: string,
  address: string,
  quartier?: string,
): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [name, address, quartier, "Abidjan"].filter(Boolean).join(" "),
  )}`;
}

export const distanceLabel = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "hier" : `il y a ${days} j`;
}
