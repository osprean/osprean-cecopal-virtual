import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedApp } from "./auth/ProtectedApp";
import { LandingView } from "./pages/cecovi/LandingView";

// Enrutado por path = identificador de emergencia. La app operativa vive bajo
// /{idEmergencia}; el acceso (login por credencial → /me → selección de roles)
// lo gestiona ProtectedApp.
const App = () => {
  return (
    <Routes>
      <Route path="/:idEmergencia/*" element={<ProtectedApp />} />
      <Route path="/" element={<LandingView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
