/* Expense & Budget Visualizer — Vanilla JS, Local Storage only */
(function () {
  'use strict';

  var DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];
  var LS_TX = 'sefc_transactions_v1';
  var LS_CAT = 'sefc_categories_v1';
  var LS_THEME = 'sefc_theme_v1';
  var LS_BUDGET = 'sefc_budget_v1';
  var LS_SORT = 'sefc_sort_v1';

  var BASE_COLORS = {
    Food: '#2ecc71',
    Transport: '#3598db',
    Fun: '#e67e22'
  };
  var EXTRA_PALETTE = ['#9b59b6', '#e91e63', '#00bcd4', '#ff5722', '#795548', '#607d8b', '#f1c40f', '#1abc9c'];

  // ---------- State ----------
  var transactions = loadJSON(LS_TX, []);
  var categories = loadJSON(LS_CAT, null) || DEFAULT_CATEGORIES.slice();
  var budgetLimit = loadNumber(LS_BUDGET, 0);
  var sortMode = localStorage.getItem(LS_SORT) || 'newest';

  // ---------- DOM ----------
  var totalBalanceEl = document.getElementById('totalBalance');
  var txCountEl = document.getElementById('txCount');
  var monthSummaryEl = document.getElementById('monthSummary');
  var form = document.getElementById('txForm');
  var nameInput = document.getElementById('itemName');
  var amountInput = document.getElementById('itemAmount');
  var categorySelect = document.getElementById('itemCategory');
  var formError = document.getElementById('formError');
  var txList = document.getElementById('txList');
  var txEmpty = document.getElementById('txEmpty');
  var sortSelect = document.getElementById('sortSelect');
  var chartCanvas = document.getElementById('spendingChart');
  var chartEmpty = document.getElementById('chartEmpty');
  var breakdownEl = document.getElementById('categoryBreakdown');
  var themeToggle = document.getElementById('themeToggle');
  var budgetInput = document.getElementById('budgetInput');
  var budgetSave = document.getElementById('budgetSave');
  var budgetClear = document.getElementById('budgetClear');
  var budgetBar = document.getElementById('budgetBar');
  var budgetMsg = document.getElementById('budgetMsg');
  var heroCard = document.querySelector('.hero');
  var newCatBtn = document.getElementById('newCatBtn');
  var newCatRow = document.getElementById('newCatRow');
  var newCatInput = document.getElementById('newCatInput');

  var chart = null;

  init();

  function init() {
    initTheme();
    renderCategoryOptions();
    renderCustomChips();
    sortSelect.value = sortMode;
    if (budgetLimit > 0) budgetInput.value = budgetLimit;
    bindEvents();
    renderAll();
  }

  // ---------- Events ----------
  function bindEvents() {
    form.addEventListener('submit', onSubmit);

    txList.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-delete]');
      if (!btn) return;
      removeTransaction(btn.getAttribute('data-delete'));
    });

    sortSelect.addEventListener('change', function () {
      sortMode = sortSelect.value;
      localStorage.setItem(LS_SORT, sortMode);
      renderList();
    });

    themeToggle.addEventListener('click', toggleTheme);

    budgetSave.addEventListener('click', function () {
      var v = parseFloat(budgetInput.value);
      if (!isFinite(v) || v <= 0) {
        budgetMsg.textContent = 'Enter a valid budget amount greater than 0.';
        budgetMsg.classList.remove('over');
        return;
      }
      budgetLimit = Math.round(v * 100) / 100;
      localStorage.setItem(LS_BUDGET, String(budgetLimit));
      renderBudget();
    });

    budgetClear.addEventListener('click', function () {
      budgetLimit = 0;
      budgetInput.value = '';
      localStorage.removeItem(LS_BUDGET);
      renderBudget();
    });

    newCatBtn.addEventListener('click', function () {
      newCatRow.hidden = !newCatRow.hidden;
      if (!newCatRow.hidden) newCatInput.focus();
    });
    document.getElementById('newCatCancel').addEventListener('click', function () {
      newCatRow.hidden = true;
      newCatInput.value = '';
    });
    document.getElementById('newCatAdd').addEventListener('click', addCustomCategory);
    document.getElementById('customCats').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-remove-cat]');
      if (!btn) return;
      removeCustomCategory(btn.getAttribute('data-remove-cat'));
    });

    document.getElementById('sampleBtn').addEventListener('click', function () {
      if (transactions.length > 0) return;
      var now = Date.now();
      transactions = [
        { id: uid(), name: 'Cilok', amount: 14.94, category: 'Food', createdAt: now - 1000 * 60 * 42 },
        { id: uid(), name: 'Bus fare', amount: 5.20, category: 'Transport', createdAt: now - 1000 * 60 * 60 * 5 },
        { id: uid(), name: 'Shopping', amount: 3.56, category: 'Fun', createdAt: now - 1000 * 60 * 60 * 26 }
      ];
      saveTransactions();
      renderAll();
    });
  }

  // ---------- Form ----------
  function onSubmit(e) {
    e.preventDefault();
    hideError();

    var name = nameInput.value.trim();
    var amount = parseFloat(amountInput.value);
    var category = categorySelect.value;

    if (!name || !amountInput.value.trim() || !category) {
      return showError('Please fill in all fields: Item Name, Amount, and Category.');
    }
    if (!isFinite(amount) || amount <= 0) {
      return showError('Amount must be a number greater than 0.');
    }
    amount = Math.round(amount * 100) / 100;

    transactions.push({ id: uid(), name: name, amount: amount, category: category, createdAt: Date.now() });
    saveTransactions();

    form.reset();
    if (categories.length > 0) categorySelect.value = categories[0];
    nameInput.focus();
    renderAll();
  }

  function showError(msg) {
    formError.textContent = msg;
    formError.hidden = false;
  }
  function hideError() {
    formError.hidden = true;
    formError.textContent = '';
  }

  // ---------- Transactions ----------
  function removeTransaction(id) {
    transactions = transactions.filter(function (t) { return t.id !== id; });
    saveTransactions();
    renderAll();
  }

  function sortedTransactions() {
    var arr = transactions.slice();
    switch (sortMode) {
      case 'oldest': arr.sort(function (a, b) { return a.createdAt - b.createdAt; }); break;
      case 'amount-desc': arr.sort(function (a, b) { return b.amount - a.amount; }); break;
      case 'amount-asc': arr.sort(function (a, b) { return a.amount - b.amount; }); break;
      case 'name-asc': arr.sort(function (a, b) { return a.name.localeCompare(b.name); }); break;
      case 'category-asc': arr.sort(function (a, b) { return a.category.localeCompare(b.category); }); break;
      default: arr.sort(function (a, b) { return b.createdAt - a.createdAt; });
    }
    return arr;
  }

  // ---------- Categories ----------
  function renderCategoryOptions() {
    categorySelect.innerHTML = '';
    categories.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      categorySelect.appendChild(opt);
    });
  }

  function renderCustomChips() {
    var wrap = document.getElementById('customCats');
    wrap.innerHTML = '';
    categories.forEach(function (c) {
      if (DEFAULT_CATEGORIES.indexOf(c) !== -1) return;
      var chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = c + ' ';
      var x = document.createElement('button');
      x.type = 'button';
      x.setAttribute('data-remove-cat', c);
      x.setAttribute('aria-label', 'Remove category ' + c);
      x.textContent = '×';
      chip.appendChild(x);
      wrap.appendChild(chip);
    });
  }

  function addCustomCategory() {
    var v = newCatInput.value.trim().replace(/\s+/g, ' ');
    if (!v) return;
    var exists = categories.some(function (c) { return c.toLowerCase() === v.toLowerCase(); });
    if (exists) {
      categorySelect.value = categories.filter(function (c) { return c.toLowerCase() === v.toLowerCase(); })[0];
      newCatRow.hidden = true;
      newCatInput.value = '';
      return;
    }
    categories.push(v);
    localStorage.setItem(LS_CAT, JSON.stringify(categories));
    renderCategoryOptions();
    renderCustomChips();
    categorySelect.value = v;
    newCatRow.hidden = true;
    newCatInput.value = '';
  }

  function removeCustomCategory(name) {
    var used = transactions.some(function (t) { return t.category === name; });
    if (used) {
      showError('Category "' + name + '" is used by a transaction and cannot be removed.');
      return;
    }
    categories = categories.filter(function (c) { return c !== name; });
    localStorage.setItem(LS_CAT, JSON.stringify(categories));
    renderCategoryOptions();
    renderCustomChips();
    renderChart();
  }

  // ---------- Render ----------
  function renderAll() {
    renderSummary();
    renderList();
    renderChart();
    renderBudget();
  }

  function totalSpent() {
    return transactions.reduce(function (s, t) { return s + t.amount; }, 0);
  }

  function renderSummary() {
    var total = totalSpent();
    totalBalanceEl.textContent = formatMoney(total);
    txCountEl.textContent = transactions.length + (transactions.length === 1 ? ' transaction' : ' transactions');

    var now = new Date();
    var monthTotal = transactions
      .filter(function (t) {
        var d = new Date(t.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce(function (s, t) { return s + t.amount; }, 0);
    var monthName = now.toLocaleString('en-US', { month: 'long' });
    monthSummaryEl.textContent = monthName + ': ' + formatMoney(monthTotal) + ' (' + countThisMonth() + ')';
  }

  function countThisMonth() {
    var now = new Date();
    var n = transactions.filter(function (t) {
      var d = new Date(t.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return n + (n === 1 ? ' item' : ' items');
  }

  function renderList() {
    var items = sortedTransactions();
    txList.innerHTML = '';
    txEmpty.style.display = items.length === 0 ? 'block' : 'none';
    if (items.length === 0) return;

    items.forEach(function (t) {
      var row = document.createElement('div');
      row.className = 'tx-item';
      row.setAttribute('role', 'listitem');

      var info = document.createElement('div');
      info.className = 'tx-info';
      var name = document.createElement('p');
      name.className = 'tx-name';
      name.textContent = t.name;
      var amt = document.createElement('p');
      amt.className = 'tx-amount';
      amt.textContent = formatMoney(t.amount);
      var cat = document.createElement('span');
      cat.className = 'tx-cat';
      cat.textContent = t.category;
      var date = document.createElement('span');
      date.className = 'tx-date';
      date.textContent = formatDate(t.createdAt);
      info.appendChild(name);
      info.appendChild(amt);
      info.appendChild(cat);
      info.appendChild(date);

      var del = document.createElement('button');
      del.className = 'btn btn-danger';
      del.type = 'button';
      del.textContent = 'Delete';
      del.setAttribute('data-delete', t.id);
      del.setAttribute('aria-label', 'Delete ' + t.name);

      row.appendChild(info);
      row.appendChild(del);
      txList.appendChild(row);
    });
  }

  function categoryTotals() {
    var map = {};
    transactions.forEach(function (t) {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return categories
      .filter(function (c) { return map[c] > 0; })
      .map(function (c) { return { name: c, total: map[c] }; })
      .sort(function (a, b) { return b.total - a.total; });
  }

  function colorFor(category, index) {
    if (BASE_COLORS[category]) return BASE_COLORS[category];
    return EXTRA_PALETTE[index % EXTRA_PALETTE.length];
  }

  function renderChart() {
    var data = categoryTotals();
    chartEmpty.hidden = data.length !== 0;
    renderBreakdown(data);

    if (typeof Chart === 'undefined') {
      return;
    }

    var labels = data.map(function (d) { return d.name; });
    var values = data.map(function (d) { return Math.round(d.total * 100) / 100; });
    var colors = data.map(function (d, i) { return colorFor(d.name, i); });

    if (!chart) {
      chart = new Chart(chartCanvas, {
        type: 'pie',
        data: { labels: labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#ffffff', borderWidth: 2 }] },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 22, padding: 16, font: { size: 13 } } },
            tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.label + ': $' + Number(ctx.raw).toFixed(2); } } }
          }
        }
      });
    } else {
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.data.datasets[0].backgroundColor = colors;
      chart.update();
    }
  }

  function renderBreakdown(data) {
    breakdownEl.innerHTML = '';
    var total = totalSpent() || 1;
    data.forEach(function (d, i) {
      var row = document.createElement('div');
      row.className = 'breakdown-row';
      var sw = document.createElement('span');
      sw.className = 'breakdown-swatch';
      sw.style.background = colorFor(d.name, i);
      var nm = document.createElement('span');
      nm.className = 'breakdown-name';
      nm.textContent = d.name;
      var val = document.createElement('span');
      val.className = 'breakdown-val';
      val.textContent = formatMoney(d.total) + ' • ' + Math.round((d.total / total) * 100) + '%';
      row.appendChild(sw);
      row.appendChild(nm);
      row.appendChild(val);
      breakdownEl.appendChild(row);
    });
  }

  function renderBudget() {
    if (!(budgetLimit > 0)) {
      budgetBar.style.width = '0%';
      budgetBar.style.background = 'var(--primary)';
      budgetMsg.textContent = '';
      budgetMsg.classList.remove('over');
      heroCard.classList.remove('over-limit');
      return;
    }
    var total = totalSpent();
    var pct = Math.min(100, Math.round((total / budgetLimit) * 100));
    budgetBar.style.width = pct + '%';
    var over = total > budgetLimit;
    budgetBar.style.background = over ? 'var(--danger)' : 'var(--primary)';
    budgetMsg.textContent = over
      ? 'Over budget by ' + formatMoney(total - budgetLimit) + ' (limit ' + formatMoney(budgetLimit) + ').'
      : formatMoney(budgetLimit - total) + ' left of ' + formatMoney(budgetLimit) + ' budget.';
    budgetMsg.classList.toggle('over', over);
    heroCard.classList.toggle('over-limit', over);
  }

  // ---------- Theme ----------
  function initTheme() {
    var saved = localStorage.getItem(LS_THEME);
    var theme = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(theme);
  }
  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(LS_THEME, theme);
    var dark = theme === 'dark';
    themeToggle.setAttribute('aria-pressed', String(dark));
    themeToggle.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    themeToggle.querySelector('.theme-icon').textContent = dark ? '☀️' : '🌙';
    themeToggle.querySelector('.theme-label').textContent = dark ? 'Light' : 'Dark';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#121519' : '#f6f7f9');
  }

  // ---------- Storage & utils ----------
  function saveTransactions() {
    localStorage.setItem(LS_TX, JSON.stringify(transactions));
  }
  function loadJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }
  function loadNumber(key, fallback) {
    var v = parseFloat(localStorage.getItem(key));
    return isFinite(v) && v > 0 ? v : fallback;
  }
  function uid() {
    return 'tx_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function formatMoney(n) {
    return '$' + (Math.round(n * 100) / 100).toFixed(2);
  }
  function formatDate(ts) {
    try {
      return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return '';
    }
  }
})();
