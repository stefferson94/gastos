export const spreadsheetColumns = [
  "Mercado Pago",
  "Smiles Infinite",
  "Nubank",
  "Banco do Brasil",
  "Outros",
  "Contas de Casa"
];

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

export function createMonthId(year, monthNumber) {
  return `${year}-${String(monthNumber).padStart(2, "0")}`;
}

export function getCurrentMonthId() {
  const now = new Date();
  return createMonthId(now.getFullYear(), now.getMonth() + 1);
}

export function getMonthYear(monthId) {
  return Number.parseInt(String(monthId).slice(0, 4), 10);
}

export function getMonthNumber(monthId) {
  return Number.parseInt(String(monthId).slice(5, 7), 10);
}

export function createMonth(monthId) {
  const year = getMonthYear(monthId);
  const monthNumber = getMonthNumber(monthId);
  const label = `${monthNames[monthNumber - 1] ?? "Mes"} ${year}`;

  return {
    id: monthId,
    label,
    income: 0,
    debt: 0,
    balance: 0,
    accounts: [],
    transactions: []
  };
}

export function createYearMonths(year) {
  return Array.from({ length: 12 }, (_, index) => createMonth(createMonthId(year, index + 1)));
}

export function createSequentialMonths(startMonthId, count) {
  const startYear = getMonthYear(startMonthId);
  const startMonth = getMonthNumber(startMonthId);

  return Array.from({ length: count }, (_, index) => {
    const zeroBasedMonth = startMonth - 1 + index;
    const year = startYear + Math.floor(zeroBasedMonth / 12);
    const monthNumber = (zeroBasedMonth % 12) + 1;
    return createMonth(createMonthId(year, monthNumber));
  });
}

export function nextMonthId(monthId) {
  return createSequentialMonths(monthId, 2)[1]?.id ?? null;
}

export const months = createYearMonths(getMonthYear(getCurrentMonthId()));
