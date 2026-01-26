Page({
  data: {
    phone: "",
    records: []
  },
  onInput(e) {
    this.setData({ phone: e.detail.value });
  },
  load() {
    if (!/^\d{11}$/.test(this.data.phone)) {
      wx.showToast({ title: "手机号需11位", icon: "none" });
      return;
    }
    const app = getApp();
    wx.request({
      url: `${app.globalData.apiBase}/api/public/history?phone=${this.data.phone}`,
      success: (res) => {
        this.setData({ records: res.data });
      }
    });
  }
});
