// Pure display helpers for the Test Console.

const PREVIEW_LENGTH = 80;

export function formatLogTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
}

/** Returns `{ full, preview, isTruncated }` for a log entry's data. */
export function formatLogData(data) {
  try {
    const full = JSON.stringify(data, null, 2);
    const compact = JSON.stringify(data, null, 0);
    if (compact.length > PREVIEW_LENGTH) {
      return {
        full,
        preview: compact.substring(0, PREVIEW_LENGTH) + "…",
        isTruncated: true,
      };
    }
    return { full, preview: compact, isTruncated: false };
  } catch {
    const full = String(data);
    return { full, preview: full, isTruncated: false };
  }
}

export function maskToken(token) {
  if (!token || token.length < 20) return token;
  return token.substring(0, 10) + "..." + token.substring(token.length - 10);
}

const VERIFY_STATUS = {
  verified: { label: "Verified", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  verifying: { label: "Verifying…", tone: "info" },
};

/** Maps the raw bootstrap verifyStatus to a Badge label/tone. */
export function describeVerifyStatus(status) {
  return VERIFY_STATUS[status] || { label: "Not verified", tone: "neutral" };
}
