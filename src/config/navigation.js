export const navigationItems = [
  { id: "dashboard", label: "Dashboard", icon: "◼" },
  { id: "lancamentos", label: "Lancamentos", icon: "＋" },
  { id: "cartoes", label: "Contas", icon: "▤" },
  { id: "relatorios", label: "Relatorios", icon: "◒" }
];

export const defaultActiveView = "lancamentos";

export const navigationItemIds = navigationItems.map((item) => item.id);
