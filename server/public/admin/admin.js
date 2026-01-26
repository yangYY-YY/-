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

const loadDashboard = async () => {
  const summary = await api("/api/admin/summary");
  const exhibitions = await api("/api/admin/exhibitions");
  const draw = await api("/api/admin/draw");

  activeExhibition.textContent = `当前展会：${summary.activeExhibition.name}`;
  statCheckins.textContent = summary.checkins;
  statWinners.textContent = summary.winners;

  drawForm.winRate.value = draw.winRate;
  drawForm.prizes.value = JSON.stringify(draw.prizes, null, 2);

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

drawForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  let prizes = [];
  try {
    prizes = JSON.parse(drawForm.prizes.value || "[]");
  } catch (err) {
    alert("奖品 JSON 格式不正确");
    return;
  }
  const payload = {
    winRate: Number(drawForm.winRate.value),
    prizes,
  };
  await api("/api/admin/draw", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  alert("已保存");
});
