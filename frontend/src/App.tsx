import "./index.css";

import { Landing } from "./pages/Landing";
import { NotBuilt } from "./pages/NotBuilt";

export function App() {
  // No router yet: the landing page is the only real route.
  return window.location.pathname === "/" ? <Landing /> : <NotBuilt />;
}

export default App;
