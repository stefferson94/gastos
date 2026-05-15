import { BrandIdentity } from "./BrandIdentity.jsx";

export function WelcomeScreen({ onStart }) {
  return (
    <main className="auth-screen welcome-screen">
      <section className="welcome-panel" aria-label="Boas-vindas">
        <BrandIdentity subtitle="" />

        <div className="welcome-grid">
          <div className="welcome-copy">
            <h1>Controle seus gastos com clareza desde o primeiro lancamento.</h1>
            <p>
              Organize contas, acompanhe meses, veja seu saldo e prepare seus dados para uma experiencia financeira mais inteligente.
            </p>
            <button className="primary-button welcome-action" type="button" onClick={onStart}>
              Comecar agora
            </button>
          </div>

          <div className="phone-preview" aria-hidden="true">
            <div className="phone-frame">
              <div className="phone-speaker" />
              <div className="phone-screen">
                <div className="preview-card preview-balance">
                  <span>Saldo previsto</span>
                  <strong>R$ 2.840,00</strong>
                  <small>+12% melhor que o mes anterior</small>
                </div>
                <div className="preview-row">
                  <div>
                    <span>Gastos</span>
                    <strong>R$ 860</strong>
                  </div>
                  <div>
                    <span>Contas</span>
                    <strong>6</strong>
                  </div>
                </div>
                <div className="preview-bars">
                  <span style={{ height: "46%" }} />
                  <span style={{ height: "64%" }} />
                  <span style={{ height: "38%" }} />
                  <span style={{ height: "78%" }} />
                  <span style={{ height: "54%" }} />
                </div>
                <div className="preview-footer">
                  <span>Alimentacao</span>
                  <strong>32%</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export function LoginScreen({ mode, draft, error, onChange, onModeChange, onSubmit, onBack, onQuickAccess }) {
  const isSignup = mode === "signup";

  return (
    <main className="auth-screen login-screen">
      <section className="login-panel" aria-label="Login local">
        <BrandIdentity subtitle="" />

        <div className="login-copy">
          <h1>{isSignup ? "Crie seu acesso financeiro." : "Entre no seu espaco financeiro."}</h1>
          <p>Este acesso ainda e local neste navegador. A estrutura ja esta preparada para conectar ao banco de dados depois.</p>
        </div>

        <div className="auth-mode-tabs" aria-label="Modo de acesso">
          <button className={!isSignup ? "active" : ""} type="button" onClick={() => onModeChange("signin")}>
            Entrar
          </button>
          <button className={isSignup ? "active" : ""} type="button" onClick={() => onModeChange("signup")}>
            Criar conta
          </button>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          {isSignup && (
            <label>
              Nome
              <input
                autoFocus
                value={draft.name}
                onChange={(event) => onChange("name", event.target.value)}
                placeholder="Seu nome"
              />
            </label>
          )}
          <label>
            E-mail
            <input
              autoFocus={!isSignup}
              inputMode="email"
              value={draft.email}
              onChange={(event) => onChange("email", event.target.value)}
              placeholder="voce@email.com"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={draft.password}
              onChange={(event) => onChange("password", event.target.value)}
              placeholder="Senha local"
            />
          </label>
          {isSignup && (
            <label>
              Confirmar senha
              <input
                type="password"
                value={draft.confirmPassword}
                onChange={(event) => onChange("confirmPassword", event.target.value)}
                placeholder="Repita a senha"
              />
            </label>
          )}

          <label className="remember-access">
            <input
              type="checkbox"
              checked={draft.remember}
              onChange={(event) => onChange("remember", event.target.checked)}
            />
            Manter conectado neste navegador
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="login-actions">
            <button className="primary-button" type="submit">{isSignup ? "Criar conta" : "Entrar"}</button>
            <button className="ghost-button" type="button" onClick={onBack}>Voltar</button>
          </div>
        </form>

        {onQuickAccess && (
          <div className="quick-access-section">
            <button className="quick-access-button" type="button" onClick={onQuickAccess}>
              <span className="quick-access-icon" aria-hidden="true">⚡</span>
              Acesso rápido (demo)
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
