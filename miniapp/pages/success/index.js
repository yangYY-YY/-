Page({
  data: {
    phone: "",
    result: "",
    prizes: [],
    spinning: false,
    angle: 0
  },
  onLoad(options) {
    this.setData({ phone: options.phone || "" });
    this.loadPrizes();
  },
  loadPrizes() {
    const app = getApp();
    wx.request({
      url: `${app.globalData.apiBase}/api/public/draw-settings`,
      success: (res) => {
        const prizes = (res.data?.prizes || []).map((p) => p.name).filter(Boolean);
        this.setData({ prizes }, () => this.drawWheel());
      },
      fail: () => {
        this.setData({ prizes: [] }, () => this.drawWheel());
      }
    });
  },
  drawWheel(rotation = 0) {
    const prizes = this.data.prizes;
    const ctx = wx.createCanvasContext("wheel", this);
    const size = 300;
    const radius = size / 2;
    const center = radius;

    ctx.clearRect(0, 0, size, size);
    if (!prizes.length) {
      ctx.draw();
      return;
    }

    const slice = (Math.PI * 2) / prizes.length;
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(rotation);

    prizes.forEach((label, index) => {
      const start = index * slice - Math.PI / 2;
      const end = start + slice;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.setFillStyle(index % 2 === 0 ? "#f6e7d6" : "#fef6ea");
      ctx.fill();
      ctx.setStrokeStyle("#e3d8c9");
      ctx.stroke();

      ctx.save();
      ctx.rotate(start + slice / 2);
      ctx.setFillStyle("#2e4d3d");
      ctx.setFontSize(12);
      ctx.setTextAlign("right");
      ctx.fillText(label, radius - 12, 4);
      ctx.restore();
    });

    ctx.restore();
    ctx.draw();
  },
  draw() {
    if (this.data.spinning) return;
    if (!this.data.prizes.length) {
      wx.showModal({ title: "提示", content: "暂无奖品配置", showCancel: false });
      return;
    }
    const app = getApp();
    this.setData({ spinning: true, result: "" });

    wx.request({
      url: `${app.globalData.apiBase}/api/public/draw`,
      method: "POST",
      data: { phone: this.data.phone },
      success: (res) => {
        if (res.statusCode !== 200) {
          const msg = res.data?.error === "drawn" ? "您已抽奖" : "抽奖失败";
          this.setData({ spinning: false, result: msg });
          wx.showModal({ title: "提示", content: msg, showCancel: false });
          return;
        }
        const result = res.data?.result || "未中奖";
        this.spinToResult(result);
      },
      fail: () => {
        this.setData({ spinning: false, result: "抽奖失败" });
        wx.showModal({ title: "提示", content: "抽奖失败", showCancel: false });
      }
    });
  },
  spinToResult(result) {
    const prizes = this.data.prizes;
    let index = prizes.indexOf(result);
    if (index < 0) index = Math.floor(Math.random() * prizes.length);

    const rounds = 6;
    const slice = (Math.PI * 2) / prizes.length;
    const target = rounds * Math.PI * 2 + index * slice + slice / 2;
    const start = this.data.angle || 0;
    const duration = 2400;
    const startTime = Date.now();

    const tick = () => {
      const now = Date.now();
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const current = start + (target - start) * ease;
      this.drawWheel(current);
      if (t < 1) {
        setTimeout(tick, 16);
      } else {
        this.setData({ spinning: false, result, angle: current % (Math.PI * 2) });
        wx.showModal({ title: "抽奖结果", content: result, showCancel: false });
      }
    };

    tick();
  }
});
