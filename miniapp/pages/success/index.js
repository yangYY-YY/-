Page({
  data: {
    phone: "",
    result: "",
    prizes: [],
    labelStyles: [],
    spinning: false,
    angle: 0,
    pointerStyle: "",
    wheelStyle: ""
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
        this.setData({ prizes }, () => this.buildLabels());
      },
      fail: () => {
        this.setData({ prizes: [] }, () => this.buildLabels());
      }
    });
  },
  buildWheelStyle() {
    const prizes = this.data.prizes;
    if (!prizes.length) return "";
    const count = prizes.length;
    const slice = 360 / count;
    const palette = [
      "#f6e7d6",
      "#fef6ea",
      "#e9f1e7",
      "#f2e9f7",
      "#e8f0f7",
      "#f7efe6",
      "#f1f5e9",
      "#f7ebe1",
      "#e9eef2",
      "#f2f0e9"
    ];
    const borderColor = "#e3d8c9";
    const stops = [];
    for (let i = 0; i < count; i++) {
      const start = i * slice;
      const end = start + slice;
      const color = palette[i % palette.length];
      const gap = 0.8; // degrees gap for border
      const segStart = start + gap;
      const segEnd = end - gap;
      stops.push(`${borderColor} ${start}deg ${segStart}deg`);
      stops.push(`${color} ${segStart}deg ${segEnd}deg`);
      stops.push(`${borderColor} ${segEnd}deg ${end}deg`);
    }
    return `background: conic-gradient(${stops.join(", ")});`;
  },
  buildLabels() {
    const prizes = this.data.prizes;
    if (!prizes.length) {
      this.setData({ labelStyles: [], wheelStyle: "" });
      return;
    }
    const count = prizes.length;
    const radius = 130; // rpx (place text near edge)
    const center = 150; // rpx
    const labelStyles = prizes.map((text, index) => {
      const angle = (360 / count) * (index + 0.5) - 90;
      const rad = (angle * Math.PI) / 180;
      const x = center + radius * Math.cos(rad);
      const y = center + radius * Math.sin(rad);
      const style = `left:${x}rpx;top:${y}rpx;transform:translate(-50%,-50%);`;
      return { text, style };
    });
    this.setData({ labelStyles, wheelStyle: this.buildWheelStyle() });
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
          wx.setStorageSync("lastDrawResult", msg);
          wx.showModal({
            title: "提示",
            content: msg,
            showCancel: false,
            success: () => {
              wx.navigateBack();
            }
          });
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

    const rounds = 9;
    const slice = 360 / prizes.length;
    const target = rounds * 360 + index * slice + slice / 2;
    const start = this.data.angle || 0;
    const duration = 9600;

    const startAngle = start % 360;
    const endAngle = start + target;
    this.setData({
      pointerStyle: `transform: translate(-50%, -50%) rotate(${startAngle}deg);`
    });
    setTimeout(() => {
      this.setData({
        pointerStyle: `transform: translate(-50%, -50%) rotate(${endAngle}deg);`
      });
    }, 50);

    setTimeout(() => {
      const finalAngle = endAngle % 360;
      this.setData({ spinning: false, result, angle: finalAngle });
      wx.setStorageSync("lastDrawResult", result);
      wx.showModal({
        title: "抽奖结果",
        content: result,
        showCancel: false,
        success: () => {
          wx.navigateBack();
        }
      });
    }, duration + 50);
  }
});
