export default function AuthLayout({ children }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      background: "linear-gradient(135deg,#f5f8ff,#e8f0ff)"
    }}>
      {children}
    </div>
  );
}
