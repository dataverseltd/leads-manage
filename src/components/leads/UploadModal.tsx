"use client";

import React, { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { Transition, Dialog } from "@headlessui/react";
import toast from "react-hot-toast";
import { FiX, FiUploadCloud, FiTrash2 } from "react-icons/fi";
import { Product } from "@/hooks/useProducts";
import { getWorkingDayBD } from "@/lib/getWorkingDay";

type Shot = {
  _id: string;
  url: string;
  productName?: string;
  product?: string;
};

export function UploadModal({
  open,
  onClose,
  leadId,
  products,
  reloadShots,
  onUploaded,
  activeDay: _activeDay, // ← rename to avoid unused-var warning
}: {
  open: boolean;
  onClose: () => void;
  leadId: string | null;
  products: Product[];
  reloadShots: (leadId: string) => Promise<void>;
  onUploaded?: (workingDay: string) => void;
  activeDay?: string;
}) {
  const [productId, setProductId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);

  const resetState = () => {
    setProductId("");
    setFile(null);
    setShots([]);
    setUploading(false);
  };

  const loadShotsLocal = useCallback(async () => {
    if (!leadId) return;
    const r = await fetch(
      `/api/employee/screenshots/search?leadId=${encodeURIComponent(leadId)}`,
      { cache: "no-store", credentials: "same-origin" }
    );
    if (!r.ok) return;
    const json = (await r.json()) as Shot[];
    setShots(json);
  }, [leadId]);

  // initialize when opened
  useEffect(() => {
    if (!open) return;

    // preselect first available product
    if (!productId && products.length > 0) {
      setProductId(products[0]._id);
    }
    if (leadId) {
      loadShotsLocal();
    }
  }, [open, products, productId, loadShotsLocal]);

  const onUpload = async () => {
    if (!leadId) {
      toast.error("No lead selected");
      return;
    }
    if (!productId) {
      toast.error("Please select a product");
      return;
    }
    if (!file) {
      toast.error("Please choose or paste an image");
      return;
    }

    setUploading(true);
    try {
      // 1) Upload to Cloudinary
      const fd = new FormData();
      fd.append("file", file);
      fd.append(
        "upload_preset",
        process.env.NEXT_PUBLIC_CLOUDINARY_PRESET || "leads-screenshots"
      );
      fd.append("folder", "lead-screenshots");

      const cloudRes = await fetch(
        `https://api.cloudinary.com/v1_1/${
          process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD || "dub59giiq"
        }/image/upload`,
        { method: "POST", body: fd }
      );
      const cloud = await cloudRes.json();
      if (!cloudRes.ok || !cloud?.secure_url) {
        throw new Error(cloud?.error?.message || "Image upload failed");
      }

      // 2) Persist screenshot (send leadId + productId)
      const workingDay = getWorkingDayBD(); // keep a var to reuse
      const payload = { leadId, productId, url: cloud.secure_url, workingDay };

      const save = await fetch(`/api/employee/screenshots/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const resp = await save.json();
      if (!save.ok) throw new Error(resp?.error || "Save failed");

      toast.success("Screenshot uploaded");

      // refresh local gallery for this modal
      await loadShotsLocal();
      await reloadShots(leadId!);

      // ✅ notify parent to refresh SS summary (it can decide whether to refetch)
      if (onUploaded) onUploaded(workingDay);

      // close + reset
      onClose();
      resetState();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (id: string) => {
    const r = await fetch(`/api/employee/screenshots/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id }),
    });
    if (r.ok) {
      setShots((prev) => prev.filter((x) => x._id !== id));
      toast.success("Deleted");
    } else {
      toast.error("Delete failed");
    }
  };

  return (
    <Transition appear show={open} as={"div"}>
      <Dialog
        onClose={() => {
          onClose();
          resetState();
        }}
        className="relative z-50"
      >
        <Transition.Child
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
            >
              <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    Upload Signup Screenshot
                  </Dialog.Title>
                  <button
                    onClick={() => {
                      onClose();
                      resetState();
                    }}
                    className="text-gray-500 hover:text-rose-600 dark:text-gray-400 dark:hover:text-rose-400"
                    aria-label="Close"
                  >
                    <FiX size={20} />
                  </button>
                </div>

                {/* Product select */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Select Product
                  </label>
                  <select
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    className="w-full border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">— Select —</option>
                    {products.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Image input */}
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Upload Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded text-sm file:bg-gray-100 dark:file:bg-neutral-800 file:text-gray-700 dark:file:text-gray-200 file:border-0 file:mr-2 file:px-4 file:py-2 file:rounded"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    You can also paste an image (Ctrl+V)
                  </p>
                  <textarea
                    placeholder="Paste image here…"
                    className="w-full mt-2 h-10 px-3 py-2 border border-dashed border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 rounded text-sm resize-none focus:outline-none"
                    onPaste={(e) => {
                      const items = Array.from(e.clipboardData?.items || []);
                      const imgItem = items.find((it) =>
                        it.type?.includes("image")
                      );
                      if (imgItem) {
                        const f = imgItem.getAsFile();
                        if (f) {
                          setFile(f);
                          toast.success("Image pasted");
                        }
                      }
                    }}
                  />
                </div>

                {file && (
                  <div className="mt-3">
                    <p className="text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Preview
                    </p>
                    <div className="relative border border-gray-200 dark:border-neutral-800 rounded w-full h-40 bg-gray-50 dark:bg-neutral-800 overflow-hidden">
                      <Image
                        src={URL.createObjectURL(file)}
                        alt="preview"
                        fill
                        className="object-contain p-2"
                      />
                    </div>
                  </div>
                )}

                {shots.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                      Uploaded
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {shots.map((s) => (
                        <div
                          key={s._id}
                          className="relative border border-gray-200 dark:border-neutral-800 rounded p-1 shadow-sm"
                        >
                          <Image
                            src={s.url}
                            alt={s.productName || s.product || "shot"}
                            width={180}
                            height={120}
                            className="w-full h-28 object-contain rounded"
                          />
                          <div className="mt-1 text-xs text-center truncate text-gray-700 dark:text-gray-300">
                            {s.productName || s.product}
                          </div>
                          <button
                            onClick={() => onDelete(s._id)}
                            className="absolute top-1 right-1 p-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded-full shadow text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                            title="Delete"
                            aria-label="Delete screenshot"
                          >
                            <FiTrash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-neutral-700 rounded text-sm"
                    onClick={() => {
                      onClose();
                      resetState();
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onUpload}
                    disabled={uploading || !productId || !leadId}
                    className="px-4 py-2 bg-indigo-600 text-white rounded text-sm inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    <FiUploadCloud />
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
