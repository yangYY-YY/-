const loginSection = document.getElementById("login");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const exportBtn = document.getElementById("exportBtn");
const createExhibitionForm = document.getElementById("createExhibitionForm");
const exhibitionList = document.getElementById("exhibitionList");
const activeExhibition = document.getElementById("activeExhibition");
const statCheckins = document.getElementById("statCheckins");
const statWinners = document.getElementById("statWinners");
const drawForm = document.getElementById("drawForm");
const prizeList = document.getElementById("prizeList");
const addPrizeBtn = document.getElementById("addPrizeBtn");
const prizeSum = document.getElementById("prizeSum");

const api = async (url, options = {}) => {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
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
});

const getPrizeRows = () => {
  const rows = Array.from(prizeList.querySelectorAll(".prize-item"));
  return rows.map((row) => {
    const name = row.querySelector("input[name='prizeName']").value.trim();
    const prob = Number(row.querySelector("input[name='prizeProb']").value || 0);
    return { name, prob };
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
      <input name="prizeProb" type="number" min="0" max="1" step="0.01" value="${prize.prob}" />
      <button type="button" class="ghost" data-index="${index}">删除</button>
    `;
    item.querySelector("button").addEventListener("click", () => {
      const current = getPrizeRows();
      current.splice(index, 1);
      renderPrizes(current);
    });
    item.querySelector("input[name='prizeName']").addEventListener("input", updatePrizeSum);
    item.querySelector("input[name='prizeProb']").addEventListener("input", updatePrizeSum);
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
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    loginSection.classList.add("hidden");
    dashboard.classList.remove("hidden");
    loadDashboard();
  } catch (err) {
    loginError.textContent = "账号或密码错误";
  }
});

logoutBtn.addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST" });
  dashboard.classList.add("hidden");
  loginSection.classList.remove("hidden");
});

exportBtn.addEventListener("click", () => {
  window.location.href = "/api/admin/export";
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
  current.push({ name: "", prob: 0 });
  renderPrizes(current);
});

drawForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { prizes, total } = updatePrizeSum();
 if (Math.abs(total - 1) > 0.0001) {
  alert("中奖概率合计必须等于 1");
  return;
}
  const cleaned = prizes.filter((p) => p.name).map((p) => ({
    name: p.name,
    weight: Number(p.prob || 0),
  }));
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

