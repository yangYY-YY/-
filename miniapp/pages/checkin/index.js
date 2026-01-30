Page({
  data: {
    activeExhibition: { name: "未设置" },
    lastDrawResult: "未抽奖",
    form: {
      companyName: "",
      signerName: "",
      phone: "",
      location: ""
    }
  },
  onLoad() {
    this.loadActive();
    this.detectLocation();
  },
  onShow() {
    const result = wx.getStorageSync("lastDrawResult") || "";
    this.setData({ lastDrawResult: result || "未抽奖" });
  },
  loadActive() {
    const app = getApp();
    wx.request({
      url: `${app.globalData.apiBase}/api/public/active`,
      success: (res) => {
        if (res && res.data && res.data.name) {
          this.setData({ activeExhibition: res.data });
        } else {
          this.setData({ activeExhibition: { name: "未设置" } });
        }
      },
      fail: () => {
        this.setData({ activeExhibition: { name: "未设置" } });
      }
    });
  },
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },
  async detectLocation() {
    wx.getLocation({
      type: "wgs84",
      success: (res) => {
        const location = `纬度${res.latitude.toFixed(4)} 经度${res.longitude.toFixed(4)}`;
        this.setData({ "form.location": location });
      }
    });
  },
  openAdmin() {
    wx.navigateTo({ url: "/pages/admin/index" });
  },
  async submit() {
    const { companyName, signerName, phone, location } = this.data.form;
    if (!companyName || !signerName || !phone || !location) {
      wx.showToast({ title: "请完整填写", icon: "none" });
      return;
    }
    if (!/^\d{11}$/.test(phone)) {
      wx.showToast({ title: "手机号需11位", icon: "none" });
      return;
    }
    const app = getApp();
    wx.request({
      url: `${app.globalData.apiBase}/api/public/checkin`,
      method: "POST",
      data: { companyName, signerName, phone, location },
      success: () => {
        wx.navigateTo({ url: `/pages/success/index?phone=${phone}` });
      },
      fail: () => {
        wx.showToast({ title: "提交失败", icon: "none" });
      }
    });
  }
});
