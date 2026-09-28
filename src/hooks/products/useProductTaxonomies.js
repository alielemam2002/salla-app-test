import { useEffect, useState } from "react";
import { fetchTaxonomies } from "../../utils/productsApi.js";
import logger from "../../utils/logger.js";

const EMPTY = { categories: [], brands: [] };

/** Store categories and brands, loaded once a token is available. */
export function useProductTaxonomies(getToken) {
  const [taxonomies, setTaxonomies] = useState(EMPTY);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    fetchTaxonomies(token)
      .then((res) => {
        if (res.success) {
          setTaxonomies({
            categories: res.categories || [],
            brands: res.brands || [],
          });
        }
      })
      .catch((err) => {
        logger.warn("Could not load taxonomies:", err);
      });
  }, [getToken]);

  return taxonomies;
}
