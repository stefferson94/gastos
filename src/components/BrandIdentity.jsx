import arrumadinLogo from "../assets/arrumadin-logo.png";

function capitalizeName(name) {
  return String(name)
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function BrandIdentity({ subtitle = "Organize seu dinheiro", userName = "" }) {
  const displayName = capitalizeName(userName);
  const userInitial = displayName.charAt(0) || "A";

  return (
    <div className="brand">
      <img className="brand-logo" src={arrumadinLogo} alt="arrumadin" />
      {userName ? (
        <div className="brand-user">
          <span className="brand-user-avatar">{userInitial}</span>
          <span>
            <small>Logado como</small>
            <strong>{displayName}</strong>
          </span>
        </div>
      ) : (
        subtitle && <span className="brand-subtitle">{subtitle}</span>
      )}
    </div>
  );
}
