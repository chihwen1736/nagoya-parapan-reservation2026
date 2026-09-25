import React from "react";
import { NavLink } from "react-router-dom";
import { useData } from "@/context/DataContext";

const NAV_ITEMS = [
  { to: "/new", label: "新增預約" },
  { to: "/overview", label: "每日預約總覽" },
  { to: "/export", label: "Excel 匯出" },
  { to: "/backup", label: "資料備份" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { saveError } = useData();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <h1 className="text-lg font-bold leading-tight">2026名古屋亞帕運中繼站簡易預約系統</h1>
          <p className="text-xs text-brand-50 mt-0.5">
            本系統資料儲存於目前瀏覽器（localStorage），不會上傳到任何伺服器；請每日匯出 Excel，並定期使用「資料備份」下載備份檔。
          </p>
        </div>
      </header>
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-2 flex gap-4 text-sm flex-wrap items-center">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-1 py-0.5 ${isActive ? "text-brand-700 font-semibold border-b-2 border-brand-600" : "text-gray-500 hover:text-brand-600"}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {saveError && <span className="ml-auto text-xs text-red-600">{saveError}</span>}
        </div>
      </nav>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
      <footer className="text-center text-xs text-gray-400 py-4">
        本工具為純前端靜態網站，資料僅保存於您目前使用的瀏覽器，換一台電腦或清除瀏覽器資料就會遺失，請養成常常備份的習慣。
      </footer>
    </div>
  );
}
