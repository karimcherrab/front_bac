import axios from "axios";

const BASE_URL =
  import.meta.env.VITE_BASE_URL?.replace(/\/+$/, "") || "";

const EXPLICIT_PAYMENT_URL =
  import.meta.env.VITE_PAYMENT_URL?.replace(/\/+$/, "") || "";

export const PAYMENT_API_URL =
  EXPLICIT_PAYMENT_URL ||
  (BASE_URL ? `${BASE_URL}/api/payments` : "");

function authConfig(token, extra = {}) {
  return {
    ...extra,
    headers: {
      ...(extra.headers || {}),
      ...(token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {}),
    },
  };
}

function ensurePaymentUrl() {
  if (!PAYMENT_API_URL) {
    throw new Error(
      "VITE_BASE_URL غير مضبوط، لذلك تعذر تحديد رابط الدفع.",
    );
  }
}

export function normalizeList(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  if (Array.isArray(data?.packs)) {
    return data.packs;
  }

  if (Array.isArray(data?.purchases)) {
    return data.purchases;
  }

  return [];
}

export function getApiErrorMessage(
  error,
  fallback = "حدث خطأ غير متوقع.",
) {
  const data = error?.response?.data;

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (typeof data?.message === "string") {
    return data.message;
  }

  if (typeof error?.message === "string") {
    return error.message;
  }

  return fallback;
}

export async function getPacks({
  token,
  subjectId,
  chapterId,
  type,
  signal,
} = {}) {
  ensurePaymentUrl();

  const params = new URLSearchParams();

  if (subjectId) {
    params.set("subject", subjectId);
  }

  if (chapterId) {
    params.set("chapter", chapterId);
  }

  if (type) {
    params.set("type", type);
  }

  const query = params.toString();

  const response = await axios.get(
    `${PAYMENT_API_URL}/packs/${query ? `?${query}` : ""}`,
    authConfig(token, {
      signal,
      timeout: 15000,
    }),
  );

  return normalizeList(response.data);
}

export async function createCheckout({
  token,
  packId,
  paymentMethod,
}) {
  ensurePaymentUrl();

  const payload = {
    pack_id: packId,
  };

  if (paymentMethod) {
    payload.payment_method = paymentMethod;
  }

  const response = await axios.post(
    `${PAYMENT_API_URL}/checkout/`,
    payload,
    authConfig(token, {
      timeout: 20000,
    }),
  );

  return response.data;
}

export async function getPurchase({
  token,
  purchaseId,
  signal,
}) {
  ensurePaymentUrl();

  const response = await axios.get(
    `${PAYMENT_API_URL}/purchases/${purchaseId}/`,
    authConfig(token, {
      signal,
      timeout: 15000,
    }),
  );

  return response.data;
}

export async function refreshPurchase({
  token,
  purchaseId,
}) {
  ensurePaymentUrl();

  const response = await axios.post(
    `${PAYMENT_API_URL}/purchases/${purchaseId}/refresh/`,
    {},
    authConfig(token, {
      timeout: 20000,
    }),
  );

  return response.data;
}

export async function getMyPurchases({
  token,
  signal,
}) {
  ensurePaymentUrl();

  const response = await axios.get(
    `${PAYMENT_API_URL}/my-purchases/`,
    authConfig(token, {
      signal,
      timeout: 15000,
    }),
  );

  return normalizeList(response.data);
}

export async function checkChapterAccess({
  token,
  chapterId,
  signal,
}) {
  ensurePaymentUrl();

  const response = await axios.get(
    `${PAYMENT_API_URL}/access/chapters/${chapterId}/`,
    authConfig(token, {
      signal,
      timeout: 15000,
    }),
  );

  return response.data;
}

export function formatDzd(value) {
  const amount = Number(value || 0);

  return `${new Intl.NumberFormat("ar-DZ").format(amount)} دج`;
}
