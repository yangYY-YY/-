const BG_IMAGE_WIDTH = 503;
const BG_IMAGE_HEIGHT = 858;

// White disk region in background image (ratio on source image)
const DISK_CENTER_X_RATIO = 0.5;
const DISK_CENTER_Y_RATIO = 0.511;
const DISK_DIAMETER_RATIO = 0.595;

Page({
  data: {
    phone: "",
    result: "",
    prizes: [],
    labelStyles: [],
    spinning: false,
    angle: 0,
    pointerStyle: "",
    wheelStyle: "",
    wheelWrapStyle: "",
    pointerLineStyle: "",
    pointerHeadStyle: "",
    drawBtnStyle: "",
    wheelSizePx: 0,
  },

  onLoad(options) {
    this.setData({ phone: options.phone || "" });
    this.loadPrizes();
  },

  onReady() {
    this.updateLayoutByBackground();
  },

  onShow() {
    this.updateLayoutByBackground();
  },

  updateLayoutByBackground() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const containerWidth = info.windowWidth;
    const containerHeight = info.windowHeight;

    const scale = Math.max(containerWidth / BG_IMAGE_WIDTH, containerHeight / BG_IMAGE_HEIGHT);
    const renderWidth = BG_IMAGE_WIDTH * scale;
    const renderHeight = BG_IMAGE_HEIGHT * scale;
    const offsetX = (containerWidth - renderWidth) / 2;
    const offsetY = (containerHeight - renderHeight) / 2;

    const wheelSize = renderWidth * DISK_DIAMETER_RATIO;
    const wheelLeft = offsetX + renderWidth * DISK_CENTER_X_RATIO - wheelSize / 2;
    const wheelTop = offsetY + renderHeight * DISK_CENTER_Y_RATIO - wheelSize / 2;

    const pointerLen = Math.round(wheelSize * 0.4);
    const buttonTop = wheelTop + wheelSize + 26;

    this.setData(
      {
        wheelSizePx: wheelSize,
        wheelWrapStyle: `left:${wheelLeft}px;top:${wheelTop}px;width:${wheelSize}px;height:${wheelSize}px;`,
        pointerLineStyle: `top:-${pointerLen}px;height:${pointerLen}px;`,
        pointerHeadStyle: `top:-${pointerLen + 26}px;`,
        drawBtnStyle: `top:${buttonTop}px;`,
      },
      () => this.buildLabels()
    );
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
      },
    });
  },

  buildWheelStyle() {
    const prizes = this.data.prizes;
    if (!prizes.length) return "";

    const count = prizes.length;
    const slice = 360 / count;
    const oddPalette = ["#cfefff", "#e7f6ff", "#b9ddff"];
    const evenPalette = ["#e9f7ff", "#c9e6ff"];
    const palette = count % 2 === 0 ? evenPalette : oddPalette;
    const borderColor = "rgb(46, 84, 161)";
    const border = 0.8;

    const stops = [];
    for (let i = 0; i < count; i += 1) {
      const start = i * slice;
      const end = start + slice;
      const color = palette[i % palette.length];
      const segStart = start + border;
      if (segStart >= end) {
        stops.push(`${borderColor} ${start}deg ${end}deg`);
      } else {
        stops.push(`${borderColor} ${start}deg ${segStart}deg`);
        stops.push(`${color} ${segStart}deg ${end}deg`);
      }
    }

    return `background: conic-gradient(${stops.join(", ")});`;
  },

  buildLabels() {
    const prizes = this.data.prizes;
    const wheelSize = this.data.wheelSizePx;
    if (!prizes.length || !wheelSize) {
      this.setData({ labelStyles: [], wheelStyle: this.buildWheelStyle() });
      return;
    }

    const count = prizes.length;
    const radius = wheelSize * 0.33;
    const center = wheelSize / 2;

    const labelStyles = prizes.map((text, index) => {
      const angle = (360 / count) * (index + 0.5) - 90;
      const rad = (angle * Math.PI) / 180;
      const x = center + radius * Math.cos(rad);
      const y = center + radius * Math.sin(rad);
      return {
        text,
        style: `left:${x}px;top:${y}px;transform:translate(-50%,-50%);`,
      };
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
            success: () => wx.navigateBack(),
          });
          return;
        }

        const result = res.data?.result || "未中奖";
        this.spinToResult(result);
      },
      fail: () => {
        this.setData({ spinning: false, result: "抽奖失败" });
        wx.showModal({ title: "提示", content: "抽奖失败", showCancel: false });
      },
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
      pointerStyle: `transform: translate(-50%, -50%) rotate(${startAngle}deg);`,
    });

    setTimeout(() => {
      this.setData({
        pointerStyle: `transform: translate(-50%, -50%) rotate(${endAngle}deg);`,
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
        success: () => wx.navigateBack(),
      });
    }, duration + 50);
  },
});
