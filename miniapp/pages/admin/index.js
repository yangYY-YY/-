Page({
  data: {
    adminUrl: "https://expo-checkin.onrender.com/admin/"
  },
  onLoad() {
    const app = getApp();
    const base = app.globalData.apiBase || "https://expo-checkin.onrender.com";
    const url = `${base.replace(/\/$/, "")}/admin/`;
    this.setData({ adminUrl: url });
  }
});
