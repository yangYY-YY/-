const loginSection = document.getElementById("login");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const exportBtn = document.getElementById("exportBtn");
const previewBtn = document.getElementById("previewBtn");
const createExhibitionForm = document.getElementById("createExhibitionForm");
const exhibitionList = document.getElementById("exhibitionList");
const activeExhibition = document.getElementById("activeExhibition");
const statCheckins = document.getElementById("statCheckins");
const statWinners = document.getElementById("statWinners");
const drawForm = document.getElementById("drawForm");
const prizeList = document.getElementById("prizeList");
const addPrizeBtn = document.getElementById("addPrizeBtn");
const prizeSum = document.getElementById("prizeSum");

const tokenKey = "admin_token";
const getToken = () => localStorage.getItem(tokenKey);
const setToken = (token) => localStorage.setItem(tokenKey, token);
const clearToken = () => localStorage.removeItem(tokenKey);

const api = async (url, options = {}) => {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    headers,
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    throw new Error("request failed");
  }
  return res.json();
};

const normalizePrize = (prize) => ({
  name: prize?.name || "",
  prob: Number(prize?.prob ?? prize?.weight ?? 0),
  qty: prize?.qty ?? "",
});

const getPrizeRows = () => {
  const rows = Array.from(prizeList.querySelectorAll(".prize-item"));
  return rows.map((row) => {
    const name = row.querySelector("input[name='prizeName']").value.trim();
    const prob = Number(row.querySelector("input[name='prizeProb']").value || 0);
    const qtyRaw = row.querySelector("input[name='prizeQty']").value.trim();
    const qty = qtyRaw === "" ? null : Number(qtyRaw);
    return { name, prob, qty };
  });
};

const updatePrizeSum = () => {
  const prizes = getPrizeRows();
  const total = prizes.reduce((sum, p) => sum + (Number(p.prob) || 0), 0);
  prizeSum.textContent = `已配置中奖概率合计：${total.toFixed(2)}`;
  return { prizes, total };
};

const renderPrizes = (prizes) => {
  prizeList.innerHTML = "";
  prizes.forEach((prize, index) => {
    const item = document.createElement("div");
    item.className = "prize-item";
    item.innerHTML = `
      <input name="prizeName" placeholder="奖品名称" value="${prize.name}" />
      <input name="prizeProb" type="number" min="0" max="1" step="0.01" placeholder="中奖概率(0-1)" value="${prize.prob}" />
      <input name="prizeQty" type="number" min="1" step="1" placeholder="奖品数量(可空)" value="${prize.qty ?? ""}" />
      <button type="button" class="ghost" data-index="${index}">删除</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      const current = getPrizeRows();
      current.splice(index, 1);
      renderPrizes(current);
    });
    item.querySelector("input[name='prizeName']").addEventListener("input", updatePrizeSum);
    item.querySelector("input[name='prizeProb']").addEventListener("input", updatePrizeSum);
    item.querySelector("input[name='prizeQty']").addEventListener("input", updatePrizeSum);
    prizeList.appendChild(item);
  });
  updatePrizeSum();
};

const loadDashboard = async () => {
  const summary = await api("/api/admin/summary");
  const exhibitions = await api("/api/admin/exhibitions");
  const draw = await api("/api/admin/draw");

  activeExhibition.textContent = `当前展会：${summary.activeExhibition.name}`;
  statCheckins.textContent = summary.checkins;
  statWinners.textContent = summary.winners;

  const prizes = (draw.prizes || []).map(normalizePrize);
  renderPrizes(prizes);

  exhibitionList.innerHTML = "";
  exhibitions.forEach((exhibition) => {
    const item = document.createElement("div");
    item.className = "exhibition-item";
    item.innerHTML = `<span>${exhibition.name}</span>`;
    const button = document.createElement("button");
    button.textContent = exhibition.is_active ? "使用中" : "切换";
    button.disabled = !!exhibition.is_active;
    button.addEventListener("click", async () => {
      await api(`/api/admin/exhibitions/${exhibition.id}/activate`, { method: "POST" });
      loadDashboard();
    });
    item.appendChild(button);
    exhibitionList.appendChild(item);
  });
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const payload = Object.fromEntries(new FormData(loginForm));
  try {
    const data = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (data?.token) setToken(data.token);
    loginSection.classList.add("hidden");
    dashboard.classList.remove("hidden");
    loadDashboard();
  } catch (err) {
    loginError.textContent = "账号或密码错误";
  }
});

logoutBtn.addEventListener("click", async () => {
  clearToken();
  await api("/api/admin/logout", { method: "POST" });
  dashboard.classList.add("hidden");
  loginSection.classList.remove("hidden");
});

exportBtn.addEventListener("click", () => {
  const token = getToken();
  const url = token ? `/api/admin/export?token=${encodeURIComponent(token)}` : "/api/admin/export";
  window.location.href = url;
});

previewBtn.addEventListener("click", async () => {
  try {
    const list = await api("/api/admin/draw-preview?limit=50");
    if (!list || !list.length) {
      alert("暂无抽奖记录");
      return;
    }
    const lines = list.map((item, idx) => {
      const time = item.draw_time || "";
      const phone = item.phone || "";
      const result = item.result || "";
      return `${idx + 1}. ${phone} - ${result} ${time}`;
    });
    alert(lines.join("\n"));
  } catch (err) {
    alert("获取抽奖结果失败");
  }
});

createExhibitionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(createExhibitionForm));
  await api("/api/admin/exhibitions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  createExhibitionForm.reset();
  loadDashboard();
});

addPrizeBtn.addEventListener("click", () => {
  const current = getPrizeRows();
  current.push({ name: "", prob: 0, qty: null });
  renderPrizes(current);
});

drawForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { prizes, total } = updatePrizeSum();
  if (Math.abs(total - 1) > 0.0001) {
    alert("中奖概率合计必须等于 1");
    return;
  }
  const cleaned = prizes.filter((p) => p.name).map((p) => {
    const qty = Number.isFinite(p.qty) && p.qty > 0 ? Math.floor(p.qty) : null;
    return {
      name: p.name,
      weight: Number(p.prob || 0),
      qty,
    };
  });
  const payload = {
    winRate: 1,
    prizes: cleaned,
  };
  await api("/api/admin/draw", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  alert("已保存");
});

const autoLogin = async () => {
  if (!getToken()) return;
  try {
    loginSection.classList.add("hidden");
    dashboard.classList.remove("hidden");
    await loadDashboard();
  } catch (err) {
    clearToken();
    dashboard.classList.add("hidden");
    loginSection.classList.remove("hidden");
  }
};

autoLogin();
