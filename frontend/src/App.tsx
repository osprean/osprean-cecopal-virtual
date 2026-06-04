import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { LoginPage } from "@/pages/LoginPage";
import { MePage } from "@/pages/MePage";
import { ItemsPage } from "@/pages/ItemsPage";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav
        style={{
          padding: 12,
          borderBottom: "1px solid #eee",
          fontFamily: "system-ui",
          display: "flex",
          gap: 12,
        }}
      >
        <Link to="/">Inicio</Link>
        <Link to="/items">Items</Link>
        <Link to="/me">Perfil</Link>
      </nav>
      {children}
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Shell>
                  <Navigate to="/items" replace />
                </Shell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/items"
            element={
              <ProtectedRoute>
                <Shell>
                  <ItemsPage />
                </Shell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/me"
            element={
              <ProtectedRoute>
                <Shell>
                  <MePage />
                </Shell>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
