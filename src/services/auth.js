const legacyUserKey = "balanco-financeiro:usuario-local";
const usersKey = "balanco-financeiro:usuarios";
const sessionKey = "balanco-financeiro:sessao";

function readJson(storage, key, fallback = null) {
  try {
    return JSON.parse(storage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
}

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

function hashLocalPassword(password) {
  const input = String(password);
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `local-${(hash >>> 0).toString(16)}`;
}

function getDefaultLocalUser() {
  return {
    id: "user-demo-admin",
    name: "admin",
    email: "admin@admin.com",
    passwordHash: hashLocalPassword("admin"),
    createdAt: new Date().toISOString()
  };
}

function ensureDefaultLocalUser() {
  const users = readJson(localStorage, usersKey, []);
  const defaultUser = getDefaultLocalUser();

  if (users.some((user) => user.email === defaultUser.email)) {
    return users;
  }

  const nextUsers = [...users, defaultUser];
  saveUsers(nextUsers);
  return nextUsers;
}


function getUsers() {
  return ensureDefaultLocalUser();
}

function saveUsers(users) {
  writeJson(localStorage, usersKey, users);
}

function createSession(user, remember) {
  const session = {
    userId: user.id,
    name: user.name,
    email: user.email,
    createdAt: new Date().toISOString()
  };

  sessionStorage.removeItem(sessionKey);
  localStorage.removeItem(sessionKey);
  writeJson(remember ? localStorage : sessionStorage, sessionKey, session);

  return session;
}

function toSessionUser(session) {
  if (!session?.email) return null;

  return {
    id: session.userId,
    name: session.name,
    email: session.email
  };
}

export function getCurrentSession() {
  const activeSession = readJson(sessionStorage, sessionKey) ?? readJson(localStorage, sessionKey);
  const sessionUser = toSessionUser(activeSession);
  if (sessionUser) return sessionUser;

  const legacyUser = readJson(localStorage, legacyUserKey);
  if (!legacyUser?.email) return null;

  const migratedUser = {
    id: `legacy-${Date.now()}`,
    name: legacyUser.name ?? "Usuario",
    email: normalizeEmail(legacyUser.email),
    passwordHash: "",
    createdAt: legacyUser.createdAt ?? new Date().toISOString()
  };

  const existingUsers = getUsers();
  const users = existingUsers.some((user) => user.email === migratedUser.email)
    ? existingUsers
    : [...existingUsers, migratedUser];

  saveUsers(users);
  localStorage.removeItem(legacyUserKey);

  return toSessionUser(createSession(migratedUser, true));
}

export function createLocalAccount({ name, email, password, confirmPassword, remember }) {
  const cleanName = String(name).trim();
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = String(password).trim();
  const cleanConfirmPassword = String(confirmPassword).trim();

  if (!cleanName || !cleanEmail || !cleanPassword || !cleanConfirmPassword) {
    return { ok: false, message: "Preencha todos os campos para criar sua conta." };
  }

  if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    return { ok: false, message: "Informe um e-mail valido." };
  }

  if (cleanPassword.length < 6) {
    return { ok: false, message: "Use uma senha com pelo menos 6 caracteres." };
  }

  if (cleanPassword !== cleanConfirmPassword) {
    return { ok: false, message: "As senhas nao conferem." };
  }

  const users = getUsers();
  if (users.some((user) => user.email === cleanEmail)) {
    return { ok: false, message: "Ja existe uma conta local com esse e-mail." };
  }

  const user = {
    id: `user-${Date.now()}`,
    name: cleanName,
    email: cleanEmail,
    passwordHash: hashLocalPassword(cleanPassword),
    createdAt: new Date().toISOString()
  };

  saveUsers([...users, user]);

  return {
    ok: true,
    user: toSessionUser(createSession(user, remember))
  };
}

export function loginLocalAccount({ email, password, remember }) {
  const cleanEmail = normalizeEmail(email);
  const cleanPassword = String(password).trim();

  if (!cleanEmail || !cleanPassword) {
    return { ok: false, message: "Informe e-mail e senha para entrar." };
  }

  const user = getUsers().find((item) => item.email === cleanEmail);
  if (!user) {
    return { ok: false, message: "Nao encontramos uma conta local com esse e-mail." };
  }

  if (!user.passwordHash) {
    return { ok: false, message: "Essa conta local antiga nao tem senha cadastrada. Crie uma nova conta para usar o novo login." };
  }

  if (user.passwordHash !== hashLocalPassword(cleanPassword)) {
    return { ok: false, message: "Senha incorreta." };
  }

  return {
    ok: true,
    user: toSessionUser(createSession(user, remember))
  };
}

export function logoutLocalAccount() {
  localStorage.removeItem(sessionKey);
  sessionStorage.removeItem(sessionKey);
}
