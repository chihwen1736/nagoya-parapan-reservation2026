import React from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { DataProvider, useData } from "@/context/DataContext";
import { Layout } from "@/components/Layout";
import ReservationFormPage from "@/pages/ReservationFormPage";
import OverviewPage from "@/pages/OverviewPage";
import ExportPage from "@/pages/ExportPage";
import BackupPage from "@/pages/BackupPage";

function Gate({ children }: { children: React.ReactNode }) {
  const { ready } = useData();
  if (!ready) {
    return <div className="p-8 text-center text-gray-400">載入中…</div>;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <DataProvider>
      <HashRouter>
        <Gate>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/new" replace />} />
              <Route path="/new" element={<ReservationFormPage />} />
              <Route path="/edit/:id" element={<ReservationFormPage />} />
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="/backup" element={<BackupPage />} />
              <Route path="*" element={<Navigate to="/new" replace />} />
            </Routes>
          </Layout>
        </Gate>
      </HashRouter>
    </DataProvider>
  );
}
