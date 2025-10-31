// src/app/secure-login/page.tsx
import { Suspense } from "react";
import SecureLoginPage from "./SecureLoginPage";

export default function SecureLoginWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
          Verifying secure login link...
        </div>
      }
    >
      <SecureLoginPage />
    </Suspense>
  );
}
