Page({
  data: {
    activeExhibition: {},
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
  async loadActive() {
    const app = getApp();
    const res = await wx.request({
      url: `${app.globalData.apiBase}/api/public/active`
    });
    this.setData({ activeExhibition: res.data });
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
