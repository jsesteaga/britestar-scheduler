import { Route, Routes } from "react-router-dom";
import { LoginPage } from "./components/LoginPage";
import { SchedulePage } from "./components/SchedulePage";
import { SetPasswordPage } from "./components/SetPasswordPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/schedule" element={<SchedulePage />} />
    </Routes>
  );
}

export default App;
