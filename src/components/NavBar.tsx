import { NavLink } from "react-router-dom";

export default function NavBar() {
  return (
    <header>
      <nav className="topmenu">
        <div style={{ fontSize: "1.3rem", fontWeight: "bold", marginRight: "auto", color: "white"}}>
          DanceCode
        </div>
        <NavLink
          to="/unlock"
          className={({ isActive }) => (isActive ? "menu-btn active" : "menu-btn")}
        >
          Unlock
        </NavLink>
        <NavLink
          to="/coding"
          className={({ isActive }) => (isActive ? "menu-btn active" : "menu-btn")}
        >
          Code
        </NavLink>
        <NavLink
          to="/data-samples"
          className={({ isActive }) => (isActive ? "menu-btn active" : "menu-btn")}
        >
          Data samples
        </NavLink>
      </nav>
    </header>
  );
}
