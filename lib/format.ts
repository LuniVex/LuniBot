const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export const fmtDate = (iso: string) => dateFmt.format(new Date(iso));
export const fmtSize = (bytes: number) => (bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`);
export const fmtNum = (n: number) => n.toLocaleString("en-GB");
