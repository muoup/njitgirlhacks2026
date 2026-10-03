import "./index.css";

import { BrowserRouter, Route, Routes } from "react-router";

import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { Landing } from "./pages/Landing";
import { NotBuilt } from "./pages/NotBuilt";
import { Shed } from "./pages/Shed";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<Auth mode="signin" />} />
        <Route path="/signup" element={<Auth mode="signup" />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/shed" element={<Shed />} />
        <Route path="*" element={<NotBuilt />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
