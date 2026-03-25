import { NavLink, Routes, Route, Navigate } from "react-router-dom";
import ConnectPage from "./ConnectPage";
import CodePage from "./CodePage";
import UnlockPage from "./UnlockPage";
import DataSamplesPage from "./DataSamplesPage";

function App() {
  return (
    <div>
      <header>
        <nav className="topmenu">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "menu-btn active" : "menu-btn")}>
            Unlock
          </NavLink>
          <NavLink to="/code" className={({ isActive }) => (isActive ? "menu-btn active" : "menu-btn")}>
            Code
          </NavLink>
          <NavLink to="/connect" className={({ isActive }) => (isActive ? "menu-btn active" : "menu-btn")}>
            Connect
          </NavLink>
          <NavLink to="/data-samples" className={({ isActive }) => (isActive ? "menu-btn active" : "menu-btn")}>
            Data samples
          </NavLink>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<UnlockPage />} />
          <Route path="/code" element={<CodePage />} />
          <Route path="/connect" element={<ConnectPage />} />
          <Route path="/data-samples" element={<DataSamplesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
