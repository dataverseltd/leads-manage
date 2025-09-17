import { useEffect, useState } from "react";

export type Product = { _id: string; name: string; month?: string };

export function getWorkingMonthBD(date = new Date()) {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const bdt = new Date(utc + 6 * 60 * 60000);
  const y = bdt.getFullYear();
  const m = String(bdt.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function useProducts(companyId?: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const month = getWorkingMonthBD();
    const url = companyId
      ? `/api/products?month=${month}&companyId=${companyId}`
      : `/api/products?month=${month}`;
    setLoading(true);
    fetch(url, { cache: "no-store", credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d) ? d : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [companyId]);

  return { products, loading };
}
