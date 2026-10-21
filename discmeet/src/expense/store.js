/**
 * DiscMeet — src/expense/store.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

/**
 * Expense Store — JSON-file-based persistence for expense tracking.
 *
 * Stores all expenses and budgets in data/expenses.json.
 * Provides CRUD operations with per-user, per-guild isolation.
 */

const fs = require('node:fs');
const path = require('node:path');
const config = require('../config');
const logger = require('../utils/logger');

const DATA_FILE = path.join(config.dataDir, 'expenses.json');

/**
 * Default data structure.
 */
function defaultData() {
  return {
    expenses: [],
    budgets: {},
    nextId: 1,
  };
}

/**
 * Load data from JSON file. Creates file if it doesn't exist.
 * @returns {object}
 */
function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.mkdirSync(config.dataDir, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData(), null, 2), 'utf-8');
      return defaultData();
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    logger.error('Failed to load expense data:', err.message);
    return defaultData();
  }
}

/**
 * Save data to JSON file.
 * @param {object} data
 */
function saveData(data) {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    logger.error('Failed to save expense data:', err.message);
  }
}

// ── CRUD Operations ───────────────────────────────────────────────────

/**
 * Add a new expense.
 *
 * @param {string} userId
 * @param {string} guildId
 * @param {number} amount
 * @param {string} category
 * @param {string} [description='']
 * @returns {{ id: number, expense: object }}
 */
function addExpense(userId, guildId, amount, category, description = '') {
  const data = loadData();

  const expense = {
    id: data.nextId++,
    userId,
    guildId,
    amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
    category: category.trim(),
    description: description.trim(),
    date: new Date().toISOString(),
  };

  data.expenses.push(expense);
  saveData(data);

  logger.debug(`Expense #${expense.id} added: ${expense.category} — £${expense.amount}`);
  return { id: expense.id, expense };
}

/**
 * Get expenses for a user in a guild, filtered by month.
 *
 * @param {string} userId
 * @param {string} guildId
 * @param {string} [monthKey] - Format: "YYYY-MM". Defaults to current month.
 * @returns {object[]}
 */
function getExpenses(userId, guildId, monthKey) {
  const data = loadData();

  if (!monthKey) {
    const now = new Date();
    monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  return data.expenses.filter((e) => {
    if (e.userId !== userId || e.guildId !== guildId) return false;
    return e.date.startsWith(monthKey);
  });
}

/**
 * Find a single expense by ID, scoped to user + guild.
 *
 * @param {number} id
 * @param {string} userId
 * @param {string} guildId
 * @returns {object|null}
 */
function findExpense(id, userId, guildId) {
  const data = loadData();
  return data.expenses.find(
    (e) => e.id === id && e.userId === userId && e.guildId === guildId
  ) || null;
}

/**
 * Edit an existing expense.
 *
 * @param {number} id
 * @param {string} userId
 * @param {string} guildId
 * @param {object} updates - { amount?, category?, description? }
 * @returns {object|null} Updated expense, or null if not found
 */
function editExpense(id, userId, guildId, updates) {
  const data = loadData();
  const expense = data.expenses.find(
    (e) => e.id === id && e.userId === userId && e.guildId === guildId
  );

  if (!expense) return null;

  if (updates.amount !== undefined && updates.amount !== null) {
    expense.amount = Math.round(updates.amount * 100) / 100;
  }
  if (updates.category !== undefined && updates.category !== null) {
    expense.category = updates.category.trim();
  }
  if (updates.description !== undefined && updates.description !== null) {
    expense.description = updates.description.trim();
  }

  saveData(data);
  logger.debug(`Expense #${expense.id} updated`);
  return expense;
}

/**
 * Remove an expense by ID.
 *
 * @param {number} id
 * @param {string} userId
 * @param {string} guildId
 * @returns {object|null} Removed expense, or null if not found
 */
function removeExpense(id, userId, guildId) {
  const data = loadData();
  const index = data.expenses.findIndex(
    (e) => e.id === id && e.userId === userId && e.guildId === guildId
  );

  if (index === -1) return null;

  const [removed] = data.expenses.splice(index, 1);
  saveData(data);
  logger.debug(`Expense #${removed.id} removed`);
  return removed;
}

/**
 * Get total spending for a user in a guild for a given month.
 *
 * @param {string} userId
 * @param {string} guildId
 * @param {string} [monthKey]
 * @returns {{ total: number, count: number, byCategory: object }}
 */
function getMonthlyTotal(userId, guildId, monthKey) {
  const expenses = getExpenses(userId, guildId, monthKey);

  const byCategory = {};
  let total = 0;

  for (const exp of expenses) {
    total += exp.amount;
    byCategory[exp.category] = (byCategory[exp.category] || 0) + exp.amount;
  }

  return {
    total: Math.round(total * 100) / 100,
    count: expenses.length,
    byCategory,
  };
}

/**
 * Get or set budget for a user in a guild for a given month.
 *
 * @param {string} userId
 * @param {string} guildId
 * @param {string} [monthKey]
 * @param {number} [newBudget] - If provided, sets the budget
 * @returns {number|null} Current budget, or null if not set
 */
function budget(userId, guildId, monthKey, newBudget) {
  const data = loadData();

  if (!monthKey) {
    const now = new Date();
    monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const key = `${guildId}:${userId}:${monthKey}`;

  if (newBudget !== undefined && newBudget !== null) {
    data.budgets[key] = Math.round(newBudget * 100) / 100;
    saveData(data);
    return data.budgets[key];
  }

  return data.budgets[key] || null;
}

module.exports = {
  addExpense,
  getExpenses,
  findExpense,
  editExpense,
  removeExpense,
  getMonthlyTotal,
  budget,
};
