import { useAuth } from "@/hooks/useAuth";

export function MePage() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div style={{ maxWidth: 480, margin: "64px auto", fontFamily: "system-ui" }}>
      <h1>Hola, {user.full_name ?? user.email}</h1>
      <ul>
        <li>
          <strong>Email:</strong> {user.email}
        </li>
        <li>
          <strong>ID:</strong> {user.id}
        </li>
        <li>
          <strong>Alta:</strong> {new Date(user.created_at).toLocaleString()}
        </li>
      </ul>
      <button onClick={logout}>Salir</button>
    </div>
  );
}
