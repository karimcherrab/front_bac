import {
  useEffect,
  useState,
} from "react";

import {
  getApiErrorMessage,
  getPacks,
} from "../services/paymentApi";

export default function useSubjectPacks({
  subjectId,
  token,
  refreshKey = 0,
}) {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      if (!subjectId) {
        setPacks([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const result = await getPacks({
          token,
          subjectId,
          signal: controller.signal,
        });

        setPacks(result);
      } catch (requestError) {
        if (
          requestError?.name === "CanceledError" ||
          requestError?.code === "ERR_CANCELED"
        ) {
          return;
        }

        console.error(
          "Error loading payment packs:",
          requestError,
        );

        setPacks([]);
        setError(
          getApiErrorMessage(
            requestError,
            "تعذر تحميل أسعار هذه المادة.",
          ),
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      controller.abort();
    };
  }, [
    refreshKey,
    subjectId,
    token,
  ]);

  return {
    packs,
    loading,
    error,
  };
}
