import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { AuthContext, type AuthContextValue } from "@/hooks/useAuth";

function renderWithAuth(value: AuthContextValue) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

describe("<LoginPage />", () => {
  it("renderiza el formulario", () => {
    renderWithAuth({
      user: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });
    expect(screen.getByRole("heading", { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
  });

  it("muestra error si login falla", async () => {
    const failingLogin = vi.fn().mockRejectedValue(new Error("bad creds"));
    renderWithAuth({
      user: null,
      loading: false,
      login: failingLogin,
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    await userEvent.type(screen.getByLabelText(/email/i), "a@b.com");
    await userEvent.type(screen.getByLabelText(/contraseña/i), "password12");
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/credenciales/i);
    expect(failingLogin).toHaveBeenCalledWith("a@b.com", "password12");
  });
});
