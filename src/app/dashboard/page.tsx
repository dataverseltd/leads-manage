"use client";

import React from "react";
import { Compass } from "lucide-react";

const Page = () => {
  return (
    <main className="flex flex-col items-center justify-center h-[75vh] text-center px-4">
      <div className="animate-float">
        <Compass className="w-16 h-16 text-[var(--brand-500)] dark:text-[var(--brand-400)] mb-6" />
      </div>

      <h1 className="text-2xl font-semibold text-gray-800 dark:text-zinc-100 mb-2">
        Find Your Page
      </h1>

      <p className="text-gray-600 dark:text-zinc-400 max-w-md">
        Please use the sidebar menu to navigate to the page or feature you’re looking for.
      </p>
    </main>
  );
};

export default Page;
