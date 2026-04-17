import { Outlet, useLocation } from "react-router-dom";

/**
 * Renders <Outlet /> inside a div whose `key` changes on every route change.
 * This forces a remount, which re-triggers the CSS [data-app-main] > * pageEnter
 * animation defined in index.css. Works for every page across the app without
 * needing per-page edits.
 */
const AnimatedOutlet = () => {
  const location = useLocation();
  return (
    <div key={location.pathname} className="contents">
      <Outlet />
    </div>
  );
};

export default AnimatedOutlet;
