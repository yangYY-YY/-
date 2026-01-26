Page({
  data: {
    phone: "",
    result: ""
  },
  onLoad(options) {
    this.setData({ phone: options.phone || "" });
  },
  draw() {
    const app = getApp();
    wx.request({
      url: `${app.globalData.apiBase}/api/public/draw`,
      method: "POST",
      data: { phone: this.data.phone },
      success: (res) => {
        this.setData({ result: res.data.result || "未中奖" });
      },
      fail: (err) => {
        const msg = err?.data?.error === "drawn" ? "已抽过奖" : "抽奖失败";
        wx.showToast({ title: msg, icon: "none" });
      }
    });
  }
});
