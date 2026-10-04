import "./index.css";

import { BrowserRouter, Route, Routes } from "react-router";

import { MentorProvider } from "./components/mentor/conversation";
import { MentorDock } from "./components/mentor/Dock";
import { About } from "./pages/About";
import { Auth } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { Landing } from "./pages/Landing";
import { Mentor } from "./pages/Mentor";
import { NotBuilt } from "./pages/NotBuilt";
import { Shed } from "./pages/Shed";

export function App() {
  return (
    <BrowserRouter>
      <MentorProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<About />} />
          <Route path="/signin" element={<Auth mode="signin" />} />
          <Route path="/signup" element={<Auth mode="signup" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/shed" element={<Shed />} />
          <Route path="/mentor" element={<Mentor />} />
          <Route path="*" element={<NotBuilt />} />
        </Routes>
        <MentorDock />
      </MentorProvider>
    </BrowserRouter>
  );
}

export default App;
