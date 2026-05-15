import { useEffect, useMemo, useRef, useState } from "react";
import { LoginScreen, WelcomeScreen } from "./components/AuthScreens.jsx";
import { BrandIdentity } from "./components/BrandIdentity.jsx";
import { EditableMetricCard, MetricCard } from "./components/MetricCards.jsx";
import { YearPicker } from "./components/YearPicker.jsx";
import { defaultActiveView, navigationItemIds, navigationItems } from "./config/navigation.js";
import { transactionTypeOptions } from "./config/transactions.js";
import {
  createMonthId,
  createYearMonths,
  getCurrentMonthId,
  getMonthNumber,
  getMonthYear,
  spreadsheetColumns
} from "./data/financeData.js";
import {
  accountTypeLabel,
  accountTypeOptions,
  columnClass,
  columnHeaderStyle,
  defaultAccountType,
  defaultColumnColor,
  normalizeAccountType,
  normalizeColumn,
  renameMapValues
} from "./domain/accounts.js";
import { categoryTone, normalizeCategory } from "./domain/categories.js";
import { formatMoney, parseCurrencyInput } from "./domain/money.js";
import {
  buildExpensesFromForm,
  completeMissingInstallments,
  creationMessage,
  formatLedgerItemAmount,
  getInstallmentInfo,
  groupTransactionsByType,
  installmentHint,
  normalizeAmountForType,
  normalizeLedgerType,
  parseInstallmentDescription
} from "./domain/transactions.js";
import {
  createLocalAccount,
  getCurrentSession,
  loginLocalAccount,
  logoutLocalAccount
} from "./services/auth.js";
import {
  canUseExpenseStorage,
  DATA_RESET_VERSION,
  ensureDataReset,
  persistExpenses
} from "./services/storage.js";

function getDefaultActiveMonthId() {
  const currentMonthId = getCurrentMonthId();

  try {
    const savedMonthId = localStorage.getItem("balanco-financeiro:mes-ativo");
    return isValidMonthId(savedMonthId) ? savedMonthId : currentMonthId;
  } catch {
    return currentMonthId;
  }
}

function getDefaultActiveView() {
  try {
    const savedView = localStorage.getItem("balanco-financeiro:menu-ativo");
    return navigationItemIds.includes(savedView) ? savedView : defaultActiveView;
  } catch {
    return defaultActiveView;
  }
}

function isValidMonthId(monthId) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(monthId));
}

function getRelativeMonthId(monthId, offset) {
  const currentYear = getMonthYear(monthId);
  const currentMonthNumber = getMonthNumber(monthId);
  const zeroBasedMonth = currentMonthNumber - 1 + offset;
  const nextYear = currentYear + Math.floor(zeroBasedMonth / 12);
  const nextMonthNumber = ((zeroBasedMonth % 12) + 12) % 12 + 1;

  return createMonthId(nextYear, nextMonthNumber);
}

function Icon({ children }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}

