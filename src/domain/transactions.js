import { createMonth, createSequentialMonths, nextMonthId } from "../data/financeData.js";
import { clampInteger, formatMoney } from "./money.js";

export function creationMessage(type, count) {
  if (count <= 1) {
    return type === "adjustment" ? "Estorno criado." : "Lancamento criado.";
  }

  if (type === "installment") {
    return `${count} parcelas criadas. Use o seletor de mes acima para acompanhar as proximas parcelas.`;
  }

  if (type === "fixed") {
    return `${count} lancamentos fixos criados. Eles foram repetidos nos meses configurados.`;
  }

  return `${count} lancamentos criados.`;
}

export function buildExpensesFromForm({ form, activeMonth, amount }) {
  const base = {
    amount,
    group: form.card,
    card: form.card,
    createdAt: new Date().toISOString()
  };

  if (form.type === "installment") {
    const installments = clampInteger(form.installments, 2, 48);
    const startInstallment = clampInteger(form.startInstallment, 1, installments);
    const monthsToCreate = installments - startInstallment + 1;
    const seriesId = createId();

    return createSequentialMonths(activeMonth.id, monthsToCreate)
      .map((month, index) => ({
        ...base,
        id: createId(),
        monthId: month.id,
        type: "installment",
        seriesId,
        installmentNumber: startInstallment + index,
        installments,
        description: `${form.description.trim()} ${startInstallment + index}/${installments}`
      }));
  }

  if (form.type === "fixed") {
    const repeatMonths = String(form.repeatMonths).trim()
      ? clampInteger(form.repeatMonths, 1, 60)
      : 12;
    const seriesId = createId();

    return createSequentialMonths(activeMonth.id, repeatMonths)
      .map((month) => ({
        ...base,
        id: createId(),
        monthId: month.id,
        type: "fixed",
        seriesId,
        description: form.description.trim()
      }));
  }

  return [{
    ...base,
    id: createId(),
    monthId: activeMonth.id,
    type: form.type,
    description: form.description.trim()
  }];
}

export function normalizeAmountForType(type, amount) {
  if (type === "adjustment") {
    return -Math.abs(amount);
  }

  return amount;
}

export function completeMissingInstallments(expenses) {
  const completed = [...expenses];

  expenses.forEach((expense) => {
    if (expense.type !== "installment") return;

    const info = parseInstallmentDescription(expense.description);
    if (!info || info.current >= info.total) return;

    const seriesId = expense.seriesId ?? createId();

    for (let nextNumber = info.current + 1; nextNumber <= info.total; nextNumber += 1) {
      const targetMonth = createSequentialMonths(expense.monthId, nextNumber - info.current + 1).at(-1);
      if (!targetMonth) break;

      const nextDescription = `${info.base} ${nextNumber}/${info.total}`;
      const alreadyExists = completed.some((item) =>
        item.monthId === targetMonth.id &&
        item.type === "installment" &&
        item.card === expense.card &&
        item.amount === expense.amount &&
        item.description === nextDescription
      );

      if (!alreadyExists) {
        completed.push({
          ...expense,
          id: createId(),
          monthId: targetMonth.id,
          description: nextDescription,
          installmentNumber: nextNumber,
          installments: info.total,
          seriesId,
          createdAt: new Date().toISOString()
        });
      }
    }
  });

  return completed;
}

export function parseInstallmentDescription(description) {
  const match = description.match(/^(.*?)\s+(\d+)\s*\/\s*(\d+)$/);
  if (!match) return null;

  return {
    base: match[1].trim(),
    current: Number.parseInt(match[2], 10),
    total: Number.parseInt(match[3], 10)
  };
}

export function groupTransactionsByType(transactions) {
  const groups = transactions.reduce(
    (groups, transaction) => {
      if (transaction.ledgerType === "fixed") {
        groups.fixed.push(transaction);
      } else if (transaction.ledgerType === "installment") {
        groups.installment.push(transaction);
      } else {
        groups.single.push(transaction);
      }

      return groups;
    },
    { fixed: [], installment: [], single: [] }
  );

  Object.values(groups).forEach((group) => {
    group.sort((a, b) => a.ledgerOrder - b.ledgerOrder);
  });

  return groups;
}

export function normalizeLedgerType(type) {
  if (type === "adjustment") return "adjustment";
  if (type === "fixed" || type === "installment") return type;
  return "single";
}

export function formatLedgerItemAmount(transaction) {
  const amount = Math.abs(transaction.amount);
  const signal = transaction.ledgerType === "adjustment" ? "+" : "-";

  return `${signal} ${formatMoney(amount)}`;
}

export function installmentHint(transaction) {
  const installmentInfo = getInstallmentInfo(transaction);

  if (!installmentInfo) return "Compra parcelada";

  const nextMonth = installmentInfo.nextMonthId ? createMonth(installmentInfo.nextMonthId) : null;
  const nextText = nextMonth ? ` • Proxima: ${nextMonth.label}` : " • Ultima parcela";

  return `Parcela ${installmentInfo.current}/${installmentInfo.total}${nextText}`;
}

export function getInstallmentInfo(transaction) {
  if (transaction.installmentNumber && transaction.installments) {
    return {
      current: transaction.installmentNumber,
      total: transaction.installments,
      nextMonthId: nextMonthId(transaction.monthId)
    };
  }

  const match = transaction.description.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;

  const current = Number.parseInt(match[1], 10);
  const total = Number.parseInt(match[2], 10);

  return {
    current,
    total,
    nextMonthId: current < total ? nextMonthId(transaction.monthId) : null
  };
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${randomPart}`;
}