function App() {
  const [localUser, setLocalUser] = useState(getCurrentSession);
  const [authStep, setAuthStep] = useState(() => (getCurrentSession() ? "app" : "welcome"));
  const [authMode, setAuthMode] = useState("signin");
  const [loginDraft, setLoginDraft] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    remember: true
  });
  const [loginError, setLoginError] = useState("");
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [yearPickerDraft, setYearPickerDraft] = useState(String(getMonthYear(getDefaultActiveMonthId())));
  const [yearPickerError, setYearPickerError] = useState("");
  const [activeView, setActiveView] = useState(getDefaultActiveView);
  const [activeMonthId, setActiveMonthId] = useState(getDefaultActiveMonthId);
  const [lastCreatedCount, setLastCreatedCount] = useState(0);
  const [lastCreatedType, setLastCreatedType] = useState("");
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [editingColumnName, setEditingColumnName] = useState(null);
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnDraft, setNewColumnDraft] = useState("");
  const [newAccountType, setNewAccountType] = useState("credit_card");
  const [newColumnError, setNewColumnError] = useState("");
  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeDraft, setIncomeDraft] = useState("");
  const quickEntryRef = useRef(null);
  const newColumnInputRef = useRef(null);
  const [formError, setFormError] = useState("");
  const [collapsedColumns, setCollapsedColumns] = useState({});
  const [isMobileLedger, setIsMobileLedger] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(max-width: 1024px)").matches
  );
  const [savedExpenses, setSavedExpenses] = useState(() => {
    try {
      ensureDataReset();
      return JSON.parse(localStorage.getItem("balanco-financeiro:gastos")) ?? [];
    } catch {
      return [];
    }
  });
  const [movedColumns, setMovedColumns] = useState(() => {
    try {
      ensureDataReset();
      return JSON.parse(localStorage.getItem("balanco-financeiro:colunas-movidas")) ?? {};
    } catch {
      return {};
    }
  });
  const [ledgerOverrides, setLedgerOverrides] = useState(() => {
    try {
      ensureDataReset();
      return JSON.parse(localStorage.getItem("balanco-financeiro:ajustes-lancamentos")) ?? {};
    } catch {
      return {};
    }
  });
  const [accountColumns, setAccountColumns] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("balanco-financeiro:colunas-contas")) ?? spreadsheetColumns;
    } catch {
      return spreadsheetColumns;
    }
  });
  const [accountColors, setAccountColors] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("balanco-financeiro:cores-contas")) ?? {};
    } catch {
      return {};
    }
  });
  const [accountTypes, setAccountTypes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("balanco-financeiro:tipos-contas")) ?? {};
    } catch {
      return {};
    }
  });
  const [monthlyIncome, setMonthlyIncome] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("balanco-financeiro:rendimentos")) ?? {};
    } catch {
      return {};
    }
  });
  const [form, setForm] = useState({
    type: "single",
    description: "",
    amount: "",
    card: "Nubank",
    installments: "2",
    startInstallment: "1",
    repeatMonths: ""
  });

  const activeYear = getMonthYear(activeMonthId);
  const yearMonths = useMemo(() => createYearMonths(activeYear), [activeYear]);
  const activeMonth = yearMonths.find((month) => month.id === activeMonthId) ?? yearMonths[0];
  const activeMonthNumber = getMonthNumber(activeMonth.id);
  const activeMonthName = activeMonth.label.split(" ")[0];
  const annualProgress = (activeMonthNumber / 12) * 100;
  const isCurrentMonth = activeMonth.id === getCurrentMonthId();
  const activeIncome = monthlyIncome[activeMonth.id] ?? activeMonth.income;
  const monthExpenses = savedExpenses.filter((expense) => expense.monthId === activeMonth.id);
  const allTransactions = [
    ...monthExpenses.map((expense, index) => {
      const dragId = `saved:${expense.id}`;
      const override = ledgerOverrides[dragId] ?? {};
      const movedColumn = override.column ?? movedColumns[dragId];

      if (override.deleted) return null;

      return {
        ...expense,
        dragId,
        description: override.description ?? expense.description,
        amount: override.amount ?? expense.amount,
        ledgerType: override.type ?? normalizeLedgerType(expense.type),
        ledgerOrder: override.order ?? index,
        card: movedColumn ?? expense.card,
        group: movedColumn ?? expense.group
      };
    }),
    ...activeMonth.transactions.map((transaction, index) => {
      const dragId = `imported:${activeMonth.id}:${index}`;
      const override = ledgerOverrides[dragId] ?? {};
      const movedColumn = override.column ?? movedColumns[dragId];

      if (override.deleted) return null;

      return {
        ...transaction,
        dragId,
        description: override.description ?? transaction.description,
        amount: override.amount ?? transaction.amount,
        ledgerType: override.type ?? normalizeLedgerType(transaction.type),
        ledgerOrder: override.order ?? index + 1000,
        card: movedColumn ?? transaction.card,
        group: movedColumn ?? transaction.group
      };
    })
  ].filter(Boolean);
  const newExpensesTotal = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const adjustedDebt = activeMonth.debt + newExpensesTotal;
  const adjustedBalance = activeIncome - adjustedDebt;
  const isOverBudget = adjustedBalance < 0;
  const spendingRatio = activeIncome ? Math.min(Math.max(adjustedDebt / activeIncome, 0), 1) : 0;
  const spendingStatus = isOverBudget ? "Pare de gastar" : spendingRatio < 0.65 ? "Sob controle" : "Atenção";
  const spendingStatusClass = isOverBudget ? "risk" : "normal";
  const timelineWidth = isOverBudget ? 100 : spendingRatio * 100;

  const categoryTotals = useMemo(() => {
    const totals = allTransactions.reduce((map, transaction) => {
      const name = normalizeCategory(transaction.group);
      map.set(name, (map.get(name) ?? 0) + Math.max(transaction.amount, 0));
      return map;
    }, new Map());

    return Array.from(totals, ([name, value]) => ({
      name,
      value,
      tone: categoryTone(name)
    })).sort((a, b) => b.value - a.value);
  }, [allTransactions]);

  const transactionsByColumn = useMemo(() => {
    const grouped = Object.fromEntries(accountColumns.map((column) => [column, []]));

    allTransactions.forEach((transaction) => {
      const column = accountColumns.includes(transaction.card)
        ? transaction.card
        : accountColumns.includes(transaction.group)
          ? transaction.group
          : normalizeColumn(transaction.group, accountColumns);

      if (grouped[column]) {
        grouped[column].push(transaction);
      }
    });

    return grouped;
  }, [accountColumns, allTransactions]);

  const accountSummaries = useMemo(() => {
    return accountColumns.map((column) => {
      const transactions = transactionsByColumn[column] ?? [];
      const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
      const fixedTotal = transactions
        .filter((transaction) => transaction.ledgerType === "fixed")
        .reduce((sum, transaction) => sum + transaction.amount, 0);
      const installmentTotal = transactions
        .filter((transaction) => transaction.ledgerType === "installment")
        .reduce((sum, transaction) => sum + transaction.amount, 0);

      return {
        name: column,
        type: normalizeAccountType(accountTypes[column] ?? defaultAccountType(column)),
        amount: total,
        fixedTotal,
        installmentTotal,
        count: transactions.length
      };
    });
  }, [accountColumns, accountTypes, transactionsByColumn]);

  const accountSummariesByType = useMemo(() => {
    return accountTypeOptions
      .map((type) => ({
        ...type,
        accounts: accountSummaries.filter((account) => account.type === type.value)
      }))
      .filter((group) => group.accounts.length > 0);
  }, [accountSummaries]);

  const dashboardMonthlyData = useMemo(() => {
    return yearMonths.map((month) => {
      const savedMonthExpenses = savedExpenses
        .filter((expense) => expense.monthId === month.id)
        .map((expense, index) => {
          const dragId = `saved:${expense.id}`;
          const override = ledgerOverrides[dragId] ?? {};
          const movedColumn = override.column ?? movedColumns[dragId];

          if (override.deleted) return null;

          return {
            ...expense,
            dragId,
            description: override.description ?? expense.description,
            amount: override.amount ?? expense.amount,
            ledgerType: override.type ?? normalizeLedgerType(expense.type),
            ledgerOrder: override.order ?? index,
            card: movedColumn ?? expense.card,
            group: movedColumn ?? expense.group
          };
        })
        .filter(Boolean);

      const importedTransactions = month.transactions
        .map((transaction, index) => {
          const dragId = `imported:${month.id}:${index}`;
          const override = ledgerOverrides[dragId] ?? {};
          const movedColumn = override.column ?? movedColumns[dragId];

          if (override.deleted) return null;

          return {
            ...transaction,
            dragId,
            description: override.description ?? transaction.description,
            amount: override.amount ?? transaction.amount,
            ledgerType: override.type ?? normalizeLedgerType(transaction.type),
            ledgerOrder: override.order ?? index + 1000,
            card: movedColumn ?? transaction.card,
            group: movedColumn ?? transaction.group
          };
        })
        .filter(Boolean);

      const transactions = [...savedMonthExpenses, ...importedTransactions];
      const income = monthlyIncome[month.id] ?? month.income;
      const debt = month.debt + transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
      const balance = income - debt;
      const usage = income ? Math.min(Math.max(debt / income, 0), 1) : 0;

      return {
        ...month,
        shortLabel: month.label.split(" ")[0].slice(0, 3),
        income,
        debt,
        balance,
        usage,
        count: transactions.length
      };
    });
  }, [ledgerOverrides, monthlyIncome, movedColumns, savedExpenses, yearMonths]);

  const dashboardYear = activeYear;
  const dashboardYearMonths = dashboardMonthlyData;
  const annualIncome = dashboardYearMonths.reduce((sum, month) => sum + month.income, 0);
  const annualSpent = dashboardYearMonths.reduce((sum, month) => sum + month.debt, 0);
  const annualBalance = annualIncome - annualSpent;
  const annualUsage = annualIncome ? Math.min(Math.max(annualSpent / annualIncome, 0), 1) : 0;
  const maxMonthlyDebt = Math.max(...dashboardYearMonths.map((month) => Math.abs(month.debt)), 1);
  const highestSpendingMonth = dashboardYearMonths.reduce(
    (highest, month) => (month.debt > highest.debt ? month : highest),
    dashboardYearMonths[0] ?? { debt: 0, label: "Sem dados" }
  );
  const bestBalanceMonth = dashboardYearMonths.reduce(
    (best, month) => (month.balance > best.balance ? month : best),
    dashboardYearMonths[0] ?? { balance: 0, label: "Sem dados" }
  );

  const totalAccounts = useMemo(
    () => accountSummaries.reduce((sum, account) => sum + Math.max(account.amount, 0), 0),
    [accountSummaries]
  );

  useEffect(() => {
    persistExpenses(savedExpenses);
  }, [savedExpenses]);

  useEffect(() => {
    const completedExpenses = completeMissingInstallments(savedExpenses);
    if (completedExpenses.length !== savedExpenses.length) {
      setSavedExpenses(completedExpenses);
    }
  }, [savedExpenses]);

  useEffect(() => {
    localStorage.setItem("balanco-financeiro:colunas-movidas", JSON.stringify(movedColumns));
  }, [movedColumns]);

  useEffect(() => {
    localStorage.setItem("balanco-financeiro:ajustes-lancamentos", JSON.stringify(ledgerOverrides));
  }, [ledgerOverrides]);

  useEffect(() => {
    localStorage.setItem("balanco-financeiro:colunas-contas", JSON.stringify(accountColumns));
  }, [accountColumns]);

  useEffect(() => {
    localStorage.setItem("balanco-financeiro:cores-contas", JSON.stringify(accountColors));
  }, [accountColors]);

  useEffect(() => {
    localStorage.setItem("balanco-financeiro:tipos-contas", JSON.stringify(accountTypes));
  }, [accountTypes]);

  useEffect(() => {
    localStorage.setItem("balanco-financeiro:rendimentos", JSON.stringify(monthlyIncome));
  }, [monthlyIncome]);

  useEffect(() => {
    localStorage.setItem("balanco-financeiro:mes-ativo", activeMonth.id);
  }, [activeMonth.id]);

  useEffect(() => {
    localStorage.setItem("balanco-financeiro:menu-ativo", activeView);
  }, [activeView]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1024px)");
    const handleChange = (event) => setIsMobileLedger(event.matches);

    setIsMobileLedger(mediaQuery.matches);
    mediaQuery.addEventListener?.("change", handleChange);

    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => {
    if (isAddingColumn) {
      newColumnInputRef.current?.focus();
    }
  }, [isAddingColumn]);

  const maxCategory = Math.max(...categoryTotals.map((category) => category.value), 1);
  const maxAccount = Math.max(...accountSummaries.map((account) => Math.abs(account.amount)), 1);
  const filledAccounts = accountSummaries.filter((account) => account.count > 0).length;

  function clearCreationFeedback() {
    setLastCreatedCount(0);
    setLastCreatedType("");
  }

  function updateForm(field, value) {
    clearCreationFeedback();
    setForm((current) => ({ ...current, [field]: value }));
    if (formError) {
      setFormError("");
    }
  }

  function handleAddExpense(event) {
    event?.preventDefault?.();

    const parsedAmount = parseCurrencyInput(form.amount);
    if (!form.description.trim()) {
      setFormError("Informe a descricao do gasto.");
      return;
    }

    if (Number.isNaN(parsedAmount)) {
      setFormError("Informe um valor valido.");
      return;
    }

    const amount = normalizeAmountForType(form.type, parsedAmount);
    const selectedCard = accountColumns.includes(form.card) ? form.card : accountColumns[0];

    if (!selectedCard) {
      setFormError("Crie uma conta antes de salvar o gasto.");
      return;
    }

    const formToSave = {
      ...form,
      card: selectedCard
    };
    const generatedExpenses = buildExpensesFromForm({ form: formToSave, activeMonth, amount });

    if (!canUseExpenseStorage(setFormError)) {
      return;
    }

    setSavedExpenses((current) => {
      const nextExpenses = [...generatedExpenses, ...current];
      persistExpenses(nextExpenses);
      return nextExpenses;
    });
    setLastCreatedCount(generatedExpenses.length);
    setLastCreatedType(formToSave.type);
    setFormError("");
    setForm((current) => ({
      ...current,
      card: selectedCard,
      description: "",
      amount: ""
    }));
  }

  function handleSaveExpenseTouch(event) {
    event.preventDefault();
    handleAddExpense(event);
  }

  function toggleLedgerColumn(column) {
    clearCreationFeedback();
    setCollapsedColumns((current) => {
      const currentlyCollapsed = current[column] ?? (transactionsByColumn[column] ?? []).length === 0;

      if (!isMobileLedger) {
        return {
          ...current,
          [column]: !currentlyCollapsed
        };
      }

      if (!currentlyCollapsed) {
        return {
          ...current,
          [column]: true
        };
      }

      return Object.fromEntries(accountColumns.map((accountColumn) => [accountColumn, accountColumn !== column]));
    });
  }

  function focusQuickEntry() {
    setActiveView("lancamentos");
    window.setTimeout(() => {
      quickEntryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      quickEntryRef.current?.querySelector("input")?.focus({ preventScroll: true });
    }, 0);
  }

  function removeExpense(expenseId) {
    setSavedExpenses((current) => current.filter((expense) => expense.id !== expenseId));
    setMovedColumns((current) => {
      const next = { ...current };
      delete next[`saved:${expenseId}`];
      return next;
    });
    setLedgerOverrides((current) => {
      const next = { ...current };
      delete next[`saved:${expenseId}`];
      return next;
    });
  }

  function deleteTransaction(transaction) {
    clearCreationFeedback();
    if (transaction.ledgerType === "installment") {
      deleteInstallmentSeries(transaction);
      return;
    }

    if (transaction.ledgerType === "fixed") {
      deleteFixedSeries(transaction);
      return;
    }

    if (transaction.dragId.startsWith("saved:")) {
      removeExpense(transaction.dragId.replace("saved:", ""));
      return;
    }

    setLedgerOverrides((current) => ({
      ...current,
      [transaction.dragId]: {
        ...(current[transaction.dragId] ?? {}),
        deleted: true
      }
    }));
  }

  function deleteInstallmentSeries(transaction) {
    const info = getInstallmentInfo(transaction);
    const base = info?.base;

    setSavedExpenses((current) =>
      current.filter((expense) => {
        if (transaction.seriesId && expense.seriesId === transaction.seriesId) return false;
        if (!base || expense.type !== "installment") return true;

        const expenseInfo = parseInstallmentDescription(expense.description);
        return !(expenseInfo?.base === base && expense.card === transaction.card && expense.amount === transaction.amount);
      })
    );

    setLedgerOverrides((current) => {
      const next = { ...current };

      allTransactions.forEach((item) => {
        if (item.dragId.startsWith("saved:")) {
          if (transaction.seriesId && item.seriesId === transaction.seriesId) {
            delete next[item.dragId];
          }
          return;
        }

        const itemInfo = getInstallmentInfo(item);
        const sameSeries = transaction.seriesId && item.seriesId === transaction.seriesId;
        const sameLegacySeries = base && itemInfo?.base === base && item.card === transaction.card && item.amount === transaction.amount;

        if (sameSeries || sameLegacySeries) {
          next[item.dragId] = {
            ...(next[item.dragId] ?? {}),
            deleted: true
          };
        }
      });

      return next;
    });
  }

  function deleteFixedSeries(transaction) {
    setSavedExpenses((current) =>
      current.filter((expense) => {
        if (transaction.seriesId && expense.seriesId === transaction.seriesId) return false;
        return !(
          expense.type === "fixed" &&
          expense.description === transaction.description &&
          expense.card === transaction.card &&
          expense.amount === transaction.amount
        );
      })
    );

    setLedgerOverrides((current) => {
      const next = { ...current };

      allTransactions.forEach((item) => {
        const sameSeries = transaction.seriesId && item.seriesId === transaction.seriesId;
        const sameLegacySeries =
          item.ledgerType === "fixed" &&
          item.description === transaction.description &&
          item.card === transaction.card &&
          item.amount === transaction.amount;

        if (item.dragId.startsWith("saved:")) {
          if (sameSeries || sameLegacySeries) {
            delete next[item.dragId];
          }
          return;
        }

        if (sameSeries || sameLegacySeries) {
          next[item.dragId] = {
            ...(next[item.dragId] ?? {}),
            deleted: true
          };
        }
      });

      return next;
    });
  }

  function openEditTransaction(transaction) {
    clearCreationFeedback();
    const info = getInstallmentInfo(transaction);

    setEditingTransaction({
      dragId: transaction.dragId,
      source: transaction,
      type: transaction.ledgerType ?? "single",
      description: info?.base ?? transaction.description,
      amount: String(transaction.amount).replace(".", ","),
      card: transaction.card ?? normalizeColumn(transaction.group),
      installments: String(info?.total ?? 2),
      startInstallment: String(info?.current ?? 1),
      repeatMonths: ""
    });
  }

  function updateEditingForm(field, value) {
    setEditingTransaction((current) => ({ ...current, [field]: value }));
  }

  function saveEditedTransaction(event) {
    event.preventDefault();
    if (!editingTransaction) return;

    const parsedAmount = Number.parseFloat(editingTransaction.amount.replace(",", "."));
    if (!editingTransaction.description.trim() || Number.isNaN(parsedAmount)) return;
    const amount = normalizeAmountForType(editingTransaction.type, parsedAmount);

    if (editingTransaction.dragId.startsWith("saved:")) {
      const expenseId = editingTransaction.dragId.replace("saved:", "");
      setSavedExpenses((current) =>
        current.map((expense) =>
          expense.id === expenseId
            ? {
                ...expense,
                type: editingTransaction.type,
                description: editingTransaction.description.trim(),
                amount,
                card: editingTransaction.card,
                group: editingTransaction.card,
                installmentNumber: editingTransaction.type === "installment"
                  ? clampInteger(editingTransaction.startInstallment, 1, clampInteger(editingTransaction.installments, 1, 48))
                  : undefined,
                installments: editingTransaction.type === "installment"
                  ? clampInteger(editingTransaction.installments, 1, 48)
                  : undefined
              }
            : expense
        )
      );
    } else {
      setLedgerOverrides((current) => ({
        ...current,
        [editingTransaction.dragId]: {
          ...(current[editingTransaction.dragId] ?? {}),
          type: normalizeLedgerType(editingTransaction.type),
          description: editingTransaction.description.trim(),
          amount,
          column: editingTransaction.card
        }
      }));
      setMovedColumns((current) => ({ ...current, [editingTransaction.dragId]: editingTransaction.card }));
    }

    clearCreationFeedback();
    setEditingTransaction(null);
  }

  function moveActiveMonth(offset) {
    clearCreationFeedback();
    setActiveMonthId(getRelativeMonthId(activeMonth.id, offset));
  }

  function goToCurrentMonth() {
    clearCreationFeedback();
    setActiveMonthId(getCurrentMonthId());
  }

  function changeFinancialYear(year) {
    const nextYear = Number.parseInt(year, 10);
    if (!Number.isFinite(nextYear) || nextYear < 1900 || nextYear > 2200) {
      setYearPickerError("Informe um ano entre 1900 e 2200.");
      return false;
    }

    const currentMonthId = getCurrentMonthId();
    const currentYear = getMonthYear(currentMonthId);
    const nextMonthNumber = nextYear === currentYear ? getMonthNumber(currentMonthId) : 1;
    const nextMonthId = createMonthId(nextYear, nextMonthNumber);

    localStorage.setItem("balanco-financeiro:ano-inicial", String(nextYear));
    setActiveMonthId(nextMonthId);
    setActiveView("dashboard");
    setIsYearPickerOpen(false);
    setYearPickerError("");
    clearCreationFeedback();
    return true;
  }

  function openYearSetup() {
    setYearPickerDraft(String(activeYear));
    setYearPickerError("");
    setIsYearPickerOpen(true);
  }

  function selectFinancialYear(year) {
    setYearPickerDraft(String(year));
    changeFinancialYear(year);
  }

  function submitYearPicker(event) {
    event.preventDefault();
    changeFinancialYear(yearPickerDraft);
  }

  function updateLoginDraft(field, value) {
    setLoginDraft((current) => ({
      ...current,
      [field]: value
    }));
    setLoginError("");
  }

  function changeAuthMode(nextMode) {
    setAuthMode(nextMode);
    setLoginError("");
  }

  function submitLocalLogin(event) {
    event.preventDefault();

    const result = authMode === "signup"
      ? createLocalAccount(loginDraft)
      : loginLocalAccount(loginDraft);

    if (!result.ok) {
      setLoginError(result.message);
      return;
    }

    setLocalUser(result.user);
    setAuthStep("app");
  }

  function logoutLocalUser() {
    logoutLocalAccount();
    setLocalUser(null);
    setAuthStep("login");
    setAuthMode("signin");
    setLoginDraft({ name: "", email: "", password: "", confirmPassword: "", remember: true });
    setLoginError("");
  }

  function quickAccessApp() {
    const result = loginLocalAccount({ email: "admin@admin.com", password: "admin", remember: true });
    if (!result.ok) {
      setLoginError(result.message);
      return;
    }
    setLocalUser(result.user);
    setAuthStep("app");
  }

  function clearTestData() {
    const confirmed = window.confirm("Limpar todos os gastos, ajustes e movimentacoes salvos neste navegador?");
    if (!confirmed) return;

    localStorage.removeItem("balanco-financeiro:gastos");
    localStorage.removeItem("balanco-financeiro:colunas-movidas");
    localStorage.removeItem("balanco-financeiro:ajustes-lancamentos");
    localStorage.removeItem("balanco-financeiro:rendimentos");
    localStorage.removeItem("balanco-financeiro:colunas-contas");
    localStorage.removeItem("balanco-financeiro:cores-contas");
    localStorage.removeItem("balanco-financeiro:tipos-contas");
    localStorage.removeItem("balanco-financeiro:mes-ativo");
    localStorage.removeItem("balanco-financeiro:ano-inicial");
    localStorage.setItem("balanco-financeiro:reset-version", DATA_RESET_VERSION);

    setSavedExpenses([]);
    setMovedColumns({});
    setLedgerOverrides({});
    setMonthlyIncome({});
    setAccountColumns(spreadsheetColumns);
    setAccountColors({});
    setAccountTypes({});
    setActiveMonthId(getDefaultActiveMonthId());
    setLastCreatedCount(0);
    setLastCreatedType("");
    setEditingTransaction(null);
    setEditingIncome(false);
    setIncomeDraft("");
  }

  function startEditingIncome() {
    const currentValue = monthlyIncome[activeMonth.id] ?? activeMonth.income;
    const numericValue = Number.parseFloat(String(currentValue).replace(",", "."));
    setIncomeDraft(numericValue === 0 ? "" : String(currentValue).replace(".", ","));
    setEditingIncome(true);
  }

  function saveMonthlyIncome(event) {
    event?.preventDefault?.();
    const parsedValue = Number.parseFloat(incomeDraft.replace(",", "."));
    if (Number.isNaN(parsedValue)) {
      setIncomeDraft(String(activeIncome).replace(".", ","));
      setEditingIncome(false);
      return;
    }

    setMonthlyIncome((current) => ({
      ...current,
      [activeMonth.id]: parsedValue
    }));
    setEditingIncome(false);
    setIncomeDraft("");
  }

  function renameAccountColumn(oldName, rawNextName) {
    const nextName = rawNextName.trim();
    if (!nextName || nextName === oldName) return;
    if (accountColumns.includes(nextName)) {
      window.alert("Ja existe uma conta com esse nome.");
      return;
    }

    setAccountColumns((current) => current.map((column) => (column === oldName ? nextName : column)));
    setSavedExpenses((current) =>
      current.map((expense) =>
        expense.card === oldName || expense.group === oldName
          ? { ...expense, card: nextName, group: nextName }
          : expense
      )
    );
    setMovedColumns((current) => renameMapValues(current, oldName, nextName));
    setLedgerOverrides((current) => {
      const next = {};

      Object.entries(current).forEach(([key, override]) => {
        next[key] = {
          ...override,
          column: override.column === oldName ? nextName : override.column
        };
      });

      return next;
    });
    setAccountColors((current) => {
      if (!current[oldName]) return current;
      const next = { ...current, [nextName]: current[oldName] };
      delete next[oldName];
      return next;
    });
    setAccountTypes((current) => {
      const next = { ...current, [nextName]: current[oldName] ?? defaultAccountType(oldName) };
      delete next[oldName];
      return next;
    });
    setForm((current) => ({
      ...current,
      card: current.card === oldName ? nextName : current.card
    }));
    setEditingTransaction((current) =>
      current
        ? {
            ...current,
            card: current.card === oldName ? nextName : current.card
          }
        : current
    );
  }

  function commitColumnName(oldName, rawNextName) {
    renameAccountColumn(oldName, rawNextName);
    setEditingColumnName(null);
  }

  function startAddingAccountColumn() {
    setNewColumnDraft("");
    setNewAccountType("credit_card");
    setNewColumnError("");
    setIsAddingColumn(true);
  }

  function cancelAddingAccountColumn() {
    setNewColumnDraft("");
    setNewAccountType("credit_card");
    setNewColumnError("");
    setIsAddingColumn(false);
  }

  function addAccountColumn(rawName = newColumnDraft) {
    const newName = rawName.trim();
    if (!newName) return;
    if (accountColumns.includes(newName)) {
      setNewColumnError("Conta ja existe.");
      newColumnInputRef.current?.focus();
      return;
    }

    setAccountColumns((current) => [...current, newName]);
    setAccountTypes((current) => ({ ...current, [newName]: newAccountType }));
    setForm((current) => ({ ...current, card: newName }));
    cancelAddingAccountColumn();
  }

  function commitNewAccountColumn() {
    const newName = newColumnDraft.trim();
    if (!newName) {
      cancelAddingAccountColumn();
      return;
    }

    addAccountColumn(newName);
  }

  function handleNewColumnKeyDown(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitNewAccountColumn();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelAddingAccountColumn();
    }
  }

  function handleNewColumnControlBlur(event) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    commitNewAccountColumn();
  }

  function renderNewColumnControl() {
    if (isAddingColumn) {
      return (
        <span className="new-column-control" onBlur={handleNewColumnControlBlur}>
          <input
            ref={newColumnInputRef}
            className="new-column-input"
            aria-label="Nome da nova conta"
            value={newColumnDraft}
            onChange={(event) => {
              setNewColumnDraft(event.target.value);
              if (newColumnError) setNewColumnError("");
            }}
            onKeyDown={handleNewColumnKeyDown}
          />
          <select
            className="new-account-type-select"
            aria-label="Tipo da nova conta"
            value={newAccountType}
            onChange={(event) => setNewAccountType(event.target.value)}
          >
            {accountTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {newColumnError && <small className="new-column-error">{newColumnError}</small>}
        </span>
      );
    }

    return (
      <button className="ghost-button" type="button" onClick={startAddingAccountColumn}>
        Nova conta
      </button>
    );
  }

  function updateAccountColor(columnName, color) {
    setAccountColors((current) => ({
      ...current,
      [columnName]: color
    }));
  }

  function deleteAccountColumn(columnName) {
    if (accountColumns.length <= 1) {
      window.alert("Mantenha pelo menos uma conta.");
      return;
    }

    const hasTransactions = (transactionsByColumn[columnName] ?? []).length > 0;
    const message = hasTransactions
      ? `Excluir a conta "${columnName}" e todos os lançamentos nela?`
      : `Excluir a conta "${columnName}"?`;
    const confirmed = window.confirm(message);
    if (!confirmed) return;

    const fallbackColumn = accountColumns.find((column) => column !== columnName) ?? spreadsheetColumns[0];

    setAccountColumns((current) => current.filter((column) => column !== columnName));
    setSavedExpenses((current) => current.filter((expense) => expense.card !== columnName && expense.group !== columnName));
    setMovedColumns((current) => {
      const next = {};
      Object.entries(current).forEach(([key, value]) => {
        if (value !== columnName) next[key] = value;
      });
      return next;
    });
    setLedgerOverrides((current) => {
      const next = { ...current };

      allTransactions.forEach((transaction) => {
        if (transaction.card === columnName || transaction.group === columnName) {
          if (transaction.dragId.startsWith("saved:")) {
            delete next[transaction.dragId];
          } else {
            next[transaction.dragId] = {
              ...(next[transaction.dragId] ?? {}),
              deleted: true
            };
          }
        }
      });

      Object.entries(next).forEach(([key, override]) => {
        if (override.column === columnName) delete next[key];
      });

      return next;
    });
    setAccountColors((current) => {
      const next = { ...current };
      delete next[columnName];
      return next;
    });
    setAccountTypes((current) => {
      const next = { ...current };
      delete next[columnName];
      return next;
    });
    setForm((current) => ({
      ...current,
      card: current.card === columnName ? fallbackColumn : current.card
    }));
    setEditingTransaction((current) =>
      current
        ? {
            ...current,
            card: current.card === columnName ? fallbackColumn : current.card
          }
        : current
    );
  }

  if (!localUser && authStep === "welcome") {
    return <WelcomeScreen onStart={() => setAuthStep("login")} />;
  }

  if (!localUser) {
    return (
      <LoginScreen
        mode={authMode}
        draft={loginDraft}
        error={loginError}
        onBack={() => setAuthStep("welcome")}
        onChange={updateLoginDraft}
        onModeChange={changeAuthMode}
        onSubmit={submitLocalLogin}
        onQuickAccess={quickAccessApp}
      />
    );
  }

  return (
    <main className="app-shell app-shell-enter">
      {isYearPickerOpen && (
        <YearPicker
          activeYear={activeYear}
          draft={yearPickerDraft}
          error={yearPickerError}
          onChange={(value) => {
            setYearPickerDraft(value);
            setYearPickerError("");
          }}
          onClose={() => setIsYearPickerOpen(false)}
          onSelectYear={selectFinancialYear}
          onSubmit={submitYearPicker}
        />
      )}

      <aside className="sidebar" aria-label="Navegacao principal">
        <BrandIdentity userName={localUser.name} />

        <nav className="nav-list" aria-label="Secoes">
          {navigationItems.map((item) => (
            <button
              className={`nav-item ${activeView === item.id ? "active" : ""}`}
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
            >
              <Icon>{item.icon}</Icon> {item.label}
            </button>
          ))}
          <button className="nav-item logout-button" type="button" onClick={logoutLocalUser}>
            <Icon>↩</Icon> Sair
          </button>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar period-header">
          <section className="period-focus" aria-label="Periodo financeiro atual">
            <div className="period-main">
              <button className="period-nav-button" type="button" onClick={() => moveActiveMonth(-1)} aria-label="Mes anterior">
                ‹
              </button>
              <div className="period-display">
                <strong>{activeMonthName}</strong>
                <span>{activeYear}</span>
                <small>{activeMonthNumber} de 12</small>
                <button
                  className={`current-period-button ${isCurrentMonth ? "" : "return-current"}`}
                  type="button"
                  onClick={goToCurrentMonth}
                >
                  {isCurrentMonth ? "Hoje" : "Voltar"}
                </button>
                <div className="period-progress" aria-hidden="true">
                  <span style={{ width: `${annualProgress}%` }} />
                  <i style={{ left: `${annualProgress}%` }} />
                </div>
              </div>
              <button className="period-nav-button" type="button" onClick={() => moveActiveMonth(1)} aria-label="Proximo mes">
                ›
              </button>
            </div>
            <div className="period-month-grid" aria-label="Meses do ano">
              {yearMonths.map((month) => (
                <button
                  className={month.id === activeMonth.id ? "active" : ""}
                  key={month.id}
                  type="button"
                  onClick={() => {
                    clearCreationFeedback();
                    setActiveMonthId(month.id);
                  }}
                >
                  {month.label.split(" ")[0].slice(0, 3)}
                </button>
              ))}
            </div>
          </section>
        </header>

        <header className="topbar actions-header">
          <div className="top-actions period-actions">
            <button className="primary-button add-expense-button" type="button" onClick={focusQuickEntry}>
              <span>Novo gasto</span>
            </button>
            <button className="danger-button clear-data-button" type="button" onClick={clearTestData}>
              <span>Limpar base</span>
            </button>
            <button className="ghost-button configure-year-button" type="button" onClick={openYearSetup}>
              <span>Alterar ano</span>
            </button>
          </div>
        </header>

        <div className="sidebar-panel spending-timeline">
          <div className="timeline-header">
            <span>Histórico de gastos</span>
            <strong>{spendingStatus}</strong>
          </div>
          <div className="timeline-track">
            <div className={`timeline-progress ${spendingStatusClass}`} style={{ width: `${timelineWidth}%` }} />
          </div>
          <div className="timeline-info">
            <span>{formatMoney(adjustedDebt)} gastos</span>
            <span>{formatMoney(activeIncome)} limite</span>
          </div>
          {isOverBudget && (
            <small className="timeline-note">Você está no vermelho — pare de gastar e reveja seu orçamento.</small>
          )}
        </div>

        {(activeView === "dashboard" || activeView === "lancamentos") && (
          <section className="metrics-grid" aria-label="Resumo financeiro">
            <EditableMetricCard
              label="Rendimentos"
              value={activeIncome}
              kind="income"
              helper="Liquido do mes"
              isEditing={editingIncome}
              draftValue={incomeDraft}
              onStartEdit={startEditingIncome}
              onChange={setIncomeDraft}
              onSave={saveMonthlyIncome}
            />
            <MetricCard label="Gastos do mes" value={adjustedDebt} kind="debt" helper={`${allTransactions.length} lancamentos no mes`} />
            <MetricCard label="Saldo" value={adjustedBalance} kind={adjustedBalance >= 0 ? "income" : "danger"} helper={`${filledAccounts}/${accountColumns.length} contas com lancamentos`} />
          </section>
        )}

        {activeView === "dashboard" && (
          <section className="dashboard-view" aria-label="Dashboard financeiro">
            <article className="panel annual-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Ano {dashboardYear}</span>
                  <h2>Visao anual</h2>
                </div>
                <span className={`annual-status ${annualBalance >= 0 ? "positive" : "risk"}`}>
                  {annualBalance >= 0 ? "Saldo positivo" : "Saldo negativo"}
                </span>
              </div>

              <div className="annual-hero">
                <div>
                  <span>Total gasto</span>
                  <strong>{formatMoney(annualSpent)}</strong>
                </div>
                <div>
                  <span>Rendimentos</span>
                  <strong>{formatMoney(annualIncome)}</strong>
                </div>
                <div>
                  <span>Saldo anual</span>
                  <strong className={annualBalance < 0 ? "risk-text" : ""}>{formatMoney(annualBalance)}</strong>
                </div>
              </div>

              <div className="annual-ring-row">
                <div className="annual-ring" style={{ "--usage": `${annualUsage * 360}deg` }}>
                  <span>{Math.round(annualUsage * 100)}%</span>
                </div>
                <div className="annual-insights">
                  <div>
                    <span>Maior gasto</span>
                    <strong>{highestSpendingMonth.label}</strong>
                    <small>{formatMoney(highestSpendingMonth.debt)}</small>
                  </div>
                  <div>
                    <span>Melhor saldo</span>
                    <strong>{bestBalanceMonth.label}</strong>
                    <small>{formatMoney(bestBalanceMonth.balance)}</small>
                  </div>
                </div>
              </div>
            </article>

            <article className="panel monthly-chart-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Mes a mes</span>
                  <h2>Gastos por mes</h2>
                </div>
              </div>

              <div className="monthly-bars" aria-label="Grafico de gastos mensais">
                {dashboardYearMonths.map((month) => {
                  const height = Math.max((Math.abs(month.debt) / maxMonthlyDebt) * 100, month.debt ? 8 : 10);
                  const isActiveMonth = month.id === activeMonth.id;
                  return (
                    <button
                      className={`monthly-bar-item ${isActiveMonth ? "active" : ""} ${month.debt === 0 ? "empty" : ""}`}
                      key={month.id}
                      type="button"
                      onClick={() => setActiveMonthId(month.id)}
                    >
                      <span className="monthly-bar-value">
                        {month.debt !== 0 ? formatMoney(month.debt) : ""}
                      </span>
                      <div className="monthly-bar-track">
                        <span
                          className={month.balance < 0 ? "risk" : ""}
                          style={{ "--bar-height": `${height}%` }}
                        />
                      </div>
                      <strong>{month.shortLabel}</strong>
                      <small className="monthly-current-pill" aria-hidden={!isActiveMonth}>
                        Atual
                      </small>
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="panel monthly-flow-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Fluxo mensal</span>
                  <h2>Resumo financeiro por mes</h2>
                </div>
              </div>

              <div className="monthly-flow-list">
                <div className="monthly-flow-header" aria-hidden="true">
                  <span>Mes</span>
                  <span>Gastos</span>
                  <span>Rendimentos</span>
                  <span>Saldo</span>
                  <span>Uso da renda</span>
                </div>
                {dashboardYearMonths.map((month) => {
                  const incomeUsage = month.income ? Math.min(Math.max((month.debt / month.income) * 100, 0), 100) : 0;
                  const usageLabel = month.income ? `${Math.round(incomeUsage)}%` : "Sem renda";
                  const statusLabel = month.income
                    ? month.balance >= 0
                      ? "Dentro do mes"
                      : "Acima da renda"
                    : "Informe renda";
                  const isActiveMonth = month.id === activeMonth.id;

                  return (
                    <button
                      className={`monthly-flow-row ${isActiveMonth ? "active" : ""}`}
                      key={month.id}
                      type="button"
                      onClick={() => setActiveMonthId(month.id)}
                    >
                      <div className="flow-month-cell">
                        <strong>{month.label}</strong>
                        <span>{month.count} lancamentos</span>
                      </div>
                      <span className="flow-money-cell">
                        <small>Gastos</small>
                        <strong>{formatMoney(month.debt)}</strong>
                      </span>
                      <span className="flow-money-cell">
                        <small>Rendimentos</small>
                        <strong>{formatMoney(month.income)}</strong>
                      </span>
                      <span className="flow-money-cell">
                        <small>Saldo</small>
                        <strong className={month.balance < 0 ? "risk-text" : "positive-text"}>{formatMoney(month.balance)}</strong>
                      </span>
                      <div className="flow-usage-cell">
                        <div className="flow-usage-copy">
                          <span>{usageLabel}</span>
                          <small className={month.balance < 0 ? "risk-text" : ""}>{statusLabel}</small>
                        </div>
                        <div className="flow-usage-track">
                          <span
                            className={month.balance < 0 ? "risk" : ""}
                            style={{ width: `${month.income ? Math.max(incomeUsage, month.debt ? 4 : 0) : 0}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </article>

            <article className="panel dashboard-categories-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Categorias</span>
                  <h2>Distribuicao do mes</h2>
                </div>
              </div>
              <div className="category-list">
                {categoryTotals.slice(0, 5).map((category) => (
                  <div className="category-row" key={category.name}>
                    <span className={`dot ${category.tone}`} />
                    <strong>{category.name}</strong>
                    <div className="category-track">
                      <span className={category.tone} style={{ width: `${(category.value / maxCategory) * 100}%` }} />
                    </div>
                    <span>{formatMoney(category.value)}</span>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeView === "lancamentos" && (
          <>
            <section className="entry-section">
              <aside className="panel quick-entry" ref={quickEntryRef}>
                <div className="panel-heading compact">
                  <h2>Adicionar gasto</h2>
                </div>
                <form onSubmit={handleAddExpense} noValidate>
                  <div className="type-selector operation-selector" aria-label="Tipo de lancamento">
                    {transactionTypeOptions.map((option) => (
                      <button
                        className={`${form.type === option.value ? "active" : ""} ${option.value === "adjustment" ? "refund-type" : ""}`}
                        key={option.value}
                        type="button"
                        onClick={() => updateForm("type", option.value)}
                      >
                        <span className="operation-icon" aria-hidden="true">{option.icon}</span>
                        <span className="operation-copy">
                          <strong>{option.label}</strong>
                          <small>{option.hint}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <label>
                    Descricao do gasto
                    <input
                      name="description"
                      placeholder="Ex.: Mercado, gasolina, remedio"
                      value={form.description}
                      onChange={(event) => updateForm("description", event.target.value)}
                    />
                  </label>
                  <label>
                    Conta
                    <select value={form.card} onChange={(event) => updateForm("card", event.target.value)}>
                      {accountColumns.map((column) => (
                        <option key={column}>{column}</option>
                      ))}
                    </select>
                  </label>
                  <div className="form-row">
                    <label>
                      Valor
                      <input
                        name="amount"
                        inputMode="decimal"
                        enterKeyHint="done"
                        placeholder="R$ 0,00"
                        value={form.amount}
                        onChange={(event) => updateForm("amount", event.target.value)}
                      />
                    </label>
                  </div>
                  {form.type === "installment" && (
                    <div className="form-row">
                      <label>
                        Parcelas
                        <input
                          inputMode="numeric"
                          placeholder="Ex.: 10"
                          value={form.installments}
                          onChange={(event) => updateForm("installments", event.target.value)}
                        />
                      </label>
                      <label>
                        Parcela inicial
                        <input
                          inputMode="numeric"
                          placeholder="Ex.: 1"
                          value={form.startInstallment}
                          onChange={(event) => updateForm("startInstallment", event.target.value)}
                        />
                      </label>
                    </div>
                  )}
                  {form.type === "fixed" && (
                    <label>
                      Repetir por quantos meses
                      <input
                        inputMode="numeric"
                        placeholder="Em branco = todos os meses"
                        value={form.repeatMonths}
                        onChange={(event) => updateForm("repeatMonths", event.target.value)}
                      />
                    </label>
                  )}
                  <button className="save-entry-button" type="submit" onTouchEnd={handleSaveExpenseTouch}>
                    <span aria-hidden="true">✓</span>
                    Incluir
                  </button>
                  {formError && <small className="form-error">{formError}</small>}
                  {lastCreatedCount > 0 && !formError && (
                    <small className="creation-note">
                      {creationMessage(lastCreatedType, lastCreatedCount)}
                    </small>
                  )}
                  <small className="storage-note">Salvo neste navegador em localStorage.</small>
                </form>
              </aside>
            </section>

        <section className="ledger-flow">
          <article className="panel ledger-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Planilha do mes</span>
                <h2>Lancamentos por conta</h2>
              </div>
              <div className="panel-actions">
                {renderNewColumnControl()}
                <span className="ledger-count">{allTransactions.length} itens</span>
              </div>
            </div>
              <div className="ledger-board" aria-label="Lancamentos agrupados por conta">
              {accountColumns.map((column) => {
                const transactions = transactionsByColumn[column];
                const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
                const groupedByType = groupTransactionsByType(transactions);
                const columnColor = accountColors[column] ?? defaultColumnColor(column, accountColumns);
                const isCollapsed = collapsedColumns[column] ?? transactions.length === 0;

                return (
                  <section className={`ledger-column ${columnClass(column, accountColumns)} ${isCollapsed ? "collapsed" : ""}`} key={column}>
                    <header
                      style={columnHeaderStyle(accountColors[column], !isCollapsed)}
                      role="button"
                      tabIndex={0}
                      aria-expanded={!isCollapsed}
                      onClick={(event) => {
                        if (event.target.closest(".editable-column-name")) {
                          return;
                        }
                        toggleLedgerColumn(column);
                      }}
                      onKeyDown={(event) => {
                        if (event.target.closest(".editable-column-name")) {
                          return;
                        }
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleLedgerColumn(column);
                        }
                      }}
                    >
                      <div className="ledger-column-toolbar">
                        <label className="column-color-button" title="Definir cor" onClick={(event) => event.stopPropagation()}>
                          <span style={{ background: columnColor }} />
                          <input
                            aria-label={`Definir cor de ${column}`}
                            type="color"
                            value={columnColor}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => updateAccountColor(column, event.target.value)}
                          />
                        </label>
                        <button
                          className="delete-column-button"
                          type="button"
                          title="Excluir conta"
                          aria-label={`Excluir conta ${column}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteAccountColumn(column);
                          }}
                        >
                          ×
                        </button>
                      </div>
                      <strong
                        className="editable-column-name"
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck="false"
                        title="Clique para renomear"
                        onPointerDown={(event) => {
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        onFocus={(event) => {
                          event.stopPropagation();
                          setEditingColumnName(column);
                        }}
                        onBlur={(event) => commitColumnName(column, event.currentTarget.textContent ?? column)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }

                          if (event.key === "Escape") {
                            event.preventDefault();
                            event.currentTarget.textContent = column;
                            setEditingColumnName(null);
                            event.currentTarget.blur();
                          }
                        }}
                      >
                        {editingColumnName === column ? column : column}
                      </strong>
                      <span>{formatMoney(total)} • {transactions.length} itens</span>
                      <span className="ledger-collapse-indicator" aria-hidden="true">{isCollapsed ? "＋" : "−"}</span>
                    </header>
                    <div className={`ledger-items-wrap ${isCollapsed ? "collapsed" : "expanded"}`}>
                      <div className="ledger-items">
                        {ledgerSections.map((section) => (
                          <div
                            className="ledger-section"
                            key={`${column}-${section.key}`}
                          >
                            <div
                              className="ledger-section-title"
                            >
                              <span>{section.label}</span>
                              <strong>{groupedByType[section.key].length}</strong>
                            </div>
                            {groupedByType[section.key].length > 0 ? (
                              groupedByType[section.key].map((transaction) => (
                                <div
                                  className={`ledger-item ${section.key} ${transaction.ledgerType === "adjustment" ? "refund-item" : ""}`}
                                  key={transaction.dragId}
                                >
                                  <span>{transaction.description}</span>
                                  {section.key === "installment" && (
                                    <small>{installmentHint(transaction)}</small>
                                  )}
                                  <strong className={transaction.ledgerType === "adjustment" ? "refund-value" : "expense-value"}>
                                    {formatLedgerItemAmount(transaction)}
                                  </strong>
                                  <div className="ledger-actions">
                                    <button type="button" onClick={(event) => {
                                      event.stopPropagation();
                                      openEditTransaction(transaction);
                                    }}>
                                      Editar
                                    </button>
                                    <button type="button" onClick={(event) => {
                                      event.stopPropagation();
                                      deleteTransaction(transaction);
                                    }}>
                                      Excluir
                                    </button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="empty-section">Sem lancamentos</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </article>
        </section>
          </>
        )}

        {activeView === "cartoes" && (
          <section className="cards-view">
            <article className="panel account-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Contas</span>
                  <h2>{formatMoney(totalAccounts)}</h2>
                </div>
                {renderNewColumnControl()}
              </div>

              <div className="account-list account-groups">
                {accountSummariesByType.map((group) => {
                  const groupTotal = group.accounts.reduce((sum, account) => sum + account.amount, 0);
                  const groupTransactions = group.accounts.reduce((sum, account) => sum + account.count, 0);

                  return (
                  <section className={`account-type-group account-type-${group.value}`} key={group.value}>
                    <div className="account-type-heading">
                      <div>
                        <span className="account-type-kicker">{group.accounts.length} contas • {groupTransactions} lancamentos</span>
                        <strong>{group.label}</strong>
                      </div>
                      <div className="account-type-total">
                        <span>Total</span>
                        <strong>{formatMoney(groupTotal)}</strong>
                      </div>
                    </div>
                    {group.accounts.map((account) => {
                      const width = maxAccount ? Math.max((Math.abs(account.amount) / maxAccount) * 100, 8) : 0;
                      return (
                        <div className="account-row account-manager-row" key={account.name}>
                          <div>
                            <strong>{account.name}</strong>
                            <span>{account.count} lancamentos • fixos {formatMoney(account.fixedTotal)} • parcelas {formatMoney(account.installmentTotal)}</span>
                          </div>
                          <span className="account-type-pill">{accountTypeLabel(account.type)}</span>
                          <div className="bar-track">
                            <span style={{ width: `${width}%` }} />
                          </div>
                          <strong className={account.amount < 0 ? "positive" : ""}>{formatMoney(account.amount)}</strong>
                          <button className="ghost-button" type="button" onClick={() => deleteAccountColumn(account.name)}>
                            Excluir
                          </button>
                        </div>
                      );
                    })}
                  </section>
                  );
                })}
              </div>
            </article>
          </section>
        )}

        {activeView === "relatorios" && (
        <section className="secondary-grid">
          <article className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Categorias</span>
                <h2>Distribuicao</h2>
              </div>
            </div>
            <div className="category-list">
              {categoryTotals.slice(0, 5).map((category) => (
                <div className="category-row" key={category.name}>
                  <span className={`dot ${category.tone}`} />
                  <strong>{category.name}</strong>
                  <div className="category-track">
                    <span className={category.tone} style={{ width: `${(category.value / maxCategory) * 100}%` }} />
                  </div>
                  <span>{formatMoney(category.value)}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel transactions-panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Lancamentos</span>
                <h2>Transacoes recentes</h2>
              </div>
            </div>
            <div className="transaction-list">
              {allTransactions.slice(0, 8).map((transaction) => (
                <div className="transaction-row" key={transaction.id ?? `${transaction.group}-${transaction.description}`}>
                  <div className="transaction-icon">{transaction.description.slice(0, 1)}</div>
                  <div>
                    <strong>{transaction.description}</strong>
                    <span>
                      {transaction.card ?? transaction.group}
                      {transaction.id ? " • cadastrado agora" : ""}
                    </span>
                  </div>
                  <strong>{formatMoney(transaction.amount)}</strong>
                  {transaction.id && (
                    <button className="icon-button" type="button" onClick={() => removeExpense(transaction.id)} aria-label="Remover gasto">
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </article>
        </section>
        )}

        <footer className="app-footer">
          <span>© 2026 Stefferson Luz Silva. Todos os direitos reservados.</span>
          <a href="https://instagram.com/steffersonluz" target="_blank" rel="noopener noreferrer" class="instagram-link">
            <svg class="instagram-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <circle cx="12" cy="12" r="5"/>
              <circle cx="17.5" cy="6.5" r="1.5"/>
            </svg>
            steffersonluz
          </a>
        </footer>
      </section>

      {editingTransaction && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Editar lançamento">
          <form className="edit-modal" onSubmit={saveEditedTransaction}>
            <div className="panel-heading compact">
              <div>
                <span className="eyebrow">Editar lançamento</span>
                <h2>Atualizar compra</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setEditingTransaction(null)}>×</button>
            </div>

            <div className="type-selector operation-selector light" aria-label="Tipo de lançamento">
              {transactionTypeOptions.map((option) => (
                <button
                  className={`${editingTransaction.type === option.value ? "active" : ""} ${option.value === "adjustment" ? "refund-type" : ""}`}
                  key={option.value}
                  type="button"
                  onClick={() => updateEditingForm("type", option.value)}
                >
                  <span className="operation-icon" aria-hidden="true">{option.icon}</span>
                  <span className="operation-copy">
                    <strong>{option.label}</strong>
                    <small>{option.hint}</small>
                  </span>
                </button>
              ))}
            </div>

            <label>
              Descricao do gasto
              <input value={editingTransaction.description} onChange={(event) => updateEditingForm("description", event.target.value)} />
            </label>
            <label>
              Conta
              <select value={editingTransaction.card} onChange={(event) => updateEditingForm("card", event.target.value)}>
                {accountColumns.map((column) => (
                  <option key={column}>{column}</option>
                ))}
              </select>
            </label>
            <label>
              Valor
              <input inputMode="decimal" value={editingTransaction.amount} onChange={(event) => updateEditingForm("amount", event.target.value)} />
            </label>

            {editingTransaction.type === "installment" && (
              <div className="form-row">
                <label>
                  Parcelas
                  <input inputMode="numeric" value={editingTransaction.installments} onChange={(event) => updateEditingForm("installments", event.target.value)} />
                </label>
                <label>
                  Parcela inicial
                  <input inputMode="numeric" value={editingTransaction.startInstallment} onChange={(event) => updateEditingForm("startInstallment", event.target.value)} />
                </label>
              </div>
            )}

            {editingTransaction.type === "fixed" && (
              <label>
                Repetir por quantos meses
                <input inputMode="numeric" placeholder="Em branco = todos os meses" value={editingTransaction.repeatMonths} onChange={(event) => updateEditingForm("repeatMonths", event.target.value)} />
              </label>
            )}

            <button className="primary-button full" type="submit">Salvar alteracao</button>
          </form>
        </div>
      )}
    </main>
  );
}

const ledgerSections = [
  { key: "fixed", label: "Gastos fixos" },
  { key: "installment", label: "Parcelados" },
  { key: "single", label: "Avulsos / ajustes" }
];

export default App;
